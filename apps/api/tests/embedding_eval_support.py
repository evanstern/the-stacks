# pyright: reportAny=false, reportMissingParameterType=false, reportUnknownArgumentType=false, reportUnknownLambdaType=false, reportUnknownMemberType=false, reportUnknownParameterType=false, reportUnannotatedClassAttribute=false

import argparse
import importlib.util
import sys
from dataclasses import dataclass
from pathlib import Path
from types import ModuleType
from typing import cast


SCRIPT_PATH = Path(__file__).resolve().parents[3] / "scripts" / "eval_embeddings.py"
FIXTURE_PATH = Path(__file__).resolve().parent / "fixtures" / "embeddings" / "gold.fixture.json"


@dataclass(frozen=True)
class EvaluationPrimitiveResult:
    identity: dict[str, object]
    metrics: dict[str, float]
    queries: list[dict[str, object]]


def load_eval_script() -> ModuleType:
    spec = importlib.util.spec_from_file_location("eval_embeddings_support_script", SCRIPT_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def load_gold_fixture(path: Path = FIXTURE_PATH) -> dict[str, object]:
    script = load_eval_script()
    return cast(dict[str, object], script.load_fixture(path))


def collection_identity(prefix: str, provider: str, model: str, dimensions: int) -> str:
    script = load_eval_script()
    return cast(str, script.collection_name(prefix, provider, model, dimensions))


def rank_fixture_with_vectors(
    document_vectors: list[list[float]],
    query_vectors: list[list[float]],
    *,
    top_k: int,
    fixture_path: Path = FIXTURE_PATH,
) -> EvaluationPrimitiveResult:
    script = load_eval_script()
    fixture = script.load_fixture(fixture_path)
    queries = cast(list[dict[str, object]], script.rank_queries(fixture, document_vectors, query_vectors, top_k))
    return EvaluationPrimitiveResult(identity={}, metrics=cast(dict[str, float], script.summarize_metrics(queries)), queries=queries)


def validate_embedding_dimensions(vectors: list[list[float]], *, dimensions: int, expected_count: int) -> None:
    script = load_eval_script()
    batch = script.EmbeddingBatch(vectors=vectors, model="dimension-check", dimensions=dimensions, provider="deterministic")
    script.validate_batch("embeddings", batch, expected_count)


def evaluate_with_fake_provider(
    *,
    monkeypatch,
    document_vectors: list[list[float]],
    query_vectors: list[list[float]],
    provider: str,
    model: str,
    dimensions: int,
    collection_prefix: str = "eval",
    fixture_path: Path = FIXTURE_PATH,
    top_k: int = 2,
) -> tuple[EvaluationPrimitiveResult, list[tuple[str, int]], list[dict[str, object]]]:
    script = load_eval_script()
    fixture = script.load_fixture(fixture_path)
    ensured: list[tuple[str, int]] = []
    settings_seen: list[dict[str, object]] = []

    class FakeClient:
        def embed_texts(self, texts):
            vectors = document_vectors if len(list(texts)) == len(cast(list[object], fixture["documents"])) else query_vectors
            return script.EmbeddingBatch(vectors=vectors, model=model, dimensions=dimensions, provider=provider)

    class FakeSettings:
        def __init__(self, **kwargs) -> None:
            settings_seen.append(dict(kwargs))
            self.qdrant_collection = cast(str, kwargs["QDRANT_COLLECTION"])

    class FakeHttpQdrantIndexer:
        def __init__(self, settings: FakeSettings) -> None:
            self.collection = settings.qdrant_collection

        def ensure_collection(self, ensured_dimensions: int) -> None:
            ensured.append((self.collection, ensured_dimensions))

    monkeypatch.setitem(sys.modules, "app.config", type("ConfigModule", (), {"Settings": FakeSettings}))
    monkeypatch.setitem(sys.modules, "app.qdrant_index", type("QdrantModule", (), {"HttpQdrantIndexer": FakeHttpQdrantIndexer}))
    monkeypatch.setattr(script, "build_embedding_client", lambda spec: FakeClient())

    provider_spec = script.ProviderSpec(provider=provider, model=model, dimensions=dimensions)
    run = cast(
        dict[str, object],
        script.evaluate_provider(
            fixture,
            provider_spec,
            argparse.Namespace(
                collection_prefix=collection_prefix,
                ensure_qdrant_collection=True,
                qdrant_url="http://qdrant.test",
                top_k=top_k,
            ),
        ),
    )
    result = EvaluationPrimitiveResult(
        identity=cast(dict[str, object], run["identity"]),
        metrics=cast(dict[str, float], run["metrics"]),
        queries=cast(list[dict[str, object]], run["queries"]),
    )
    return result, ensured, settings_seen
