import json
import os

from sqlalchemy.orm import Session

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

from app.config import Settings
from app.models import RuntimeVersion
from app.qdrant_index import QdrantSearchHit
from app.retrieval_service import (
    CandidateLookupAdapter,
    CandidateRankingAdapter,
    RetrievalCandidate,
    RetrievalScope,
    RetrievalService,
    resolve_retrieval_scope,
    retrieval_citations_from_candidates,
)
from app.version_lifecycle import DEFAULT_ACTIVE_POINTER_NAME, RuntimeVersionContext, VersionLifecycleService
from tests.fakes import FakeEmbeddingClient, FakeQdrantIndexer
from tests.rag_support import create_indexed_chunk
from tests.support import db_session


def test_retrieval_service_returns_normalized_result_shape_with_explicit_scope(db_session: Session) -> None:
    settings = Settings(RETRIEVAL_TOP_K=2, RETRIEVAL_MIN_SCORE=0.2, QDRANT_COLLECTION="base_chunks")
    chunk = create_indexed_chunk(db_session, "Ancient red dragons prefer volcanic lairs.", qdrant_collection="scoped_chunks")
    qdrant = FakeQdrantIndexer(
        collection="base_chunks",
        collection_search_hits={
            "base_chunks": [],
            "scoped_chunks": [QdrantSearchHit(id="point-1", score=0.91, payload={"chunk_id": chunk.id})],
        },
    )

    result = RetrievalService(db_session, FakeEmbeddingClient(), qdrant, settings).retrieve(
        "What do ancient red dragons prefer?",
        scope=RetrievalScope(qdrant_collection="scoped_chunks", source="test_scope"),
    )

    assert qdrant.search_requests == [([1.0, 1.0, 1.0, 1.0], 27, "scoped_chunks")]
    assert result.weak_result is False
    assert result.weak_reasons == []
    assert len(result.candidates) == 1
    candidate = result.candidates[0]
    assert candidate.chunk_id == chunk.id
    assert candidate.content == "Ancient red dragons prefer volcanic lairs."
    assert candidate.score == 0.91
    assert candidate.metadata["chunk_id"] == chunk.id
    assert candidate.metadata["content_hash"] == chunk.content_hash
    assert [(citation.chunk_id, citation.label) for citation in result.citations] == [(chunk.id, "[1]")]
    assert result.citations[0].metadata["source_filename"] == "sample.md"
    assert result.citations[0].metadata["cited_text"] == "Ancient red dragons prefer volcanic lairs."
    assert result.trace.scope.qdrant_collection == "scoped_chunks"
    assert result.trace.scope.source == "test_scope"
    assert result.trace.metadata() == {
        "qdrant_collection": "scoped_chunks",
        "pointer_name": DEFAULT_ACTIVE_POINTER_NAME,
        "scope_source": "test_scope",
        "query_embedding_model": "test-embedding-model",
        "query_embedding_dimensions": 4,
        "requested_limit": 27,
        "retrieval_min_score": 0.2,
        "retrieval_top_k": 2,
        "raw_hit_count": 1,
        "selected_context_count": 1,
        "filtered_low_score_count": 0,
        "filtered_missing_chunk_count": 0,
        "deduplicated_count": 0,
    }
    assert result.persistence_metadata()["trace"] == {
        "scope": {
            "qdrant_collection": "scoped_chunks",
            "pointer_name": DEFAULT_ACTIVE_POINTER_NAME,
            "scope_source": "test_scope",
        },
        "query_embedding": {"model": "test-embedding-model", "dimensions": 4},
        "limits": {"requested_limit": 27, "retrieval_min_score": 0.2, "retrieval_top_k": 2},
        "counts": {
            "raw_hits": 1,
            "selected_candidates": 1,
            "filtered_low_score": 0,
            "filtered_missing_chunk": 0,
            "deduplicated": 0,
        },
        "candidates": [
            {
                "rank": 1,
                "document_chunk_id": chunk.id,
                "score": "0.91000000",
                "citation_label": "[1]",
            }
        ],
        "citation_choices": [{"label": "[1]", "document_chunk_id": chunk.id}],
    }


