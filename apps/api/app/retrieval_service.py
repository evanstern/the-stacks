import json
from collections.abc import Sequence
from dataclasses import dataclass, field
from pathlib import PurePosixPath
from typing import cast
from urllib.parse import quote

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.embeddings import EmbeddingClient
from app.models import DocumentChunk, IndexedChunk, RetrievalHit, RetrievalRun, utcnow
from app.qdrant_index import QdrantIndexer, QdrantSearchHit
from app.version_lifecycle import DEFAULT_ACTIVE_POINTER_NAME, resolve_runtime_context


@dataclass(frozen=True)
class RetrievalScope:
    qdrant_collection: str
    pointer_name: str = DEFAULT_ACTIVE_POINTER_NAME
    runtime_version_id: str | None = None
    source: str = "settings_fallback"

    def __post_init__(self) -> None:
        if not self.qdrant_collection.strip():
            raise ValueError("Retrieval scope requires a Qdrant collection")
        if not self.pointer_name.strip():
            raise ValueError("Retrieval scope requires a pointer name")
        if not self.source.strip():
            raise ValueError("Retrieval scope requires a source")

    def trace_metadata(self) -> dict[str, object]:
        metadata: dict[str, object] = {
            "qdrant_collection": self.qdrant_collection,
            "pointer_name": self.pointer_name,
            "scope_source": self.source,
        }
        if self.runtime_version_id is not None:
            metadata["runtime_version_id"] = self.runtime_version_id
        return metadata


@dataclass(frozen=True)
class RetrievalCandidate:
    chunk_id: str
    content: str
    score: float
    metadata: dict[str, object]


@dataclass(frozen=True)
class RetrievalCitation:
    chunk_id: str
    label: str
    metadata: dict[str, object]


@dataclass(frozen=True)
class RetrievalTrace:
    query_embedding_model: str
    query_embedding_dimensions: int
    requested_limit: int
    min_score: float
    top_k: int
    raw_hit_count: int
    selected_candidate_count: int
    filtered_low_score_count: int
    filtered_missing_chunk_count: int
    deduplicated_count: int
    scope: RetrievalScope

    def metadata(self) -> dict[str, object]:
        return {
            **self.scope.trace_metadata(),
            "query_embedding_model": self.query_embedding_model,
            "query_embedding_dimensions": self.query_embedding_dimensions,
            "requested_limit": self.requested_limit,
            "retrieval_min_score": self.min_score,
            "retrieval_top_k": self.top_k,
            "raw_hit_count": self.raw_hit_count,
            "selected_context_count": self.selected_candidate_count,
            "filtered_low_score_count": self.filtered_low_score_count,
            "filtered_missing_chunk_count": self.filtered_missing_chunk_count,
            "deduplicated_count": self.deduplicated_count,
        }


@dataclass(frozen=True)
class RetrievalResult:
    candidates: list[RetrievalCandidate]
    citations: list[RetrievalCitation]
    trace: RetrievalTrace
    weak_result: bool
    weak_reasons: list[str] = field(default_factory=list)

    def persistence_metadata(self) -> dict[str, object]:
        return retrieval_persistence_metadata(self)


@dataclass(frozen=True)
class CandidateLookupResult:
    hits: list[QdrantSearchHit]
    requested_limit: int


@dataclass(frozen=True)
class CandidateRankingResult:
    candidates: list[RetrievalCandidate]
    filtered_low_score_count: int
    filtered_missing_chunk_count: int
    deduplicated_count: int


def resolve_retrieval_scope(db: Session, settings: Settings) -> RetrievalScope:
    try:
        runtime = resolve_runtime_context(db=db, pointer_name=DEFAULT_ACTIVE_POINTER_NAME)
    except ValueError as exc:
        if str(exc) == "Active runtime version pointer is not configured":
            return RetrievalScope(qdrant_collection=settings.qdrant_collection)
        raise
    return RetrievalScope(
        qdrant_collection=runtime.qdrant_collection,
        pointer_name=DEFAULT_ACTIVE_POINTER_NAME,
        runtime_version_id=runtime.version_id,
        source="active_runtime",
    )


