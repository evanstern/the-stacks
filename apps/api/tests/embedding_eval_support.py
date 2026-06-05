from dataclasses import dataclass
import argparse
import importlib.util
import re
import sys
from pathlib import Path
from collections.abc import Sequence
from typing import Protocol, TypedDict, cast

from app.embeddings import EmbeddingBatch
from app.qdrant_index import QdrantSearchHit
from fixtures.embedding_eval.gold_fixture import EmbeddingEvalGoldSet


SCRIPT_PATH = Path(__file__).resolve().parents[3] / "scripts" / "eval_embeddings.py"
FIXTURE_PATH = Path(__file__).resolve().parent / "fixtures" / "embeddings" / "gold.fixture.json"


class EvalEmbeddingsScript(Protocol):
    def build_embedding_client(self, spec: "ProviderSpecLike") -> "EmbeddingEvalClient": ...

    def evaluate_provider(self, fixture: EmbeddingEvalGoldSet, spec: "ProviderSpecLike", args: object) -> dict[str, object]: ...

    def load_fixture(self, path: Path) -> EmbeddingEvalGoldSet: ...

    def collection_name(self, prefix: str, provider: str, model: str, dimensions: int) -> str: ...

    def rank_queries(
        self,
        fixture: EmbeddingEvalGoldSet,
        document_vectors: Sequence[list[float]],
        query_vectors: Sequence[list[float]],
        top_k: int,
    ) -> list[dict[str, object]]: ...

    def summarize_metrics(self, query_results: Sequence[dict[str, object]]) -> dict[str, float]: ...

    def validate_batch(self, label: str, batch: EmbeddingBatch, expected_count: int) -> None: ...


class EmbeddingEvalClient(Protocol):
    model: str
    dimensions: int

    def embed_texts(self, texts: Sequence[str]) -> EmbeddingBatch: ...


class EmbeddingEvalIndexer(Protocol):
    def ensure_collection(self, dimensions: int) -> None: ...

    def search_points(self, vector: list[float], limit: int, collection: str | None = None) -> list[QdrantSearchHit]: ...


class MonkeyPatchLike(Protocol):
    def setitem(self, mapping: object, name: str, value: object) -> None: ...

    def setattr(self, target: object, name: str, value: object) -> None: ...


class GoldQuery(TypedDict):
    id: str
    text: str
    expected_hits: list[str]


@dataclass(frozen=True)
class ProviderSpecLike:
    provider: str
    model: str | None = None
    dimensions: int | None = None

    @property
    def label(self) -> str:
        parts = [self.provider]
        if self.model:
            parts.append(self.model)
        if self.dimensions is not None:
            parts.append(str(self.dimensions))
        return ":".join(parts)


@dataclass(frozen=True)
class EvaluationPrimitiveResult:
    identity: dict[str, object]
    metrics: dict[str, float]
    queries: list[dict[str, object]]


@dataclass(frozen=True)
class EvaluationCollectionIdentity:
    provider: str
    model: str
    dimensions: int
    collection: str


@dataclass(frozen=True)
class EvaluationQueryMetric:
    query_id: str
    retrieved_ids: list[str]
    first_relevant_rank: int | None


@dataclass(frozen=True)
class GoldSetEvaluationResult:
    identity: EvaluationCollectionIdentity
    metrics: dict[str, float]
    query_metrics: list[EvaluationQueryMetric]


