import importlib.util
import json
import sys
from pathlib import Path
from types import ModuleType


SCRIPT_PATH = Path(__file__).resolve().parents[3] / "scripts" / "eval_embeddings.py"
FIXTURE_PATH = Path(__file__).resolve().parent / "fixtures" / "embeddings" / "gold.fixture.json"


def load_script() -> ModuleType:
    spec = importlib.util.spec_from_file_location("eval_embeddings_script", SCRIPT_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_eval_embeddings_json_output_is_deterministic(capsys) -> None:
    script = load_script()

    exit_code = script.main(["--fixture", str(FIXTURE_PATH), "--provider", "deterministic:test-model:6", "--top-k", "2"])

    assert exit_code == 0
    output = json.loads(capsys.readouterr().out)
    assert output["fixture"] == {"document_count": 3, "name": "embedding-eval-smoke", "query_count": 2, "schema_version": 1}
    assert output["run_config"] == {
        "collection_prefix": "embedding_eval",
        "ensure_qdrant_collection": False,
        "provider_specs": ["deterministic:test-model:6"],
        "score_precision": 6,
        "similarity_metric": "cosine",
        "top_k": 2,
    }
    assert len(output["runs"]) == 1
    run = output["runs"][0]
    assert run["identity"] == {
        "collection": "embedding_eval_deterministic-test-model-6_11a787a5",
        "dimensions": 6,
        "model": "test-model",
        "provider": "deterministic",
        "provider_spec": "deterministic:test-model:6",
    }
    assert run["provider"] == "deterministic"
    assert run["model"] == "test-model"
    assert run["dimensions"] == 6
    assert run["collection"] == "embedding_eval_deterministic-test-model-6_11a787a5"
    assert run["metrics"] == {"hit_rate_at_1": 0.0, "hit_rate_at_top_k": 0.5, "mean_reciprocal_rank": 0.416667}
    assert run["queries"] == [
        {
            "expected_document_ids": ["goblin-map"],
            "first_relevant_rank": 3,
            "hit_at_1": False,
            "hit_at_top_k": False,
            "query_id": "find-mapmaker",
            "ranking": [
                {"document_id": "healing-potion", "score": -0.50567},
                {"document_id": "winter-rations", "score": -0.51177},
            ],
            "top_document_id": "healing-potion",
            "top_score": -0.50567,
        },
        {
            "expected_document_ids": ["healing-potion"],
            "first_relevant_rank": 2,
            "hit_at_1": False,
            "hit_at_top_k": True,
            "query_id": "find-healing",
            "ranking": [
                {"document_id": "winter-rations", "score": 0.547701},
                {"document_id": "healing-potion", "score": 0.440228},
            ],
            "top_document_id": "winter-rations",
            "top_score": 0.547701,
        },
    ]


def test_eval_embeddings_text_output_is_human_readable(capsys) -> None:
    script = load_script()

    exit_code = script.main(["--fixture", str(FIXTURE_PATH), "--format", "text", "--provider", "deterministic:test-model:6"])

    assert exit_code == 0
    output = capsys.readouterr().out
    assert "Embedding evaluation: embedding-eval-smoke (3 documents, 2 queries)" in output
    assert "Run config: top_k=3 similarity=cosine score_precision=6" in output
    assert "Provider: deterministic model=test-model dimensions=6" in output
    assert "Metrics: hit@1=0.000000 hit@top_k=1.000000 mrr=0.416667" in output


def test_eval_embeddings_builds_runtime_provider_client(monkeypatch) -> None:
    script = load_script()
    observed = []

    class FakeRuntimeClient:
        provider = "openai"
        model = "runtime-model"
        dimensions = 3

        def embed_texts(self, texts):
            observed.append(list(texts))
            return script.EmbeddingBatch(
                vectors=[[float(index + 1)] * self.dimensions for index, _ in enumerate(texts)],
                model=self.model,
                dimensions=self.dimensions,
                provider=self.provider,
            )

    def fake_runtime_embedding_client(settings_kwargs):
        assert settings_kwargs == {
            "EMBEDDING_PROVIDER": "openai",
            "OPENAI_EMBEDDING_MODEL": "runtime-model",
            "OPENAI_EMBEDDING_DIMENSIONS": 3,
        }
        return FakeRuntimeClient()

    monkeypatch.setattr(script, "runtime_embedding_client", fake_runtime_embedding_client)

    exit_code = script.main(["--fixture", str(FIXTURE_PATH), "--provider", "openai:runtime-model:3"])

    assert exit_code == 0
    assert len(observed) == 2