class RetrievalService:
    def __init__(
        self,
        db: Session,
        embedding_client: EmbeddingClient,
        qdrant_indexer: QdrantIndexer,
        settings: Settings,
    ) -> None:
        self.db: Session = db
        self.embedding_client: EmbeddingClient = embedding_client
        self.qdrant_indexer: QdrantIndexer = qdrant_indexer
        self.settings: Settings = settings

    def retrieve(self, query: str, scope: RetrievalScope) -> RetrievalResult:
        retrieval_scope = scope
        embedding_batch = self.embedding_client.embed_texts([query])
        embedding = embedding_batch.vectors[0]

        lookup = CandidateLookupAdapter(self.qdrant_indexer, self.settings).lookup(embedding, retrieval_scope)
        ranking = CandidateRankingAdapter(self.db, self.settings).rank(lookup.hits, retrieval_scope)

        weak_reasons: list[str] = []
        if not lookup.hits:
            weak_reasons.append("empty_result")
        if not ranking.candidates:
            weak_reasons.append("no_candidates")
        if ranking.filtered_low_score_count and not ranking.candidates:
            weak_reasons.append("all_candidates_below_min_score")
        if ranking.filtered_missing_chunk_count and not ranking.candidates:
            weak_reasons.append("unavailable_data")

        trace = RetrievalTrace(
            query_embedding_model=embedding_batch.model,
            query_embedding_dimensions=embedding_batch.dimensions,
            requested_limit=lookup.requested_limit,
            min_score=self.settings.retrieval_min_score,
            top_k=self.settings.retrieval_top_k,
            raw_hit_count=len(lookup.hits),
            selected_candidate_count=len(ranking.candidates),
            filtered_low_score_count=ranking.filtered_low_score_count,
            filtered_missing_chunk_count=ranking.filtered_missing_chunk_count,
            deduplicated_count=ranking.deduplicated_count,
            scope=retrieval_scope,
        )
        return RetrievalResult(
            candidates=ranking.candidates,
            citations=retrieval_citations_from_candidates(ranking.candidates),
            trace=trace,
            weak_result=not ranking.candidates,
            weak_reasons=weak_reasons,
        )


class CandidateLookupAdapter:
    def __init__(self, qdrant_indexer: QdrantIndexer, settings: Settings) -> None:
        self.qdrant_indexer: QdrantIndexer = qdrant_indexer
        self.settings: Settings = settings

    def lookup(self, embedding: list[float], scope: RetrievalScope) -> CandidateLookupResult:
        requested_limit = retrieval_overfetch_limit(self.settings)
        hits = self.qdrant_indexer.search_points(
            embedding,
            requested_limit,
            collection=scope.qdrant_collection,
        )
        return CandidateLookupResult(hits=hits, requested_limit=requested_limit)


class CandidateRankingAdapter:
    def __init__(self, db: Session, settings: Settings) -> None:
        self.db: Session = db
        self.settings: Settings = settings

    def rank(self, hits: Sequence[QdrantSearchHit], scope: RetrievalScope) -> CandidateRankingResult:
        candidates: list[RetrievalCandidate] = []
        seen_context_keys: set[tuple[str, ...]] = set()
        filtered_low_score_count = 0
        filtered_missing_chunk_count = 0
        deduplicated_count = 0

        for hit in hits:
            candidate = retrieval_candidate_from_hit(self.db, hit, scope)
            if candidate is None:
                filtered_missing_chunk_count += 1
                continue
            if candidate.score < self.settings.retrieval_min_score:
                filtered_low_score_count += 1
                continue
            context_key = retrieval_candidate_identity_key(candidate)
            if context_key in seen_context_keys:
                deduplicated_count += 1
                continue
            seen_context_keys.add(context_key)
            candidates.append(candidate)
            if len(candidates) >= self.settings.retrieval_top_k:
                break

        return CandidateRankingResult(
            candidates=candidates,
            filtered_low_score_count=filtered_low_score_count,
            filtered_missing_chunk_count=filtered_missing_chunk_count,
            deduplicated_count=deduplicated_count,
        )


def retrieval_overfetch_limit(settings: Settings) -> int:
    return max(settings.retrieval_top_k * 10, settings.retrieval_top_k + 25)


def retrieval_candidate_from_hit(db: Session, hit: QdrantSearchHit, scope: RetrievalScope) -> RetrievalCandidate | None:
    chunk_id = hit.payload.get("chunk_id")
    if not isinstance(chunk_id, str):
        return None
    if not _chunk_indexed_in_scope(db, chunk_id, scope):
        return None
    chunk = db.get(DocumentChunk, chunk_id)
    if chunk is None:
        return None
    metadata = cast(dict[str, object], json.loads(chunk.metadata_json))
    metadata["content_hash"] = chunk.content_hash
    metadata.update(hit.payload)
    return RetrievalCandidate(chunk_id=chunk.id, content=chunk.content, score=hit.score, metadata=metadata)


