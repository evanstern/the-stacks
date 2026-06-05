#!/usr/bin/env python3
# pyright: reportMissingImports=false
"""Evaluate embedding providers against a small gold retrieval fixture.

The script keeps benchmark orchestration outside the app runtime while still
using the runtime embedding provider seam for real provider/model execution.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import sys
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import NoReturn, Protocol, TypedDict, cast


DEFAULT_FIXTURE = Path(__file__).resolve().parents[1] / "apps/api/tests/fixtures/embeddings/gold.fixture.json"
API_APP_PATH = Path(__file__).resolve().parents[1] / "apps/api"
DEFAULT_QDRANT_URL = "http://localhost:6333"
DEFAULT_COLLECTION_PREFIX = "embedding_eval"
DETERMINISTIC_PROVIDER = "deterministic"
DETERMINISTIC_MODEL = "deterministic-fixture-v1"
DETERMINISTIC_DIMENSIONS = 8
OUTPUT_SCHEMA_VERSION = 1
SIMILARITY_METRIC = "cosine"
SCORE_PRECISION = 6


class FixtureDocument(TypedDict):
    id: str
    title: str
    text: str


class FixtureQuery(TypedDict):
    id: str
    text: str
    relevant_document_ids: list[str]


class GoldFixture(TypedDict):
    schema_version: int
    name: str
    documents: list[FixtureDocument]
    queries: list[FixtureQuery]


@dataclass(frozen=True)
class EmbeddingBatch:
    vectors: list[list[float]]
    model: str
    dimensions: int
    provider: str


class EmbeddingClient(Protocol):
    provider: str
    model: str
    dimensions: int

    def embed_texts(self, texts: Sequence[str]) -> EmbeddingBatch:
        raise NotImplementedError


@dataclass(frozen=True)
class ProviderSpec:
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


class DeterministicEmbeddingClient:
    provider: str = DETERMINISTIC_PROVIDER

    def __init__(self, model: str = DETERMINISTIC_MODEL, dimensions: int = DETERMINISTIC_DIMENSIONS) -> None:
        self.model: str = model
        self.dimensions: int = dimensions

    def embed_texts(self, texts: Sequence[str]) -> EmbeddingBatch:
        return EmbeddingBatch(
            vectors=[_deterministic_vector(text, self.dimensions) for text in texts],
            model=self.model,
            dimensions=self.dimensions,
            provider=self.provider,
        )


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    fixture = load_fixture(args.fixture)
    provider_specs = [parse_provider_spec(spec) for spec in args.provider]
    runs = [evaluate_provider(fixture, spec, args) for spec in provider_specs]

    report: dict[str, object] = {
        "schema_version": OUTPUT_SCHEMA_VERSION,
        "fixture": {
            "name": fixture["name"],
            "schema_version": fixture["schema_version"],
            "document_count": len(fixture["documents"]),
            "query_count": len(fixture["queries"]),
        },
        "run_config": {
            "provider_specs": [spec.label for spec in provider_specs],
            "top_k": args.top_k,
            "similarity_metric": SIMILARITY_METRIC,
            "score_precision": SCORE_PRECISION,
            "collection_prefix": args.collection_prefix,
            "ensure_qdrant_collection": args.ensure_qdrant_collection,
        },
        "runs": runs,
    }

    if args.format == "json":
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        print(render_text_report(report))
    return 0


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate embedding providers against gold retrieval fixtures.")
    parser.add_argument("--fixture", type=Path, default=DEFAULT_FIXTURE, help=f"Gold fixture JSON path; defaults to {DEFAULT_FIXTURE}.")
    parser.add_argument(
        "--provider",
        action="append",
        default=None,
        help=(
            "Provider spec provider[:model[:dimensions]]. Repeat to compare multiple providers. "
            "Use deterministic for fixture-only local verification."
        ),
    )
    parser.add_argument("--format", choices=("json", "text"), default="json", help="Output format.")
    parser.add_argument("--top-k", type=int, default=3, help="Ranking depth to include in each query result.")
    parser.add_argument("--collection-prefix", default=DEFAULT_COLLECTION_PREFIX, help="Qdrant collection prefix for dimension-safe identities.")
    parser.add_argument("--qdrant-url", default=None, help="Qdrant URL used when --ensure-qdrant-collection is set.")
    parser.add_argument(
        "--ensure-qdrant-collection",
        action="store_true",
        help="Call the runtime Qdrant dimension guard for each provider collection before reporting.",
    )
    parsed = parser.parse_args(argv)
    parsed.provider = parsed.provider or [DETERMINISTIC_PROVIDER]
    if parsed.top_k < 1:
        fail("--top-k must be at least 1")
    return parsed


def load_fixture(path: Path) -> GoldFixture:
    payload: object
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        fail(f"fixture not found: {path}")
    except json.JSONDecodeError as exc:
        fail(f"fixture is not valid JSON: {path}: {exc}")

    fixture = cast(GoldFixture, payload)
    if fixture.get("schema_version") != 1:
        fail(f"fixture schema_version must be 1: {path}")
    documents = fixture.get("documents", [])
    queries = fixture.get("queries", [])
    if not documents:
        fail("fixture must include at least one document")
    if not queries:
        fail("fixture must include at least one query")

    document_ids = [document.get("id") for document in documents]
    duplicate_document_ids = sorted({document_id for document_id in document_ids if document_ids.count(document_id) > 1})
    if duplicate_document_ids:
        fail(f"fixture document ids must be unique: {', '.join(duplicate_document_ids)}")
    document_id_set = set(document_ids)
    for query in queries:
        missing = sorted(set(query.get("relevant_document_ids", [])).difference(document_id_set))
        if missing:
            fail(f"query {query.get('id')} references missing relevant_document_ids: {', '.join(missing)}")
    return fixture


def parse_provider_spec(raw: str) -> ProviderSpec:
    parts = raw.split(":")
    if len(parts) > 3 or not parts[0].strip():
        fail(f"invalid provider spec: {raw}")
    try:
        dimensions = int(parts[2]) if len(parts) == 3 and parts[2] else None
    except ValueError:
        fail(f"provider dimensions must be an integer: {raw}")
    if dimensions is not None and dimensions < 1:
        fail(f"provider dimensions must be at least 1: {raw}")
    return ProviderSpec(provider=parts[0].strip(), model=parts[1].strip() if len(parts) >= 2 and parts[1] else None, dimensions=dimensions)


def evaluate_provider(fixture: GoldFixture, spec: ProviderSpec, args: argparse.Namespace) -> dict[str, object]:
    client = build_embedding_client(spec)
    document_texts = [document["text"] for document in fixture["documents"]]
    query_texts = [query["text"] for query in fixture["queries"]]
    document_batch = client.embed_texts(document_texts)
    query_batch = client.embed_texts(query_texts)
    validate_batch("documents", document_batch, len(document_texts))
    validate_batch("queries", query_batch, len(query_texts))
    if document_batch.dimensions != query_batch.dimensions:
        fail(
            f"provider {spec.label} returned document dimensions={document_batch.dimensions} "
            f"and query dimensions={query_batch.dimensions}"
        )

    collection = collection_name(args.collection_prefix, document_batch.provider, document_batch.model, document_batch.dimensions)
    if args.ensure_qdrant_collection:
        qdrant_url = args.qdrant_url or os.environ.get("QDRANT_URL") or DEFAULT_QDRANT_URL
        add_api_import_path()
        from app.config import Settings
        from app.qdrant_index import HttpQdrantIndexer

        settings = Settings(QDRANT_URL=qdrant_url, QDRANT_COLLECTION=collection)
        HttpQdrantIndexer(settings).ensure_collection(document_batch.dimensions)

    query_results = rank_queries(fixture, document_batch.vectors, query_batch.vectors, args.top_k)
    return {
        "identity": {
            "provider_spec": spec.label,
            "provider": document_batch.provider,
            "model": document_batch.model,
            "dimensions": document_batch.dimensions,
            "collection": collection,
        },
        "provider": document_batch.provider,
        "model": document_batch.model,
        "dimensions": document_batch.dimensions,
        "collection": collection,
        "document_count": len(document_texts),
        "query_count": len(query_texts),
        "metrics": summarize_metrics(query_results),
        "queries": query_results,
    }


def build_embedding_client(spec: ProviderSpec) -> EmbeddingClient:
    provider = spec.provider.strip().lower()
    if provider == DETERMINISTIC_PROVIDER:
        return DeterministicEmbeddingClient(model=spec.model or DETERMINISTIC_MODEL, dimensions=spec.dimensions or DETERMINISTIC_DIMENSIONS)

    settings_kwargs: dict[str, object] = {"EMBEDDING_PROVIDER": provider}
    if provider == "openai":
        if spec.model:
            settings_kwargs["OPENAI_EMBEDDING_MODEL"] = spec.model
        if spec.dimensions is not None:
            settings_kwargs["OPENAI_EMBEDDING_DIMENSIONS"] = spec.dimensions
    elif provider in {"huggingface", "hf", "sentence-transformers", "sentence_transformers"}:
        if spec.model:
            settings_kwargs["HUGGINGFACE_EMBEDDING_MODEL"] = spec.model
        if spec.dimensions is not None:
            settings_kwargs["HUGGINGFACE_EMBEDDING_DIMENSIONS"] = spec.dimensions
    else:
        fail(f"unsupported embedding provider: {spec.provider}")
    return runtime_embedding_client(settings_kwargs)


def runtime_embedding_client(settings_kwargs: dict[str, object]) -> EmbeddingClient:
    add_api_import_path()
    from app.config import Settings
    from app.embeddings import get_embedding_client

    return cast(EmbeddingClient, cast(object, get_embedding_client(Settings(**settings_kwargs))))


def add_api_import_path() -> None:
    api_path = str(API_APP_PATH)
    if api_path not in sys.path:
        sys.path.insert(0, api_path)


def validate_batch(label: str, batch: EmbeddingBatch, expected_count: int) -> None:
    if len(batch.vectors) != expected_count:
        fail(f"{label} embedding count={len(batch.vectors)}, expected {expected_count}")
    for index, vector in enumerate(batch.vectors):
        if len(vector) != batch.dimensions:
            fail(f"{label} embedding index={index} dimensions={len(vector)}, expected {batch.dimensions}")


def rank_queries(
    fixture: GoldFixture,
    document_vectors: Sequence[list[float]],
    query_vectors: Sequence[list[float]],
    top_k: int,
) -> list[dict[str, object]]:
    documents = fixture["documents"]
    results: list[dict[str, object]] = []
    for query, query_vector in zip(fixture["queries"], query_vectors, strict=True):
        scored = [
            {
                "document_id": document["id"],
                "score": round(cosine_similarity(query_vector, document_vector), SCORE_PRECISION),
            }
            for document, document_vector in zip(documents, document_vectors, strict=True)
        ]
        ranking = sorted(scored, key=lambda item: (-cast(float, item["score"]), cast(str, item["document_id"])))
        relevant = set(query["relevant_document_ids"])
        first_relevant_rank = next(
            (rank for rank, item in enumerate(ranking, start=1) if cast(str, item["document_id"]) in relevant),
            None,
        )
        top_ranked = ranking[:top_k]
        hit_at_top_k = first_relevant_rank is not None and first_relevant_rank <= top_k
        results.append(
            {
                "query_id": query["id"],
                "expected_document_ids": query["relevant_document_ids"],
                "top_document_id": top_ranked[0]["document_id"],
                "top_score": top_ranked[0]["score"],
                "hit_at_1": top_ranked[0]["document_id"] in relevant,
                "hit_at_top_k": hit_at_top_k,
                "first_relevant_rank": first_relevant_rank,
                "ranking": top_ranked,
            }
        )
    return results


def summarize_metrics(query_results: Sequence[dict[str, object]]) -> dict[str, float]:
    query_count = len(query_results)
    hit_count = sum(1 for result in query_results if result["hit_at_1"])
    hit_at_top_k_count = sum(1 for result in query_results if result["hit_at_top_k"])
    reciprocal_ranks = [
        1.0 / cast(int, result["first_relevant_rank"])
        for result in query_results
        if result["first_relevant_rank"] is not None
    ]
    return {
        "hit_rate_at_1": round(hit_count / query_count, 6),
        "hit_rate_at_top_k": round(hit_at_top_k_count / query_count, 6),
        "mean_reciprocal_rank": round(sum(reciprocal_ranks) / query_count, 6),
    }


def collection_name(prefix: str, provider: str, model: str, dimensions: int) -> str:
    identity = f"{provider}-{model}-{dimensions}"
    slug = re.sub(r"[^a-zA-Z0-9_-]+", "_", identity).strip("_").lower()
    digest = hashlib.sha256(identity.encode("utf-8")).hexdigest()[:8]
    return f"{prefix}_{slug}_{digest}"


def render_text_report(report: dict[str, object]) -> str:
    fixture = cast(dict[str, object], report["fixture"])
    run_config = cast(dict[str, object], report["run_config"])
    runs = cast(Sequence[dict[str, object]], report["runs"])
    lines = [
        f"Embedding evaluation: {fixture['name']} ({fixture['document_count']} documents, {fixture['query_count']} queries)",
        f"Run config: top_k={run_config['top_k']} similarity={run_config['similarity_metric']} score_precision={run_config['score_precision']}",
        "",
    ]
    for run in runs:
        metrics = cast(dict[str, float], run["metrics"])
        lines.append(f"Provider: {run['provider']} model={run['model']} dimensions={run['dimensions']}")
        lines.append(f"Collection: {run['collection']}")
        lines.append(
            "Metrics: "
            f"hit@1={metrics['hit_rate_at_1']:.6f} "
            f"hit@top_k={metrics['hit_rate_at_top_k']:.6f} "
            f"mrr={metrics['mean_reciprocal_rank']:.6f}"
        )
        for query in cast(Sequence[dict[str, object]], run["queries"]):
            lines.append(
                f"  {query['query_id']}: top={query['top_document_id']} "
                f"score={cast(float, query['top_score']):.6f} "
                f"first_relevant_rank={query['first_relevant_rank']}"
            )
        lines.append("")
    return "\n".join(lines).rstrip()


def cosine_similarity(left: Sequence[float], right: Sequence[float]) -> float:
    numerator = sum(a * b for a, b in zip(left, right, strict=True))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm == 0.0 or right_norm == 0.0:
        return 0.0
    return numerator / (left_norm * right_norm)


def _deterministic_vector(text: str, dimensions: int) -> list[float]:
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    return [((digest[index] / 255.0) * 2.0) - 1.0 for index in range(dimensions)]


def fail(message: str) -> NoReturn:
    print(f"[eval-embeddings] ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


if __name__ == "__main__":
    raise SystemExit(main())