def test_retrieval_service_scope_defaults_to_active_runtime_collection(db_session: Session) -> None:
    settings = Settings(RETRIEVAL_TOP_K=5, RETRIEVAL_MIN_SCORE=0.2, QDRANT_COLLECTION="base_chunks")
    runtime = _activate_runtime(db_session, settings, "dddddddd-dddd-4ddd-8ddd-dddddddddddd")
    chunk = create_indexed_chunk(
        db_session,
        "Active runtime content should be scoped explicitly.",
        qdrant_collection=runtime.qdrant_collection,
    )
    qdrant = FakeQdrantIndexer(
        collection="base_chunks",
        collection_search_hits={
            "base_chunks": [],
            runtime.qdrant_collection: [QdrantSearchHit(id="point-1", score=0.93, payload={"chunk_id": chunk.id})],
        },
    )

    scope = resolve_retrieval_scope(db_session, settings)
    result = RetrievalService(db_session, FakeEmbeddingClient(), qdrant, settings).retrieve("What is active?", scope)

    assert qdrant.search_requests == [([1.0, 1.0, 1.0, 1.0], 50, runtime.qdrant_collection)]
    assert result.trace.scope == RetrievalScope(
        qdrant_collection=runtime.qdrant_collection,
        pointer_name=DEFAULT_ACTIVE_POINTER_NAME,
        runtime_version_id=runtime.version_id,
        source="active_runtime",
    )
    assert result.trace.metadata()["runtime_version_id"] == runtime.version_id
    assert [candidate.chunk_id for candidate in result.candidates] == [chunk.id]


