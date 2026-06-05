from dataclasses import dataclass
import re

from app.embeddings import EmbeddingClient
from app.qdrant_index import QdrantIndexer, QdrantSearchHit
from fixtures.embedding_eval.gold_fixture import EmbeddingEvalGoldSet


@dataclass(frozen=True)
class EvaluationIdentity:
    provider: str
    model: str
    dimensions: int
    collection: str


@dataclass(frozen=True)
class QueryMetric:
    query_id: str
    expected_hits: list[str]
    retrieved_ids: list[str]
    first_relevant_rank: int | None


@dataclass(frozen=True)
class EvaluationResult:
    identity: EvaluationIdentity
    metrics: dict[str, float]
    query_metrics: list[QueryMetric]


def derive_evaluation_collection(prefix: str, provider: str, model: str, dimensions: int) -> str:
    if not provider.strip() or not model.strip() or dimensions < 1:
        raise ValueError("Evaluation collection must be derived from provider, model, and dimensions")
    token = _safe_collection_token(f"{provider}-{model}-{dimensions}")
    prefix_token = _safe_collection_token(prefix)
    collection = f"{prefix_token}_{token}"
    if collection == prefix:
        raise ValueError("Evaluation collection must be derived from provider, model, and dimensions")
    return collection


def evaluate_gold_set(
    gold_set: EmbeddingEvalGoldSet,
    *,
    embedding_client: EmbeddingClient,
    qdrant_indexer: QdrantIndexer,
    provider: str,
    collection_prefix: str,
    top_k: int,
) -> EvaluationResult:
    if top_k < 1:
        raise ValueError("top_k must be at least 1")

    query_texts = [query["text"] for query in gold_set["queries"]]
    query_embeddings = embedding_client.embed_texts(query_texts)
    if len(query_embeddings.vectors) != len(query_texts):
        raise ValueError("Embedding response did not match query count")

    collection = derive_evaluation_collection(
        collection_prefix,
        provider,
        query_embeddings.model,
        query_embeddings.dimensions,
    )
    qdrant_indexer.ensure_collection(query_embeddings.dimensions)

    query_metrics: list[QueryMetric] = []
    for query, vector in zip(gold_set["queries"], query_embeddings.vectors, strict=True):
        if len(vector) != query_embeddings.dimensions:
            raise ValueError("Embedding vector dimensions did not match metadata")
        hits = qdrant_indexer.search_points(vector, top_k, collection=collection)
        query_metrics.append(_metric_for_query(query["id"], query["expected_hits"], hits))

    return EvaluationResult(
        identity=EvaluationIdentity(
            provider=provider,
            model=query_embeddings.model,
            dimensions=query_embeddings.dimensions,
            collection=collection,
        ),
        metrics=_aggregate_metrics(query_metrics, top_k=top_k),
        query_metrics=query_metrics,
    )


def _metric_for_query(query_id: str, expected_hits: list[str], hits: list[QdrantSearchHit]) -> QueryMetric:
    retrieved_ids = [str(hit.payload.get("document_id", hit.id)) for hit in hits]
    first_relevant_rank = next(
        (rank for rank, document_id in enumerate(retrieved_ids, start=1) if document_id in expected_hits),
        None,
    )
    return QueryMetric(
        query_id=query_id,
        expected_hits=expected_hits,
        retrieved_ids=retrieved_ids,
        first_relevant_rank=first_relevant_rank,
    )


def _aggregate_metrics(query_metrics: list[QueryMetric], *, top_k: int) -> dict[str, float]:
    if not query_metrics:
        return {"hit_rate_at_1": 0.0, "hit_rate_at_top_k": 0.0, "mean_reciprocal_rank": 0.0}

    total = float(len(query_metrics))
    hit_at_1 = sum(1 for metric in query_metrics if metric.first_relevant_rank == 1) / total
    hit_at_top_k = sum(
        1 for metric in query_metrics if metric.first_relevant_rank is not None and metric.first_relevant_rank <= top_k
    ) / total
    mean_reciprocal_rank = sum(
        0.0 if metric.first_relevant_rank is None else 1.0 / metric.first_relevant_rank for metric in query_metrics
    ) / total
    return {
        "hit_rate_at_1": hit_at_1,
        "hit_rate_at_top_k": hit_at_top_k,
        "mean_reciprocal_rank": mean_reciprocal_rank,
    }


def _safe_collection_token(value: str) -> str:
    token = re.sub(r"[^a-zA-Z0-9_-]+", "-", value.strip()).strip("-_").lower()
    if not token:
        raise ValueError("Collection token cannot be empty")
    return token