def _chunk_indexed_in_scope(db: Session, chunk_id: str, scope: RetrievalScope) -> bool:
    indexed_chunk_id = db.scalar(
        select(IndexedChunk.id)
        .where(IndexedChunk.document_chunk_id == chunk_id)
        .where(IndexedChunk.qdrant_collection == scope.qdrant_collection)
        .limit(1)
    )
    return indexed_chunk_id is not None


def retrieval_candidate_identity_key(candidate: RetrievalCandidate) -> tuple[str, ...]:
    metadata = candidate.metadata
    source_span_key = [
        _retrieval_identity_part(metadata, "source_sha256"),
        _retrieval_identity_part(metadata, "start_char"),
        _retrieval_identity_part(metadata, "end_char"),
    ]
    if all(source_span_key):
        return tuple(part for part in source_span_key if part)
    primary_key = [
        *source_span_key,
        _retrieval_identity_part(metadata, "chunk_index"),
    ]
    if all(primary_key):
        return tuple(part for part in primary_key if part)
    fallback_key = [
        _retrieval_identity_part(metadata, "content_hash"),
        _retrieval_identity_part(metadata, "source_filename"),
        _retrieval_identity_part(metadata, "section_heading"),
        f"content={normalize_retrieval_content(candidate.content)}",
    ]
    return tuple(part for part in fallback_key if part)


def normalize_retrieval_content(content: str) -> str:
    return " ".join(content.split())


def retrieval_citations_from_candidates(candidates: Sequence[RetrievalCandidate]) -> list[RetrievalCitation]:
    return [
        RetrievalCitation(
            chunk_id=candidate.chunk_id,
            label=f"[{index}]",
            metadata=citation_metadata_from_candidate(candidate),
        )
        for index, candidate in enumerate(candidates, start=1)
    ]


def citation_metadata_from_candidate(candidate: RetrievalCandidate) -> dict[str, object]:
    metadata = _public_citation_metadata(candidate.metadata)
    metadata["cited_text"] = candidate.content
    if metadata.get("source_type") == "archived_webpage":
        metadata = _archive_citation_metadata(metadata, candidate.content)
    return metadata


def citation_metadata_by_chunk_id(citations: Sequence[RetrievalCitation]) -> dict[str, dict[str, object]]:
    return {citation.chunk_id: citation.metadata for citation in citations}


def retrieval_persistence_metadata(result: RetrievalResult) -> dict[str, object]:
    trace = result.trace
    candidate_labels = {citation.chunk_id: citation.label for citation in result.citations}
    return {
        **trace.metadata(),
        "weak_reasons": list(result.weak_reasons),
        "trace": {
            "scope": trace.scope.trace_metadata(),
            "query_embedding": {
                "model": trace.query_embedding_model,
                "dimensions": trace.query_embedding_dimensions,
            },
            "limits": {
                "requested_limit": trace.requested_limit,
                "retrieval_min_score": trace.min_score,
                "retrieval_top_k": trace.top_k,
            },
            "counts": {
                "raw_hits": trace.raw_hit_count,
                "selected_candidates": trace.selected_candidate_count,
                "filtered_low_score": trace.filtered_low_score_count,
                "filtered_missing_chunk": trace.filtered_missing_chunk_count,
                "deduplicated": trace.deduplicated_count,
            },
            "candidates": [
                {
                    "rank": rank,
                    "document_chunk_id": candidate.chunk_id,
                    "score": _score_text(candidate.score),
                    "citation_label": candidate_labels.get(candidate.chunk_id),
                }
                for rank, candidate in enumerate(result.candidates, start=1)
            ],
            "citation_choices": [
                {
                    "label": citation.label,
                    "document_chunk_id": citation.chunk_id,
                }
                for citation in result.citations
            ],
        },
    }


def retrieval_hit_metadata(candidate: RetrievalCandidate, citation_metadata: dict[str, object], rank: int) -> dict[str, object]:
    return {
        **citation_metadata,
        "retrieval_rank": rank,
        "retrieval_score": _score_text(candidate.score),
    }