def load_eval_script() -> EvalEmbeddingsScript:
    spec = importlib.util.spec_from_file_location("eval_embeddings_support_script", SCRIPT_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return cast(EvalEmbeddingsScript, cast(object, module))


def load_gold_fixture(path: Path = FIXTURE_PATH) -> EmbeddingEvalGoldSet:
    return load_eval_script().load_fixture(path)


def collection_identity(prefix: str, provider: str, model: str, dimensions: int) -> str:
    return load_eval_script().collection_name(prefix, provider, model, dimensions)


def derive_evaluation_collection(prefix: str, provider: str, model: str, dimensions: int) -> str:
    if not provider or not model or dimensions < 1:
        raise ValueError("provider, model, and dimensions are required to derive an evaluation collection")

    def _slug(value: str) -> str:
        return re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower()

    return f"{_slug(prefix)}_{_slug(provider)}-{_slug(model)}-{dimensions}"


def rank_fixture_with_vectors(
    document_vectors: list[list[float]],
    query_vectors: list[list[float]],
    *,
    top_k: int,
    fixture_path: Path = FIXTURE_PATH,
) -> EvaluationPrimitiveResult:
    script = load_eval_script()
    fixture = script.load_fixture(fixture_path)
    queries = script.rank_queries(fixture, document_vectors, query_vectors, top_k)
    return EvaluationPrimitiveResult(identity={}, metrics=script.summarize_metrics(queries), queries=queries)


def validate_embedding_dimensions(vectors: list[list[float]], *, dimensions: int, expected_count: int) -> None:
    batch = EmbeddingBatch(vectors=vectors, model="dimension-check", dimensions=dimensions, provider="deterministic")
    load_eval_script().validate_batch("embeddings", batch, expected_count)


def evaluate_gold_set(
    gold_set: EmbeddingEvalGoldSet,
    *,
    embedding_client: EmbeddingEvalClient,
    qdrant_indexer: EmbeddingEvalIndexer,
    provider: str,
    collection_prefix: str = "eval",
    top_k: int = 2,
) -> GoldSetEvaluationResult:
    query_texts = [query["text"] for query in gold_set["queries"]]
    query_batches = embedding_client.embed_texts(query_texts)

    collection = derive_evaluation_collection(
        collection_prefix,
        provider,
        query_batches.model,
        query_batches.dimensions,
    )
    qdrant_indexer.ensure_collection(query_batches.dimensions)

    if len(query_batches.vectors) != len(query_texts):
        raise ValueError(f"queries vector dimensions count={len(query_batches.vectors)}, expected {len(query_texts)}")
    for index, vector in enumerate(query_batches.vectors):
        if len(vector) != query_batches.dimensions:
            raise ValueError(f"queries vector dimensions index={index} dimensions={len(vector)}, expected {query_batches.dimensions}")

    query_metrics: list[EvaluationQueryMetric] = []
    hit_at_1_count = 0
    hit_at_top_k_count = 0
    reciprocal_ranks: list[float] = []

    for query, query_vector in zip(gold_set["queries"], query_batches.vectors, strict=True):
        relevant_ids = query["expected_hits"]
        hits = qdrant_indexer.search_points(query_vector, top_k, collection)
        retrieved_ids = [str(hit.payload.get("document_id", hit.id)) for hit in hits]
        first_relevant_rank = next((rank for rank, document_id in enumerate(retrieved_ids, start=1) if document_id in relevant_ids), None)

        if retrieved_ids and retrieved_ids[0] in relevant_ids:
            hit_at_1_count += 1
        if first_relevant_rank is not None and first_relevant_rank <= top_k:
            hit_at_top_k_count += 1
            reciprocal_ranks.append(1.0 / first_relevant_rank)
        query_metrics.append(
            EvaluationQueryMetric(
                query_id=query["id"],
                retrieved_ids=retrieved_ids,
                first_relevant_rank=first_relevant_rank,
            )
        )

    query_count = len(query_metrics)
    metrics = {
        "hit_rate_at_1": round(hit_at_1_count / query_count, 6),
        "hit_rate_at_top_k": round(hit_at_top_k_count / query_count, 6),
        "mean_reciprocal_rank": round(sum(reciprocal_ranks) / query_count, 6),
    }
    identity = EvaluationCollectionIdentity(
        provider=provider,
        model=query_batches.model,
        dimensions=query_batches.dimensions,
        collection=collection,
    )
    return GoldSetEvaluationResult(identity=identity, metrics=metrics, query_metrics=query_metrics)


def evaluate_with_fake_provider(
    *,
    monkeypatch: MonkeyPatchLike,
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
        model: str
        dimensions: int

        def __init__(self) -> None:
            self.model = model
            self.dimensions = dimensions

        def embed_texts(self, texts: Sequence[str]) -> EmbeddingBatch:
            vectors = document_vectors if len(list(texts)) == len(fixture["documents"]) else query_vectors
            return EmbeddingBatch(vectors=vectors, model=model, dimensions=dimensions, provider=provider)

    class FakeSettings:
        qdrant_collection: str

        def __init__(self, **kwargs: object) -> None:
            settings_seen.append(dict(kwargs))
            self.qdrant_collection = str(kwargs["QDRANT_COLLECTION"])

    class FakeHttpQdrantIndexer:
        collection: str

        def __init__(self, settings: FakeSettings) -> None:
            self.collection = settings.qdrant_collection

        def ensure_collection(self, ensured_dimensions: int) -> None:
            ensured.append((self.collection, ensured_dimensions))

    def build_fake_client(spec: ProviderSpecLike) -> EmbeddingEvalClient:
        _ = spec
        return FakeClient()

    monkeypatch.setitem(sys.modules, "app.config", type("ConfigModule", (), {"Settings": FakeSettings}))
    monkeypatch.setitem(sys.modules, "app.qdrant_index", type("QdrantModule", (), {"HttpQdrantIndexer": FakeHttpQdrantIndexer}))
    monkeypatch.setattr(script, "build_embedding_client", build_fake_client)

    provider_spec = ProviderSpecLike(provider=provider, model=model, dimensions=dimensions)
    run = script.evaluate_provider(
        fixture,
        provider_spec,
        argparse.Namespace(
            collection_prefix=collection_prefix,
            ensure_qdrant_collection=True,
            qdrant_url="http://qdrant.test",
            top_k=top_k,
        ),
    )
    result = EvaluationPrimitiveResult(
        identity=cast(dict[str, object], run["identity"]),
        metrics=cast(dict[str, float], run["metrics"]),
        queries=cast(list[dict[str, object]], run["queries"]),
    )
    return result, ensured, settings_seen
