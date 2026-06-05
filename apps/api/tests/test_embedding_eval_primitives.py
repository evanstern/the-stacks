# pyright: reportAny=false, reportMissingParameterType=false, reportUnknownArgumentType=false, reportUnknownLambdaType=false, reportUnknownMemberType=false, reportUnknownParameterType=false, reportUnknownVariableType=false, reportUnannotatedClassAttribute=false

import argparse
import importlib.util
import sys
from pathlib import Path
from types import ModuleType
from typing import cast


SCRIPT_PATH = Path(__file__).resolve().parents[3] / "scripts" / "eval_embeddings.py"
FIXTURE_PATH = Path(__file__).resolve().parent / "fixtures" / "embeddings" / "gold.fixture.json"


def load_script() -> ModuleType:
    spec = importlib.util.spec_from_file_location("eval_embeddings_primitives", SCRIPT_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_load_fixture_preserves_expected_hit_order_and_document_references() -> None:
    script = load_script()

    fixture = script.load_fixture(FIXTURE_PATH)

    assert fixture["schema_version"] == 1
    assert [document["id"] for document in fixture["documents"]] == [
        "goblin-map",
        "healing-potion",
        "winter-rations",
    ]
    assert [query["id"] for query in fixture["queries"]] == ["find-mapmaker", "find-healing"]
    assert [query["relevant_document_ids"] for query in fixture["queries"]] == [["goblin-map"], ["healing-potion"]]


def test_rank_queries_and_metric_summary_use_expected_hits_not_top_score_only() -> None:
    script = load_script()
    fixture = script.load_fixture(FIXTURE_PATH)
    document_vectors = [
        [1.0, 0.0],
        [0.0, 1.0],
        [0.8, 0.2],
    ]
    query_vectors = [
        [0.7, 0.3],
        [1.0, 0.0],
    ]

    query_results = script.rank_queries(fixture, document_vectors, query_vectors, top_k=2)

    assert query_results == [
        {
            "expected_document_ids": ["goblin-map"],
            "first_relevant_rank": 2,
            "hit_at_1": False,
            "hit_at_top_k": True,
            "query_id": "find-mapmaker",
            "ranking": [
                {"document_id": "winter-rations", "score": 0.987241},
                {"document_id": "goblin-map", "score": 0.919145},
            ],
            "top_document_id": "winter-rations",
            "top_score": 0.987241,
        },
        {
            "expected_document_ids": ["healing-potion"],
            "first_relevant_rank": 3,
            "hit_at_1": False,
            "hit_at_top_k": False,
            "query_id": "find-healing",
            "ranking": [
                {"document_id": "goblin-map", "score": 1.0},
                {"document_id": "winter-rations", "score": 0.970143},
            ],
            "top_document_id": "goblin-map",
            "top_score": 1.0,
        },
    ]
    assert script.summarize_metrics(query_results) == {
        "hit_rate_at_1": 0.0,
        "hit_rate_at_top_k": 0.5,
        "mean_reciprocal_rank": 0.416667,
    }


def test_collection_name_includes_provider_model_dimensions_and_stable_hash() -> None:
    script = load_script()

    collection = script.collection_name(
        "eval",
        "huggingface",
        "sentence-transformers/all-MiniLM-L6-v2",
        384,
    )

    assert collection == "eval_huggingface-sentence-transformers_all-minilm-l6-v2-384_d262389f"
    assert collection != "eval"


def test_validate_batch_rejects_vectors_that_do_not_match_reported_dimensions(capsys) -> None:
    script = load_script()
    batch = script.EmbeddingBatch(
        vectors=[[1.0, 0.0], [0.0]],
        model="bad-dimensions",
        dimensions=2,
        provider="deterministic",
    )

    try:
        script.validate_batch("queries", batch, expected_count=2)
    except SystemExit as exc:
        assert exc.code == 1
    else:
        raise AssertionError("Expected dimension mismatch to abort evaluation")

    assert "queries embedding index=1 dimensions=1, expected 2" in capsys.readouterr().err


def test_evaluate_provider_records_identity_and_ensures_dimension_scoped_collection(monkeypatch) -> None:
    script = load_script()
    fixture = script.load_fixture(FIXTURE_PATH)
    ensured: list[tuple[str, int]] = []
    settings_seen: list[dict[str, object]] = []

    class FakeClient:
        provider = "huggingface"
        model = "sentence-transformers/test-model"
        dimensions = 2

        def embed_texts(self, texts):
            text_list = list(texts)
            if len(text_list) == 3:
                vectors = [[1.0, 0.0], [0.0, 1.0], [0.8, 0.2]]
            else:
                vectors = [[1.0, 0.0], [0.0, 1.0]]
            return script.EmbeddingBatch(
                vectors=vectors,
                model=self.model,
                dimensions=self.dimensions,
                provider=self.provider,
            )

    class FakeSettings:
        def __init__(self, **kwargs) -> None:
            settings_seen.append(kwargs)
            self.qdrant_collection = cast(str, kwargs["QDRANT_COLLECTION"])

    class FakeHttpQdrantIndexer:
        def __init__(self, settings: FakeSettings) -> None:
            self.collection = settings.qdrant_collection

        def ensure_collection(self, dimensions: int) -> None:
            ensured.append((self.collection, dimensions))

    monkeypatch.setitem(sys.modules, "app.config", type("ConfigModule", (), {"Settings": FakeSettings}))
    monkeypatch.setitem(sys.modules, "app.qdrant_index", type("QdrantModule", (), {"HttpQdrantIndexer": FakeHttpQdrantIndexer}))
    monkeypatch.setattr(script, "build_embedding_client", lambda spec: FakeClient())

    result = script.evaluate_provider(
        fixture,
        script.ProviderSpec(provider="huggingface", model="sentence-transformers/test-model", dimensions=2),
        argparse.Namespace(collection_prefix="eval", ensure_qdrant_collection=True, qdrant_url="http://qdrant.test", top_k=2),
    )

    expected_collection = "eval_huggingface-sentence-transformers_test-model-2_6f7e6f72"
    assert result["identity"] == {
        "collection": expected_collection,
        "dimensions": 2,
        "model": "sentence-transformers/test-model",
        "provider": "huggingface",
        "provider_spec": "huggingface:sentence-transformers/test-model:2",
    }
    assert result["metrics"] == {"hit_rate_at_1": 1.0, "hit_rate_at_top_k": 1.0, "mean_reciprocal_rank": 1.0}
    assert settings_seen == [{"QDRANT_URL": "http://qdrant.test", "QDRANT_COLLECTION": expected_collection}]
    assert ensured == [(expected_collection, 2)]