def record_retrieval_hits(db: Session, retrieval_run: RetrievalRun, result: RetrievalResult) -> None:
    citation_metadata = citation_metadata_by_chunk_id(result.citations)
    for rank, candidate in enumerate(result.candidates, start=1):
        db.add(
            RetrievalHit(
                retrieval_run_id=retrieval_run.id,
                document_chunk_id=candidate.chunk_id,
                rank=rank,
                score=_score_text(candidate.score),
                metadata_json=json.dumps(
                    retrieval_hit_metadata(candidate, citation_metadata[candidate.chunk_id], rank),
                    sort_keys=True,
                    separators=(",", ":"),
                ),
                created_at=utcnow(),
            )
        )


def _score_text(score: float) -> str:
    return f"{score:.8f}"


def _archive_citation_metadata(metadata: dict[str, object], content: str) -> dict[str, object]:
    archive_metadata = _public_citation_metadata(metadata)
    source_id = _metadata_text(metadata, "archive_source_id")
    target_chunk_id = _metadata_text(metadata, "target_chunk_id")
    target_selector = _metadata_text(metadata, "target_selector")
    quote_text = _metadata_text(metadata, "quote") or content
    section_path = _semantic_section_path_text(archive_metadata)

    archive_metadata["source_type"] = "archived_webpage"
    archive_metadata["source_title"] = _archive_source_title(metadata)
    if source_id:
        archive_metadata["viewer_url"] = _archive_viewer_url(source_id, target_chunk_id, target_selector)
    if target_chunk_id:
        archive_metadata["target_chunk_id"] = target_chunk_id
    if target_selector:
        archive_metadata["target_selector"] = target_selector
    archive_metadata["quote"] = quote_text
    archive_metadata["section_path"] = section_path
    archive_metadata["cited_text"] = content
    return archive_metadata


def _public_citation_metadata(metadata: dict[str, object]) -> dict[str, object]:
    return {
        key: value
        for key, value in metadata.items()
        if key not in INTERNAL_CITATION_METADATA_KEYS and not _is_internal_value(value)
    }


def _semantic_section_path_text(metadata: dict[str, object]) -> list[str]:
    semantic_section = metadata.get("semantic_section")
    if not isinstance(semantic_section, dict):
        return []
    semantic_section_metadata = cast(dict[str, object], semantic_section)
    path_text = semantic_section_metadata.get("path_text")
    if not isinstance(path_text, list):
        return []
    path_parts = cast(list[object], path_text)
    return [str(part) for part in path_parts]


def _archive_source_title(metadata: dict[str, object]) -> str:
    for key in ("source_title", "document_title", "book_title", "source_filename"):
        value = _metadata_text(metadata, key)
        if value:
            return value
    return "Archived webpage"


def _archive_viewer_url(source_id: str, target_chunk_id: str | None, target_selector: str | None) -> str:
    target = target_chunk_id or _target_from_selector(target_selector)
    url = f"/records/sources/{quote(source_id, safe='')}/archive/viewer"
    if target:
        return f"{url}?target={quote(target, safe='')}"
    return url


def _target_from_selector(target_selector: str | None) -> str | None:
    if target_selector is None:
        return None
    selector = target_selector.strip()
    if selector.startswith("#"):
        return selector[1:]
    return None


def _metadata_text(metadata: dict[str, object], key: str) -> str | None:
    value = metadata.get(key)
    if not isinstance(value, str):
        return None
    text = value.strip()
    return text or None


def _is_internal_value(value: object) -> bool:
    if not isinstance(value, str):
        return False
    text = value.strip()
    if not text:
        return False
    if "Traceback (most recent call last)" in text:
        return True
    if text.startswith(("/", "file://")):
        return True
    parts = PurePosixPath(text).parts
    return "source-archives" in parts and ("original.zip" in parts or "original" in parts or "served" in parts)


INTERNAL_CITATION_METADATA_KEYS = {
    "archive_anchor_map_path",
    "archive_entry_path",
    "archive_manifest_path",
    "archive_original_dir",
    "archive_original_path",
    "archive_original_zip_path",
    "archive_primary_html_path",
    "archive_served_entry_path",
    "archive_served_html_path",
    "archive_storage_path",
    "jsonl_path",
    "raw_html_path",
    "rendered_html_path",
}


def _retrieval_identity_part(metadata: dict[str, object], key: str) -> str | None:
    value = metadata.get(key)
    if value is None:
        return None
    text = str(value).strip()
    return f"{key}={text}" if text else None