def test_retrieval_service_filters_hits_not_indexed_in_explicit_scope(db_session: Session) -> None:
    settings = Settings(RETRIEVAL_TOP_K=5, RETRIEVAL_MIN_SCORE=0.2, QDRANT_COLLECTION="base_chunks")
    runtime = _activate_runtime(db_session, settings, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee")
    base_chunk = create_indexed_chunk(
        db_session,
        "Base collection data must not pass active runtime scope validation.",
        qdrant_collection=settings.qdrant_collection,
    )
    qdrant = FakeQdrantIndexer(
        collection="base_chunks",
        collection_search_hits={
            runtime.qdrant_collection: [QdrantSearchHit(id="stale-point", score=0.99, payload={"chunk_id": base_chunk.id})],
        },
    )

    scope = resolve_retrieval_scope(db_session, settings)
    result = RetrievalService(db_session, FakeEmbeddingClient(), qdrant, settings).retrieve("Can stale data leak?", scope)

    assert qdrant.search_requests == [([1.0, 1.0, 1.0, 1.0], 50, runtime.qdrant_collection)]
    assert result.candidates == []
    assert result.weak_result is True
    assert result.weak_reasons == ["no_candidates", "unavailable_data"]
    assert result.trace.scope == scope
    assert result.trace.raw_hit_count == 1
    assert result.trace.filtered_missing_chunk_count == 1


def test_retrieval_service_marks_weak_results_and_trace_filter_reasons(db_session: Session) -> None:
    settings = Settings(RETRIEVAL_TOP_K=5, RETRIEVAL_MIN_SCORE=0.2)
    chunk = create_indexed_chunk(db_session, "Weak results should not become candidates.")
    qdrant = FakeQdrantIndexer(search_hits=[QdrantSearchHit(id="point-1", score=0.05, payload={"chunk_id": chunk.id})])

    result = RetrievalService(db_session, FakeEmbeddingClient(), qdrant, settings).retrieve(
        "What is weak?",
        RetrievalScope(qdrant_collection="thestacks_chunks"),
    )

    assert result.candidates == []
    assert result.citations == []
    assert result.weak_result is True
    assert result.weak_reasons == ["no_candidates", "all_candidates_below_min_score"]
    assert result.trace.raw_hit_count == 1
    assert result.trace.selected_candidate_count == 0
    assert result.trace.filtered_low_score_count == 1
    assert result.trace.filtered_missing_chunk_count == 0


def test_candidate_lookup_adapter_searches_explicit_scope_with_overfetch_limit() -> None:
    settings = Settings(RETRIEVAL_TOP_K=3, QDRANT_COLLECTION="base_chunks")
    hits = [QdrantSearchHit(id="point-1", score=0.9, payload={"chunk_id": "chunk-1"})]
    qdrant = FakeQdrantIndexer(collection="base_chunks", collection_search_hits={"scoped_chunks": hits})

    result = CandidateLookupAdapter(qdrant, settings).lookup(
        [0.1, 0.2, 0.3],
        RetrievalScope(qdrant_collection="scoped_chunks", source="test_scope"),
    )

    assert result.hits == hits
    assert result.requested_limit == 30
    assert qdrant.search_requests == [([0.1, 0.2, 0.3], 30, "scoped_chunks")]


def test_candidate_ranking_adapter_ranks_dedupes_and_trims_candidates(db_session: Session) -> None:
    settings = Settings(RETRIEVAL_TOP_K=2, RETRIEVAL_MIN_SCORE=0.2)
    first = create_indexed_chunk(db_session, "First high-scoring source span.", filename="first.md")
    duplicate = create_indexed_chunk(db_session, "Duplicate source span should be skipped.", filename="duplicate.md")
    low_score = create_indexed_chunk(db_session, "Low-score candidate should be filtered.", filename="low.md")
    second = create_indexed_chunk(db_session, "Second distinct candidate should survive.", filename="second.md")
    third = create_indexed_chunk(db_session, "Third distinct candidate should be trimmed.", filename="third.md")

    first.metadata_json = json.dumps(
        {**json.loads(first.metadata_json), "source_sha256": "shared-source", "start_char": 10, "end_char": 40},
        sort_keys=True,
    )
    duplicate.metadata_json = json.dumps(
        {**json.loads(duplicate.metadata_json), "source_sha256": "shared-source", "start_char": 10, "end_char": 40},
        sort_keys=True,
    )
    second.metadata_json = json.dumps(
        {**json.loads(second.metadata_json), "source_sha256": "second-source", "start_char": 50, "end_char": 80},
        sort_keys=True,
    )
    third.metadata_json = json.dumps(
        {**json.loads(third.metadata_json), "source_sha256": "third-source", "start_char": 90, "end_char": 120},
        sort_keys=True,
    )
    db_session.commit()

    result = CandidateRankingAdapter(db_session, settings).rank(
        [
            QdrantSearchHit(id="point-1", score=0.99, payload={"chunk_id": first.id}),
            QdrantSearchHit(id="point-duplicate", score=0.98, payload={"chunk_id": duplicate.id}),
            QdrantSearchHit(id="point-low", score=0.05, payload={"chunk_id": low_score.id}),
            QdrantSearchHit(id="point-missing", score=0.97, payload={"chunk_id": "missing-chunk"}),
            QdrantSearchHit(id="point-2", score=0.96, payload={"chunk_id": second.id}),
            QdrantSearchHit(id="point-3", score=0.95, payload={"chunk_id": third.id}),
        ],
        RetrievalScope(qdrant_collection="thestacks_chunks"),
    )

    assert [candidate.chunk_id for candidate in result.candidates] == [first.id, second.id]
    assert [candidate.score for candidate in result.candidates] == [0.99, 0.96]
    assert result.filtered_low_score_count == 1
    assert result.filtered_missing_chunk_count == 1
    assert result.deduplicated_count == 1


def test_candidate_ranking_adapter_returns_explicit_empty_result_for_empty_hits(db_session: Session) -> None:
    result = CandidateRankingAdapter(db_session, Settings(RETRIEVAL_TOP_K=2, RETRIEVAL_MIN_SCORE=0.2)).rank(
        [],
        RetrievalScope(qdrant_collection="thestacks_chunks"),
    )

    assert result.candidates == []
    assert result.filtered_low_score_count == 0
    assert result.filtered_missing_chunk_count == 0
    assert result.deduplicated_count == 0


def test_retrieval_citations_from_candidates_are_normalized() -> None:
    scope = RetrievalScope(qdrant_collection="test_chunks")
    candidates = [
        create_candidate("chunk-a", "A"),
        create_candidate("chunk-b", "B"),
    ]

    citations = retrieval_citations_from_candidates(candidates)

    assert scope.trace_metadata()["qdrant_collection"] == "test_chunks"
    assert [(citation.chunk_id, citation.label) for citation in citations] == [("chunk-a", "[1]"), ("chunk-b", "[2]")]
    assert citations[0].metadata == {"source_filename": "chunk-a.md", "cited_text": "A"}


def test_retrieval_citations_preserve_safe_non_archive_metadata_without_viewer_fields() -> None:
    candidate = RetrievalCandidate(
        chunk_id="chunk-plain",
        content="Plain goblins prefer caves.",
        score=0.8,
        metadata={
            "source_filename": "plain.html",
            "section_heading": "Bestiary",
            "raw_html_path": "/tmp/plain.html",
            "parser_log": "file:///srv/private/parser.log",
        },
    )

    citation = retrieval_citations_from_candidates([candidate])[0]

    assert citation.label == "[1]"
    assert citation.metadata == {
        "source_filename": "plain.html",
        "section_heading": "Bestiary",
        "cited_text": "Plain goblins prefer caves.",
    }
    assert "viewer_url" not in citation.metadata
    assert "target_chunk_id" not in citation.metadata
    assert "target_selector" not in citation.metadata


def test_retrieval_citations_assemble_archive_provenance_without_internal_paths() -> None:
    candidate = RetrievalCandidate(
        chunk_id="chunk-archive",
        content="Archive goblins prefer moonlit ruins.",
        score=0.95,
        metadata={
            "source_type": "archived_webpage",
            "archive_source_id": "source/with spaces",
            "source_title": "Moonlit Goblin Archive",
            "source_filename": "archive.zip",
            "target_chunk_id": "archive-target-123",
            "target_selector": "#source-chunk-archive-target-123",
            "quote": "Archive goblins prefer moonlit ruins.",
            "semantic_section": {"path_text": ["Bestiary", "Goblins"]},
            "archive_entry_path": "original/index.html",
            "archive_served_entry_path": "served/index.html",
            "archive_manifest_path": "source-archives/source-id/manifest.json",
            "archive_primary_html_path": "page.html",
            "raw_html_path": "/tmp/source-archives/source-id/original/index.html",
            "rendered_html_path": "file:///srv/private/rendered.html",
            "unexpected_internal_path": "source-archives/source-id/original/index.html",
            "traceback": "Traceback (most recent call last): boom",
        },
    )

    citation = retrieval_citations_from_candidates([candidate])[0]
    metadata = citation.metadata
    serialized = json.dumps(metadata, sort_keys=True)

    assert citation.chunk_id == "chunk-archive"
    assert citation.label == "[1]"
    assert metadata["source_type"] == "archived_webpage"
    assert metadata["source_title"] == "Moonlit Goblin Archive"
    assert metadata["viewer_url"] == "/records/sources/source%2Fwith%20spaces/archive/viewer?target=archive-target-123"
    assert metadata["target_chunk_id"] == "archive-target-123"
    assert metadata["target_selector"] == "#source-chunk-archive-target-123"
    assert metadata["quote"] == "Archive goblins prefer moonlit ruins."
    assert metadata["section_path"] == ["Bestiary", "Goblins"]
    assert metadata["cited_text"] == "Archive goblins prefer moonlit ruins."
    assert metadata["source_filename"] == "archive.zip"
    assert "archive_entry_path" not in metadata
    assert "archive_served_entry_path" not in metadata
    assert "archive_manifest_path" not in metadata
    assert "archive_primary_html_path" not in metadata
    assert "raw_html_path" not in metadata
    assert "rendered_html_path" not in metadata
    assert "unexpected_internal_path" not in metadata
    assert "original/index.html" not in serialized
    assert "/tmp/" not in serialized
    assert "file://" not in serialized
    assert "Traceback" not in serialized


def create_candidate(chunk_id: str, content: str) -> RetrievalCandidate:
    return RetrievalCandidate(
        chunk_id=chunk_id,
        content=content,
        score=0.8,
        metadata={"source_filename": f"{chunk_id}.md"},
    )


def _activate_runtime(db: Session, settings: Settings, version_id: str) -> RuntimeVersionContext:
    service = VersionLifecycleService(db=db, settings=settings)
    build = service.create_version_namespaces(version_id=version_id, archive_bytes=f"archive-{version_id}".encode())
    version = db.get(RuntimeVersion, build.version.id)
    assert version is not None
    version.status = "ready"
    db.flush()
    return service.activate_runtime_version(version.id)
