import json
import os
from collections.abc import Generator, Sequence
from contextlib import contextmanager
from typing import cast, override

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

os.environ["ADMIN_PASSWORD_HASH"] = (
    "$2b$12$AVhh6Snv3FcaevOnJ0dwR.SfBrkaPp036/Nt/wwdVTsVQNuR1XKx2"
)
os.environ["SESSION_SECRET"] = "test-session-secret"
os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

from app.chat_rag import _system_prompt, answer_session_message
from app.config import Settings, get_settings
from app.database import get_db
from app.embeddings import EmbeddingBatch, EmbeddingError
from app.main import app
from app.models import ChatMessage, Citation, RetrievalHit, RetrievalRun, RuntimeVersion
from app.routes_sessions import (
    _chat_dependency,
    _embedding_dependency,
    _graph_dependency,
    _qdrant_dependency,
    _retrieval_service_dependency,
)
from app.qdrant_index import QdrantIndexError, QdrantSearchHit
from app.retrieval_service import (
    RetrievalCandidate,
    RetrievalCitation,
    RetrievalResult,
    RetrievalScope,
    RetrievalService,
    RetrievalTrace,
)
from app.version_lifecycle import (
    DEFAULT_ACTIVE_POINTER_NAME,
    RuntimeVersionContext,
    VersionLifecycleService,
)
from tests.fakes import FakeEmbeddingClient, FakeQdrantIndexer
from tests.rag_support import (
    CapturingGraphInvoker,
    FakeChatClient,
    create_indexed_chunk,
    create_session,
)
from tests.support import db_session


def test_answer_session_message_persists_messages_retrieval_and_thread_config(
    db_session: Session,
) -> None:
    session = create_session(db_session)
    original_updated_at = session.updated_at
    chunk = create_indexed_chunk(
        db_session,
        "Ancient red dragons prefer volcanic lairs and hoard treasure obsessively.",
    )
    qdrant = FakeQdrantIndexer(
        search_hits=[
            QdrantSearchHit(id="point-1", score=0.91, payload={"chunk_id": chunk.id})
        ]
    )
    chat = FakeChatClient("Ancient red dragons prefer volcanic lairs. [1]", [chunk.id])
    graph = CapturingGraphInvoker(chat)

    assistant = answer_session_message(
        db_session,
        session.id,
        "What do Ancient red dragons prefer?",
        embedding_client=FakeEmbeddingClient(),
        qdrant_indexer=qdrant,
        chat_client=chat,
        graph_invoker=graph,
        settings=Settings(RETRIEVAL_TOP_K=5, RETRIEVAL_MIN_SCORE=0.2),
    )

    assert assistant.role == "assistant"
    assert assistant.content == "Ancient red dragons prefer volcanic lairs. [1]"
    assert json.loads(assistant.metadata_json) == {"no_evidence": False}
    messages = db_session.scalars(
        select(ChatMessage)
        .where(ChatMessage.chat_session_id == session.id)
        .order_by(ChatMessage.created_at)
    ).all()
    assert [message.role for message in messages] == ["user", "assistant"]
    assert [message.content for message in messages] == [
        "What do Ancient red dragons prefer?",
        assistant.content,
    ]
    assert messages[1].id == assistant.id
    run = db_session.scalars(
        select(RetrievalRun).where(RetrievalRun.chat_session_id == session.id)
    ).one()
    assert run.status == "answered"
    assert run.user_message_id == messages[0].id
    assert run.assistant_message_id == assistant.id
    assert run.query == "What do Ancient red dragons prefer?"
    assert json.loads(run.metadata_json)["thread_id"] == session.id
    hit = db_session.scalars(
        select(RetrievalHit).where(RetrievalHit.retrieval_run_id == run.id)
    ).one()
    assert hit.document_chunk_id == chunk.id
    assert hit.rank == 1
    assert json.loads(hit.metadata_json)["retrieval_score"] == "0.91000000"
    citation = db_session.scalars(
        select(Citation).where(Citation.assistant_message_id == assistant.id)
    ).one()
    assert citation.retrieval_run_id == run.id
    assert citation.document_chunk_id == chunk.id
    assert citation.label == "[1]"
    assert json.loads(citation.metadata_json)["cited_text"] == chunk.content
    db_session.refresh(session)
    assert session.updated_at >= original_updated_at
    assert graph.configs == [{"configurable": {"thread_id": session.id}}]


def test_answer_session_message_persists_explainable_retrieval_trace_distinct_from_ingestion_job(
    db_session: Session,
) -> None:
    session = create_session(db_session)
    chunk_a = create_indexed_chunk(
        db_session, "Source A supports volcanic lairs.", filename="source-a.md"
    )
    chunk_b = create_indexed_chunk(
        db_session, "Source B supports treasure hoards.", filename="source-b.md"
    )
    chunk_a_job = chunk_a.ingestion_job_id
    chunk_b_job = chunk_b.ingestion_job_id
    qdrant = FakeQdrantIndexer(
        search_hits=[
            QdrantSearchHit(id="point-a", score=0.97, payload={"chunk_id": chunk_a.id}),
            QdrantSearchHit(id="point-b", score=0.91, payload={"chunk_id": chunk_b.id}),
        ]
    )
    chat = FakeChatClient(
        "Ancient red dragons are volcanic and greedy. [2][1]", [chunk_b.id, chunk_a.id]
    )
    graph = CapturingGraphInvoker(chat)

    assistant = answer_session_message(
        db_session,
        session.id,
        "Explain ancient red dragons.",
        embedding_client=FakeEmbeddingClient(),
        qdrant_indexer=qdrant,
        chat_client=chat,
        graph_invoker=graph,
        settings=Settings(RETRIEVAL_TOP_K=5, RETRIEVAL_MIN_SCORE=0.2),
    )

    run = db_session.scalars(
        select(RetrievalRun).where(RetrievalRun.chat_session_id == session.id)
    ).one()
    run_metadata = json.loads(run.metadata_json)
    trace = run_metadata["trace"]
    hits = db_session.scalars(
        select(RetrievalHit)
        .where(RetrievalHit.retrieval_run_id == run.id)
        .order_by(RetrievalHit.rank)
    ).all()

    assert assistant.content == "Ancient red dragons are volcanic and greedy. [1][2]"
    assert run.status == "answered"
    assert run_metadata["thread_id"] == session.id
    assert run_metadata["qdrant_collection"] == "thestacks_chunks"
    assert trace["scope"] == {
        "qdrant_collection": "thestacks_chunks",
        "pointer_name": DEFAULT_ACTIVE_POINTER_NAME,
        "scope_source": "settings_fallback",
    }
    assert trace["query_embedding"] == {
        "model": "test-embedding-model",
        "dimensions": 4,
    }
    assert trace["limits"] == {
        "requested_limit": 50,
        "retrieval_min_score": 0.2,
        "retrieval_top_k": 5,
    }
    assert trace["counts"] == {
        "raw_hits": 2,
        "selected_candidates": 2,
        "filtered_low_score": 0,
        "filtered_missing_chunk": 0,
        "deduplicated": 0,
    }
    assert trace["candidates"] == [
        {
            "rank": 1,
            "document_chunk_id": chunk_a.id,
            "score": "0.97000000",
            "citation_label": "[1]",
        },
        {
            "rank": 2,
            "document_chunk_id": chunk_b.id,
            "score": "0.91000000",
            "citation_label": "[2]",
        },
    ]
    assert trace["citation_choices"] == [
        {"label": "[1]", "document_chunk_id": chunk_a.id},
        {"label": "[2]", "document_chunk_id": chunk_b.id},
    ]
    assert trace["final_citation_choices"] == [
        {"label": "[1]", "document_chunk_id": chunk_b.id},
        {"label": "[2]", "document_chunk_id": chunk_a.id},
    ]
    assert [json.loads(hit.metadata_json)["retrieval_score"] for hit in hits] == [
        "0.97000000",
        "0.91000000",
    ]
    assert [json.loads(hit.metadata_json)["retrieval_rank"] for hit in hits] == [1, 2]
    serialized_trace = json.dumps(trace, sort_keys=True)
    assert chunk_a_job not in serialized_trace
    assert chunk_b_job not in serialized_trace
    assert "ingestion_job" not in serialized_trace


def test_answer_session_message_searches_active_runtime_collection_when_pointer_exists(
    db_session: Session,
) -> None:
    settings = Settings(
        RETRIEVAL_TOP_K=5, RETRIEVAL_MIN_SCORE=0.2, QDRANT_COLLECTION="base_chunks"
    )
    runtime = _activate_runtime(
        db_session, settings, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    )
    session = create_session(db_session)
    chunk = create_indexed_chunk(
        db_session,
        "Active runtime dragons prefer volcanic lairs.",
        qdrant_collection=runtime.qdrant_collection,
    )
    qdrant = FakeQdrantIndexer(
        collection="base_chunks",
        collection_search_hits={
            settings.qdrant_collection: [],
            runtime.qdrant_collection: [
                QdrantSearchHit(
                    id="point-1", score=0.91, payload={"chunk_id": chunk.id}
                )
            ],
        },
    )
    chat = FakeChatClient(
        "Active runtime dragons prefer volcanic lairs. [1]", [chunk.id]
    )
    graph = CapturingGraphInvoker(chat)

    assistant = answer_session_message(
        db_session,
        session.id,
        "What do active runtime dragons prefer?",
        embedding_client=FakeEmbeddingClient(),
        qdrant_indexer=qdrant,
        chat_client=chat,
        graph_invoker=graph,
        settings=settings,
    )

    assert assistant.content == "Active runtime dragons prefer volcanic lairs. [1]"
    assert qdrant.search_requests == [
        ([1.0, 1.0, 1.0, 1.0], 50, runtime.qdrant_collection)
    ]
    run = db_session.scalars(
        select(RetrievalRun).where(RetrievalRun.chat_session_id == session.id)
    ).one()
    assert run.status == "answered"
    assert (
        db_session.scalars(
            select(RetrievalHit).where(RetrievalHit.retrieval_run_id == run.id)
        )
        .one()
        .document_chunk_id
        == chunk.id
    )


def test_answer_session_message_preserves_no_evidence_when_active_collection_has_no_hits(
    db_session: Session,
) -> None:
    settings = Settings(
        RETRIEVAL_TOP_K=5, RETRIEVAL_MIN_SCORE=0.2, QDRANT_COLLECTION="base_chunks"
    )
    runtime = _activate_runtime(
        db_session, settings, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    )
    session = create_session(db_session)
    base_chunk = create_indexed_chunk(
        db_session,
        "Base collection data should not leak into active runtime retrieval.",
    )
    qdrant = FakeQdrantIndexer(
        collection="base_chunks",
        collection_search_hits={
            settings.qdrant_collection: [
                QdrantSearchHit(
                    id="point-1", score=0.99, payload={"chunk_id": base_chunk.id}
                )
            ],
            runtime.qdrant_collection: [],
        },
    )
    chat = FakeChatClient("Should not be generated", [base_chunk.id])
    graph = CapturingGraphInvoker(chat)

    assistant = answer_session_message(
        db_session,
        session.id,
        "What data exists?",
        embedding_client=FakeEmbeddingClient(),
        qdrant_indexer=qdrant,
        chat_client=chat,
        graph_invoker=graph,
        settings=settings,
    )

    assert (
        assistant.content
        == "I do not have enough evidence in the indexed corpus to answer that question."
    )
    assert qdrant.search_requests == [
        ([1.0, 1.0, 1.0, 1.0], 50, runtime.qdrant_collection)
    ]
    run = db_session.scalars(
        select(RetrievalRun).where(RetrievalRun.chat_session_id == session.id)
    ).one()
    assert run.status == "no_evidence"
    assert (
        db_session.scalars(
            select(RetrievalHit).where(RetrievalHit.retrieval_run_id == run.id)
        ).all()
        == []
    )
    assert chat.requests == []


def test_answer_session_message_filters_active_collection_hits_outside_scope(
    db_session: Session,
) -> None:
    settings = Settings(
        RETRIEVAL_TOP_K=5, RETRIEVAL_MIN_SCORE=0.2, QDRANT_COLLECTION="base_chunks"
    )
    runtime = _activate_runtime(
        db_session, settings, "ffffffff-ffff-4fff-8fff-ffffffffffff"
    )
    session = create_session(db_session)
    base_chunk = create_indexed_chunk(
        db_session,
        "Base collection data should be rejected even if Qdrant returns it for the active collection.",
        qdrant_collection=settings.qdrant_collection,
    )
    qdrant = FakeQdrantIndexer(
        collection="base_chunks",
        collection_search_hits={
            runtime.qdrant_collection: [
                QdrantSearchHit(
                    id="stale-point", score=0.99, payload={"chunk_id": base_chunk.id}
                )
            ],
        },
    )
    chat = FakeChatClient("Should not be generated", [base_chunk.id])
    graph = CapturingGraphInvoker(chat)

    assistant = answer_session_message(
        db_session,
        session.id,
        "Can stale active-collection data leak?",
        embedding_client=FakeEmbeddingClient(),
        qdrant_indexer=qdrant,
        chat_client=chat,
        graph_invoker=graph,
        settings=settings,
    )

    assert (
        assistant.content
        == "I do not have enough evidence in the indexed corpus to answer that question."
    )
    assert qdrant.search_requests == [
        ([1.0, 1.0, 1.0, 1.0], 50, runtime.qdrant_collection)
    ]
    run = db_session.scalars(
        select(RetrievalRun).where(RetrievalRun.chat_session_id == session.id)
    ).one()
    metadata = json.loads(run.metadata_json)
    assert run.status == "no_evidence"
    assert metadata["qdrant_collection"] == runtime.qdrant_collection
    assert metadata["runtime_version_id"] == runtime.version_id
    assert metadata["filtered_missing_chunk_count"] == 1
    assert metadata["weak_reasons"] == ["no_candidates", "unavailable_data"]
    assert (
        db_session.scalars(
            select(RetrievalHit).where(RetrievalHit.retrieval_run_id == run.id)
        ).all()
        == []
    )
    assert chat.requests == []


def test_answer_session_message_no_evidence_persists_turn_without_chat_or_citations(
    db_session: Session,
) -> None:
    session = create_session(db_session)
    original_updated_at = session.updated_at
    chat = FakeChatClient("Should not be generated", [])
    graph = CapturingGraphInvoker(chat)

    assistant = answer_session_message(
        db_session,
        session.id,
        "What is outside the corpus?",
        embedding_client=FakeEmbeddingClient(),
        qdrant_indexer=FakeQdrantIndexer(search_hits=[]),
        chat_client=chat,
        graph_invoker=graph,
        settings=Settings(RETRIEVAL_TOP_K=5, RETRIEVAL_MIN_SCORE=0.2),
    )

    messages = db_session.scalars(
        select(ChatMessage)
        .where(ChatMessage.chat_session_id == session.id)
        .order_by(ChatMessage.created_at)
    ).all()
    run = db_session.scalars(
        select(RetrievalRun).where(RetrievalRun.chat_session_id == session.id)
    ).one()
    run_metadata = json.loads(run.metadata_json)

    assert assistant.role == "assistant"
    assert (
        assistant.content
        == "I do not have enough evidence in the indexed corpus to answer that question."
    )
    assert json.loads(assistant.metadata_json) == {"no_evidence": True}
    assert [message.role for message in messages] == ["user", "assistant"]
    assert [message.content for message in messages] == [
        "What is outside the corpus?",
        assistant.content,
    ]
    assert run.user_message_id == messages[0].id
    assert run.assistant_message_id == assistant.id
    assert run.status == "no_evidence"
    assert run.query == "What is outside the corpus?"
    assert run_metadata["thread_id"] == session.id
    assert run_metadata["weak_reasons"] == ["empty_result", "no_candidates"]
    assert (
        db_session.scalars(
            select(RetrievalHit).where(RetrievalHit.retrieval_run_id == run.id)
        ).all()
        == []
    )
    assert (
        db_session.scalars(
            select(Citation).where(Citation.assistant_message_id == assistant.id)
        ).all()
        == []
    )
    assert chat.requests == []
    assert graph.configs == []
    db_session.refresh(session)
    assert session.updated_at >= original_updated_at


def test_answer_session_message_invalid_citations_commit_no_evidence_with_retrieval_trace(
    db_session: Session,
) -> None:
    session = create_session(db_session)
    original_updated_at = session.updated_at
    chunk = create_indexed_chunk(
        db_session,
        "Ancient red dragons prefer volcanic lairs.",
        filename="source-a.md",
    )
    qdrant = FakeQdrantIndexer(
        search_hits=[
            QdrantSearchHit(id="point-1", score=0.93, payload={"chunk_id": chunk.id})
        ]
    )
    chat = FakeChatClient(
        "Ancient red dragons prefer volcanic lairs. [2]",
        [chunk.id],
    )
    graph = CapturingGraphInvoker(chat)

    assistant = answer_session_message(
        db_session,
        session.id,
        "What do Ancient red dragons prefer?",
        embedding_client=FakeEmbeddingClient(),
        qdrant_indexer=qdrant,
        chat_client=chat,
        graph_invoker=graph,
        settings=Settings(RETRIEVAL_TOP_K=5, RETRIEVAL_MIN_SCORE=0.2),
    )

    messages = db_session.scalars(
        select(ChatMessage)
        .where(ChatMessage.chat_session_id == session.id)
        .order_by(ChatMessage.created_at)
    ).all()
    run = db_session.scalars(
        select(RetrievalRun).where(RetrievalRun.chat_session_id == session.id)
    ).one()
    hit = db_session.scalars(
        select(RetrievalHit).where(RetrievalHit.retrieval_run_id == run.id)
    ).one()

    assert assistant.role == "assistant"
    assert (
        assistant.content
        == "I do not have enough evidence in the indexed corpus to answer that question."
    )
    assert json.loads(assistant.metadata_json) == {"no_evidence": True}
    assert [message.role for message in messages] == ["user", "assistant"]
    assert [message.content for message in messages] == [
        "What do Ancient red dragons prefer?",
        assistant.content,
    ]
    assert run.status == "no_evidence"
    assert run.user_message_id == messages[0].id
    assert run.assistant_message_id == assistant.id
    assert run.query == "What do Ancient red dragons prefer?"
    run_metadata = cast(dict[str, object], json.loads(run.metadata_json))
    assert isinstance(run_metadata, dict)
    trace = cast(dict[str, object], run_metadata["trace"])
    assert isinstance(trace, dict)
    assert trace["citation_choices"] == [
        {"label": "[1]", "document_chunk_id": chunk.id}
    ]
    assert "final_citation_choices" not in trace
    assert hit.document_chunk_id == chunk.id
    assert hit.rank == 1
    assert json.loads(hit.metadata_json)["retrieval_score"] == "0.93000000"
    assert (
        db_session.scalars(
            select(Citation).where(Citation.assistant_message_id == assistant.id)
        ).all()
        == []
    )
    assert graph.configs == [{"configurable": {"thread_id": session.id}}]
    assert chat.requests == [("What do Ancient red dragons prefer?", [chunk.id])]
    db_session.refresh(session)
    assert session.updated_at >= original_updated_at


def test_answer_session_message_retrieval_failure_rolls_back_uncommitted_turn_when_caller_rolls_back(
    db_session: Session,
) -> None:
    class FailingRetrievalService(BoundaryRetrievalService):
        @override
        def retrieve(self, query: str, scope: RetrievalScope) -> RetrievalResult:
            self.requests.append((query, scope.qdrant_collection))
            raise RuntimeError("retrieval boundary failed")

    session = create_session(db_session)
    original_updated_at = session.updated_at
    service = FailingRetrievalService(db_session, "unused-chunk", "unused content")

    with pytest.raises(RuntimeError, match="retrieval boundary failed"):
        answer_session_message(
            db_session,
            session.id,
            "Will retrieval fail?",
            chat_client=FakeChatClient("Should not be used", []),
            graph_invoker=CapturingGraphInvoker(
                FakeChatClient("Should not be used", [])
            ),
            retrieval_service=service,
            settings=Settings(RETRIEVAL_TOP_K=5, RETRIEVAL_MIN_SCORE=0.2),
        )

    uncommitted_messages = db_session.scalars(
        select(ChatMessage).where(ChatMessage.chat_session_id == session.id)
    ).all()
    uncommitted_runs = db_session.scalars(
        select(RetrievalRun).where(RetrievalRun.chat_session_id == session.id)
    ).all()
    assert [message.role for message in uncommitted_messages] == ["user"]
    assert [run.status for run in uncommitted_runs] == ["running"]
    assert service.requests == [("Will retrieval fail?", "thestacks_chunks")]

    db_session.rollback()

    assert (
        db_session.scalars(
            select(ChatMessage).where(ChatMessage.chat_session_id == session.id)
        ).all()
        == []
    )
    assert (
        db_session.scalars(
            select(RetrievalRun).where(RetrievalRun.chat_session_id == session.id)
        ).all()
        == []
    )
    assert db_session.scalars(select(RetrievalHit)).all() == []
    assert db_session.scalars(select(Citation)).all() == []
    db_session.refresh(session)
    assert session.updated_at == original_updated_at


def test_answer_session_message_graph_failure_rolls_back_retrieval_side_effects_when_caller_rolls_back(
    db_session: Session,
) -> None:
    class FailingGraphInvoker(CapturingGraphInvoker):
        @override
        def invoke(
            self, state: dict[str, object], config: dict[str, object]
        ) -> dict[str, object]:
            self.configs.append(config)
            raise RuntimeError("graph boundary failed")

    session = create_session(db_session)
    original_updated_at = session.updated_at
    chunk = create_indexed_chunk(
        db_session, "Ancient red dragons prefer volcanic lairs."
    )
    chat = FakeChatClient("Should not be returned", [chunk.id])
    graph = FailingGraphInvoker(chat)

    with pytest.raises(RuntimeError, match="graph boundary failed"):
        answer_session_message(
            db_session,
            session.id,
            "Will graph fail?",
            embedding_client=FakeEmbeddingClient(),
            qdrant_indexer=FakeQdrantIndexer(
                search_hits=[
                    QdrantSearchHit(
                        id="point-1", score=0.93, payload={"chunk_id": chunk.id}
                    )
                ]
            ),
            chat_client=chat,
            graph_invoker=graph,
            settings=Settings(RETRIEVAL_TOP_K=5, RETRIEVAL_MIN_SCORE=0.2),
        )

    uncommitted_messages = db_session.scalars(
        select(ChatMessage).where(ChatMessage.chat_session_id == session.id)
    ).all()
    uncommitted_runs = db_session.scalars(
        select(RetrievalRun).where(RetrievalRun.chat_session_id == session.id)
    ).all()
    assert [message.role for message in uncommitted_messages] == ["user"]
    assert len(uncommitted_runs) == 1
    assert uncommitted_runs[0].status == "running"
    assert uncommitted_runs[0].assistant_message_id is None
    assert graph.configs == [{"configurable": {"thread_id": session.id}}]
    assert chat.requests == []

    db_session.rollback()

    assert (
        db_session.scalars(
            select(ChatMessage).where(ChatMessage.chat_session_id == session.id)
        ).all()
        == []
    )
    assert (
        db_session.scalars(
            select(RetrievalRun).where(RetrievalRun.chat_session_id == session.id)
        ).all()
        == []
    )
    assert db_session.scalars(select(RetrievalHit)).all() == []
    assert db_session.scalars(select(Citation)).all() == []
    db_session.refresh(session)
    assert session.updated_at == original_updated_at


def test_post_session_message_returns_grounded_answer_shape(
    db_session: Session,
) -> None:
    session = create_session(db_session)
    chunk_a = create_indexed_chunk(
        db_session, "Ancient red dragons prefer volcanic lairs.", filename="source-a.md"
    )
    chunk_b = create_indexed_chunk(
        db_session,
        "Ancient red dragons hoard treasure obsessively.",
        filename="source-b.md",
    )
    qdrant = FakeQdrantIndexer(
        search_hits=[
            QdrantSearchHit(id="point-a", score=0.93, payload={"chunk_id": chunk_a.id}),
            QdrantSearchHit(id="point-b", score=0.92, payload={"chunk_id": chunk_b.id}),
        ]
    )
    chat = FakeChatClient(
        "Ancient red dragons are volcanic and greedy. [1][2]", [chunk_a.id, chunk_b.id]
    )
    graph = CapturingGraphInvoker(chat)

    with _client(db_session, qdrant, chat, graph) as client:
        response = client.post(
            f"/sessions/{session.id}/messages", json={"content": "Ancient red dragons?"}
        )

    assert response.status_code == 200
    payload = response.json()
    assert set(payload) == {
        "user_message",
        "assistant_message",
        "retrieval_run_id",
        "no_evidence",
    }
    assert payload["user_message"]["role"] == "user"
    assert payload["user_message"]["content"] == "Ancient red dragons?"
    assert payload["user_message"]["chat_session_id"] == session.id
    assert payload["user_message"]["citations"] == []
    assert payload["assistant_message"]["role"] == "assistant"
    assert payload["assistant_message"]["chat_session_id"] == session.id
    assert (
        payload["assistant_message"]["content"]
        == "Ancient red dragons are volcanic and greedy. [1][2]"
    )
    assert payload["assistant_message"]["metadata"] == {"no_evidence": False}
    assert [
        citation["label"] for citation in payload["assistant_message"]["citations"]
    ] == ["[1]", "[2]"]
    assert [
        citation["document_chunk_id"]
        for citation in payload["assistant_message"]["citations"]
    ] == [chunk_a.id, chunk_b.id]
    assert [
        citation["metadata"]["source_filename"]
        for citation in payload["assistant_message"]["citations"]
    ] == ["source-a.md", "source-b.md"]
    assert [
        citation["metadata"]["cited_text"]
        for citation in payload["assistant_message"]["citations"]
    ] == [
        "Ancient red dragons prefer volcanic lairs.",
        "Ancient red dragons hoard treasure obsessively.",
    ]
    assert payload["retrieval_run_id"]
    assert payload["no_evidence"] is False
    run = db_session.get(RetrievalRun, payload["retrieval_run_id"])
    assert run is not None
    assert run.user_message_id == payload["user_message"]["id"]
    assert run.assistant_message_id == payload["assistant_message"]["id"]


def test_post_session_message_invokes_retrieval_service_boundary(
    db_session: Session,
) -> None:
    session = create_session(db_session)
    chunk = create_indexed_chunk(
        db_session, "Boundary service dragons prefer volcanic lairs."
    )
    chat = FakeChatClient(
        "Boundary service dragons prefer volcanic lairs. [1]", [chunk.id]
    )
    graph = CapturingGraphInvoker(chat)
    service = BoundaryRetrievalService(db_session, chunk.id, chunk.content)

    with _client(db_session, FakeQdrantIndexer(search_hits=[]), chat, graph) as client:
        app.dependency_overrides[_retrieval_service_dependency] = lambda: service
        response = client.post(
            f"/sessions/{session.id}/messages",
            json={"content": "Use the service boundary?"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert (
        payload["assistant_message"]["content"]
        == "Boundary service dragons prefer volcanic lairs. [1]"
    )
    assert payload["assistant_message"]["citations"][0]["document_chunk_id"] == chunk.id
    assert payload["no_evidence"] is False
    assert service.requests == [("Use the service boundary?", "thestacks_chunks")]
    assert chat.requests == [("Use the service boundary?", [chunk.id])]


def test_records_retrieval_runs_serialize_persisted_trace_metadata(
    db_session: Session,
) -> None:
    session = create_session(db_session)
    chunk = create_indexed_chunk(
        db_session, "Records can explain retrieved dragon evidence."
    )
    qdrant = FakeQdrantIndexer(
        search_hits=[
            QdrantSearchHit(id="point-1", score=0.93, payload={"chunk_id": chunk.id})
        ]
    )
    chat = FakeChatClient(
        "Records can explain retrieved dragon evidence. [1]", [chunk.id]
    )
    graph = CapturingGraphInvoker(chat)

    with _client(db_session, qdrant, chat, graph) as client:
        answer_response = client.post(
            f"/sessions/{session.id}/messages",
            json={"content": "Can records explain this later?"},
        )
        records_response = client.get("/records/retrieval-runs")

    assert answer_response.status_code == 200
    assert records_response.status_code == 200
    record = records_response.json()[0]
    trace = record["metadata"]["trace"]

    assert record["id"] == answer_response.json()["retrieval_run_id"]
    assert trace["scope"]["qdrant_collection"] == "thestacks_chunks"
    assert trace["counts"]["raw_hits"] == 1
    assert trace["candidates"] == [
        {
            "rank": 1,
            "document_chunk_id": chunk.id,
            "score": "0.93000000",
            "citation_label": "[1]",
        }
    ]
    assert trace["final_citation_choices"] == [
        {"label": "[1]", "document_chunk_id": chunk.id}
    ]


def test_post_session_message_searches_active_runtime_collection_when_base_collection_empty(
    db_session: Session,
) -> None:
    settings = Settings(
        ADMIN_PASSWORD_HASH=os.environ["ADMIN_PASSWORD_HASH"],
        SESSION_SECRET=os.environ["SESSION_SECRET"],
        DATABASE_URL="sqlite+pysqlite:///:memory:",
        RETRIEVAL_TOP_K=5,
        RETRIEVAL_MIN_SCORE=0.2,
        QDRANT_COLLECTION="base_chunks",
    )
    runtime = _activate_runtime(
        db_session, settings, "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    )
    session = create_session(db_session)
    chunk = create_indexed_chunk(
        db_session,
        "Route-level active runtime dragons prefer volcanic lairs.",
        qdrant_collection=runtime.qdrant_collection,
    )
    qdrant = FakeQdrantIndexer(
        collection=settings.qdrant_collection,
        collection_search_hits={
            settings.qdrant_collection: [],
            runtime.qdrant_collection: [
                QdrantSearchHit(
                    id="point-1", score=0.93, payload={"chunk_id": chunk.id}
                )
            ],
        },
    )
    chat = FakeChatClient(
        "Route-level active runtime dragons prefer volcanic lairs. [1]", [chunk.id]
    )
    graph = CapturingGraphInvoker(chat)

    with _client(db_session, qdrant, chat, graph, settings=settings) as client:
        response = client.post(
            f"/sessions/{session.id}/messages",
            json={"content": "What do route-level dragons prefer?"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert (
        payload["assistant_message"]["content"]
        == "Route-level active runtime dragons prefer volcanic lairs. [1]"
    )
    assert payload["assistant_message"]["citations"][0]["document_chunk_id"] == chunk.id
    assert payload["no_evidence"] is False
    assert qdrant.search_requests == [
        ([1.0, 1.0, 1.0, 1.0], 50, runtime.qdrant_collection)
    ]
    run = db_session.scalars(
        select(RetrievalRun).where(RetrievalRun.chat_session_id == session.id)
    ).one()
    assert run.status == "answered"
    assert (
        db_session.scalars(
            select(RetrievalHit).where(RetrievalHit.retrieval_run_id == run.id)
        )
        .one()
        .document_chunk_id
        == chunk.id
    )


def test_post_session_message_returns_archive_viewer_citation_metadata(
    db_session: Session,
) -> None:
    session = create_session(db_session)
    chunk = create_indexed_chunk(
        db_session, "Archive goblins prefer moonlit ruins.", filename="archive.zip"
    )
    chunk.metadata_json = json.dumps(
        {
            **json.loads(chunk.metadata_json),
            "source_type": "archived_webpage",
            "archive_source_id": chunk.source_id,
            "source_title": "Moonlit Goblin Archive",
            "target_chunk_id": "archive-target-123",
            "target_selector": "#source-chunk-archive-target-123",
            "quote": "Archive goblins prefer moonlit ruins.",
            "semantic_section": {
                "kind": "heading",
                "heading": {
                    "text": "Goblins",
                    "level": 2,
                    "id": "goblins",
                    "slug": "goblins",
                },
                "parent": {
                    "text": "Bestiary",
                    "level": 1,
                    "id": "bestiary",
                    "slug": "bestiary",
                },
                "path": [
                    {
                        "text": "Bestiary",
                        "level": 1,
                        "id": "bestiary",
                        "slug": "bestiary",
                    },
                    {"text": "Goblins", "level": 2, "id": "goblins", "slug": "goblins"},
                ],
                "path_text": ["Bestiary", "Goblins"],
                "depth": 2,
            },
            "archive_entry_path": "original/index.html",
            "archive_served_entry_path": "served/index.html",
            "archive_manifest_path": "source-archives/source-id/manifest.json",
            "raw_html_path": "/tmp/source-archives/source-id/original/index.html",
        },
        sort_keys=True,
    )
    db_session.commit()
    qdrant = FakeQdrantIndexer(
        search_hits=[
            QdrantSearchHit(id="point-1", score=0.93, payload={"chunk_id": chunk.id})
        ]
    )
    chat = FakeChatClient("Archive goblins prefer moonlit ruins. [1]", [chunk.id])
    graph = CapturingGraphInvoker(chat)

    with _client(db_session, qdrant, chat, graph) as client:
        response = client.post(
            f"/sessions/{session.id}/messages",
            json={"content": "Where do archive goblins lair?"},
        )

    assert response.status_code == 200
    citation = response.json()["assistant_message"]["citations"][0]
    metadata = citation["metadata"]

    assert citation["document_chunk_id"] == chunk.id
    assert metadata["source_type"] == "archived_webpage"
    assert metadata["source_title"] == "Moonlit Goblin Archive"
    assert (
        metadata["viewer_url"]
        == f"/records/sources/{chunk.source_id}/archive/viewer?target=archive-target-123"
    )
    assert metadata["target_chunk_id"] == "archive-target-123"
    assert metadata["target_selector"] == "#source-chunk-archive-target-123"
    assert metadata["quote"] == "Archive goblins prefer moonlit ruins."
    assert metadata["section_path"] == metadata["semantic_section"]["path_text"]
    assert metadata["semantic_section"]["path_text"] == ["Bestiary", "Goblins"]
    assert metadata["cited_text"] == "Archive goblins prefer moonlit ruins."
    assert metadata["source_filename"] == "archive.zip"
    assert "archive_entry_path" not in metadata
    assert "archive_served_entry_path" not in metadata
    assert "archive_manifest_path" not in metadata
    assert "raw_html_path" not in metadata
    assert "original/index.html" not in json.dumps(metadata)
    assert "/tmp/" not in json.dumps(metadata)


def test_answer_session_message_uses_retrieval_layer_citation_metadata_for_hits_and_citations(
    db_session: Session,
) -> None:
    session = create_session(db_session)
    chunk = create_indexed_chunk(
        db_session, "Archive goblins prefer moonlit ruins.", filename="archive.zip"
    )
    chunk.metadata_json = json.dumps(
        {
            **json.loads(chunk.metadata_json),
            "source_type": "archived_webpage",
            "archive_source_id": chunk.source_id,
            "source_title": "Moonlit Goblin Archive",
            "target_chunk_id": "archive-target-123",
            "target_selector": "#source-chunk-archive-target-123",
            "quote": "Archive goblins prefer moonlit ruins.",
            "semantic_section": {"path_text": ["Bestiary", "Goblins"]},
            "archive_entry_path": "original/index.html",
            "archive_served_entry_path": "served/index.html",
            "archive_manifest_path": "source-archives/source-id/manifest.json",
            "raw_html_path": "/tmp/source-archives/source-id/original/index.html",
            "diagnostic_traceback": "Traceback (most recent call last): boom",
        },
        sort_keys=True,
    )
    db_session.commit()
    qdrant = FakeQdrantIndexer(
        search_hits=[
            QdrantSearchHit(id="point-1", score=0.93, payload={"chunk_id": chunk.id})
        ]
    )
    chat = FakeChatClient("Archive goblins prefer moonlit ruins. [1]", [chunk.id])
    graph = CapturingGraphInvoker(chat)

    assistant = answer_session_message(
        db_session,
        session.id,
        "Where do archive goblins lair?",
        embedding_client=FakeEmbeddingClient(),
        qdrant_indexer=qdrant,
        chat_client=chat,
        graph_invoker=graph,
        settings=Settings(RETRIEVAL_TOP_K=5, RETRIEVAL_MIN_SCORE=0.2),
    )
    run = db_session.scalars(
        select(RetrievalRun).where(RetrievalRun.chat_session_id == session.id)
    ).one()
    hit = db_session.scalars(
        select(RetrievalHit).where(RetrievalHit.retrieval_run_id == run.id)
    ).one()
    citation = db_session.scalars(
        select(Citation).where(Citation.assistant_message_id == assistant.id)
    ).one()
    hit_metadata = json.loads(hit.metadata_json)
    citation_metadata = json.loads(citation.metadata_json)
    serialized = json.dumps(citation_metadata, sort_keys=True)

    assert {
        key: value
        for key, value in hit_metadata.items()
        if not key.startswith("retrieval_")
    } == citation_metadata
    assert hit_metadata["retrieval_rank"] == 1
    assert hit_metadata["retrieval_score"] == "0.93000000"
    assert (
        citation_metadata["viewer_url"]
        == f"/records/sources/{chunk.source_id}/archive/viewer?target=archive-target-123"
    )
    assert citation_metadata["section_path"] == ["Bestiary", "Goblins"]
    assert citation_metadata["cited_text"] == "Archive goblins prefer moonlit ruins."
    assert "archive_entry_path" not in citation_metadata
    assert "archive_served_entry_path" not in citation_metadata
    assert "archive_manifest_path" not in citation_metadata
    assert "raw_html_path" not in citation_metadata
    assert "diagnostic_traceback" not in citation_metadata
    assert "original/index.html" not in serialized
    assert "/tmp/" not in serialized
    assert "Traceback" not in serialized


def test_post_session_message_keeps_non_archive_citation_metadata_compatible(
    db_session: Session,
) -> None:
    session = create_session(db_session)
    chunk = create_indexed_chunk(
        db_session,
        "Plain goblins prefer caves.",
        filename="plain.html",
        section="Bestiary",
    )
    qdrant = FakeQdrantIndexer(
        search_hits=[
            QdrantSearchHit(id="point-1", score=0.93, payload={"chunk_id": chunk.id})
        ]
    )
    chat = FakeChatClient("Plain goblins prefer caves. [1]", [chunk.id])
    graph = CapturingGraphInvoker(chat)

    with _client(db_session, qdrant, chat, graph) as client:
        response = client.post(
            f"/sessions/{session.id}/messages",
            json={"content": "Where do plain goblins lair?"},
        )

    assert response.status_code == 200
    citation = response.json()["assistant_message"]["citations"][0]
    metadata = citation["metadata"]

    assert citation["document_chunk_id"] == chunk.id
    assert metadata["source_filename"] == "plain.html"
    assert metadata["section_heading"] == "Bestiary"
    assert metadata["cited_text"] == "Plain goblins prefer caves."
    assert "viewer_url" not in metadata
    assert "target_chunk_id" not in metadata
    assert "target_selector" not in metadata


def test_post_session_message_returns_service_error_for_embedding_failure(
    db_session: Session,
) -> None:
    class FailingEmbeddingClient(FakeEmbeddingClient):
        @override
        def embed_texts(self, texts: Sequence[str]) -> EmbeddingBatch:
            raise EmbeddingError(
                "Traceback at /srv/private/embed.py: OPENAI_API_KEY is required for embedding"
            )

    session = create_session(db_session)
    qdrant = FakeQdrantIndexer(search_hits=[])
    chat = FakeChatClient("Should not be used", [])
    graph = CapturingGraphInvoker(chat)

    with _client(db_session, qdrant, chat, graph) as client:
        app.dependency_overrides[_embedding_dependency] = lambda: (
            FailingEmbeddingClient()
        )
        response = client.post(
            f"/sessions/{session.id}/messages", json={"content": "Ancient red dragons?"}
        )

    assert response.status_code == 503
    assert response.json() == {"detail": "Embedding service is unavailable"}
    assert "Traceback" not in response.text
    assert "/srv/private" not in response.text


def test_post_session_message_returns_safe_service_error_for_qdrant_failure(
    db_session: Session,
) -> None:
    class FailingQdrantIndexer(FakeQdrantIndexer):
        @override
        def search_points(
            self,
            vector: list[float],
            limit: int,
            collection: str | None = None,
        ) -> list[QdrantSearchHit]:
            raise QdrantIndexError(
                "Traceback from file:///srv/private/qdrant.py: collection exploded"
            )

    session = create_session(db_session)
    chat = FakeChatClient("Should not be used", [])
    graph = CapturingGraphInvoker(chat)

    with _client(
        db_session, FailingQdrantIndexer(search_hits=[]), chat, graph
    ) as client:
        response = client.post(
            f"/sessions/{session.id}/messages", json={"content": "Ancient red dragons?"}
        )

    assert response.status_code == 503
    assert response.json() == {"detail": "Retrieval index is unavailable"}
    assert "Traceback" not in response.text
    assert "file://" not in response.text
    assert "/srv/private" not in response.text


def test_post_session_message_returns_safe_service_error_for_chat_runtime_failure(
    db_session: Session,
) -> None:
    class FailingGraphInvoker(CapturingGraphInvoker):
        @override
        def invoke(
            self, state: dict[str, object], config: dict[str, object]
        ) -> dict[str, object]:
            raise RuntimeError("Traceback at /tmp/chat.py: OPENAI response failed")

    session = create_session(db_session)
    chunk = create_indexed_chunk(
        db_session, "Ancient red dragons prefer volcanic lairs."
    )
    qdrant = FakeQdrantIndexer(
        search_hits=[
            QdrantSearchHit(id="point-1", score=0.93, payload={"chunk_id": chunk.id})
        ]
    )
    chat = FakeChatClient("Should not be used", [chunk.id])

    with _client(db_session, qdrant, chat, FailingGraphInvoker(chat)) as client:
        response = client.post(
            f"/sessions/{session.id}/messages", json={"content": "Ancient red dragons?"}
        )

    assert response.status_code == 503
    assert response.json() == {"detail": "Chat response service is unavailable"}
    assert "Traceback" not in response.text
    assert "/tmp/" not in response.text


def test_system_prompt_requires_inline_citation_markers() -> None:
    prompt = _system_prompt()

    assert "JSON with answer and citations as chunk IDs" in prompt
    assert "concise Markdown" in prompt
    assert "Markdown tables" in prompt
    assert "[1]" in prompt
    assert "[2][3]" in prompt
    assert "immediately next to the supported claims" in prompt
    assert (
        "Repeat [1] on every factual sentence that the same source supports." in prompt
    )
    assert (
        "Never leave citations only at the end of a paragraph when they belong to multiple sentences."
        in prompt
    )
    assert (
        "When two sources support one sentence, keep [1][2] immediately after that sentence."
        in prompt
    )
    assert "Put citations on each bullet line that makes a factual claim." in prompt


def test_post_session_message_repeats_single_source_citation_on_multiple_factual_sentences(
    db_session: Session,
) -> None:
    session = create_session(db_session)
    chunk = create_indexed_chunk(
        db_session,
        "Ancient red dragons prefer volcanic lairs and hoard treasure obsessively.",
    )
    qdrant = FakeQdrantIndexer(
        search_hits=[
            QdrantSearchHit(id="point-1", score=0.93, payload={"chunk_id": chunk.id})
        ]
    )
    chat = FakeChatClient(
        "Ancient red dragons prefer volcanic lairs. [1] They hoard treasure obsessively. [1]",
        [chunk.id],
    )
    graph = CapturingGraphInvoker(chat)

    with _client(db_session, qdrant, chat, graph) as client:
        response = client.post(
            f"/sessions/{session.id}/messages",
            json={"content": "What do Ancient red dragons prefer?"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert (
        payload["assistant_message"]["content"]
        == "Ancient red dragons prefer volcanic lairs. [1] They hoard treasure obsessively. [1]"
    )
    assert payload["assistant_message"]["citations"][0]["document_chunk_id"] == chunk.id


def test_post_session_message_derives_archive_citation_section_path_from_semantic_section_path_text(
    db_session: Session,
) -> None:
    session = create_session(db_session)
    chunk = create_indexed_chunk(
        db_session, "Archive goblins prefer moonlit ruins.", filename="archive.zip"
    )
    legacy_section_path = ["Parser", "Legacy"]
    chunk.metadata_json = json.dumps(
        {
            **json.loads(chunk.metadata_json),
            "source_type": "archived_webpage",
            "archive_source_id": chunk.source_id,
            "source_title": "Moonlit Goblin Archive",
            "target_chunk_id": "archive-target-456",
            "target_selector": "#source-chunk-archive-target-456",
            "quote": "Archive goblins prefer moonlit ruins.",
            "semantic_section": {
                "kind": "heading",
                "heading": {
                    "text": "Goblins",
                    "level": 2,
                    "id": "goblins",
                    "slug": "goblins",
                },
                "parent": {
                    "text": "Bestiary",
                    "level": 1,
                    "id": "bestiary",
                    "slug": "bestiary",
                },
                "path": [
                    {
                        "text": "Bestiary",
                        "level": 1,
                        "id": "bestiary",
                        "slug": "bestiary",
                    },
                    {"text": "Goblins", "level": 2, "id": "goblins", "slug": "goblins"},
                ],
                "path_text": ["Bestiary", "Goblins"],
                "depth": 2,
            },
            "section_path": legacy_section_path,
            "archive_entry_path": "original/index.html",
            "archive_served_entry_path": "served/index.html",
            "archive_manifest_path": "source-archives/source-id/manifest.json",
            "raw_html_path": "/tmp/source-archives/source-id/original/index.html",
        },
        sort_keys=True,
    )
    db_session.commit()
    qdrant = FakeQdrantIndexer(
        search_hits=[
            QdrantSearchHit(id="point-1", score=0.93, payload={"chunk_id": chunk.id})
        ]
    )
    chat = FakeChatClient("Archive goblins prefer moonlit ruins. [1]", [chunk.id])
    graph = CapturingGraphInvoker(chat)

    with _client(db_session, qdrant, chat, graph) as client:
        response = client.post(
            f"/sessions/{session.id}/messages",
            json={"content": "Where do archive goblins lair?"},
        )

    assert response.status_code == 200
    citation = response.json()["assistant_message"]["citations"][0]
    metadata = citation["metadata"]

    assert metadata["section_path"] == metadata["semantic_section"]["path_text"]
    assert metadata["section_path"] != legacy_section_path
    assert (
        metadata["viewer_url"]
        == f"/records/sources/{chunk.source_id}/archive/viewer?target=archive-target-456"
    )
    assert json.loads(chunk.metadata_json)["section_path"] == legacy_section_path


def test_post_session_message_rewrites_paragraph_end_only_citation_drift(
    db_session: Session,
) -> None:
    session = create_session(db_session)
    chunk = create_indexed_chunk(
        db_session,
        "Ancient red dragons prefer volcanic lairs and hoard treasure obsessively.",
    )
    qdrant = FakeQdrantIndexer(
        search_hits=[
            QdrantSearchHit(id="point-1", score=0.93, payload={"chunk_id": chunk.id})
        ]
    )
    chat = FakeChatClient(
        "Ancient red dragons prefer volcanic lairs. They hoard treasure obsessively. [1][2]",
        [chunk.id],
    )
    graph = CapturingGraphInvoker(chat)

    with _client(db_session, qdrant, chat, graph) as client:
        response = client.post(
            f"/sessions/{session.id}/messages",
            json={"content": "What do Ancient red dragons prefer?"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert (
        payload["assistant_message"]["content"]
        == "I do not have enough evidence in the indexed corpus to answer that question."
    )
    assert payload["assistant_message"]["citations"] == []
    assert payload["no_evidence"] is True
    assert (
        db_session.scalars(
            select(RetrievalRun).where(RetrievalRun.chat_session_id == session.id)
        )
        .one()
        .status
        == "no_evidence"
    )


def test_post_session_message_keeps_multi_source_citations_immediately_after_sentence(
    db_session: Session,
) -> None:
    session = create_session(db_session)
    chunk_a = create_indexed_chunk(
        db_session, "Ancient red dragons prefer volcanic lairs.", filename="source-a.md"
    )
    chunk_b = create_indexed_chunk(
        db_session,
        "Ancient red dragons hoard treasure obsessively.",
        filename="source-b.md",
    )
    qdrant = FakeQdrantIndexer(
        search_hits=[
            QdrantSearchHit(id="point-1", score=0.97, payload={"chunk_id": chunk_a.id}),
            QdrantSearchHit(id="point-2", score=0.95, payload={"chunk_id": chunk_b.id}),
        ]
    )
    chat = FakeChatClient(
        "Ancient red dragons are volcanic and greedy. [1][2]", [chunk_a.id, chunk_b.id]
    )
    graph = CapturingGraphInvoker(chat)

    with _client(db_session, qdrant, chat, graph) as client:
        response = client.post(
            f"/sessions/{session.id}/messages",
            json={"content": "What do Ancient red dragons prefer?"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert (
        payload["assistant_message"]["content"]
        == "Ancient red dragons are volcanic and greedy. [1][2]"
    )
    assert [
        citation["document_chunk_id"]
        for citation in payload["assistant_message"]["citations"]
    ] == [chunk_a.id, chunk_b.id]


def test_post_session_message_attaches_citations_to_each_bullet_line(
    db_session: Session,
) -> None:
    session = create_session(db_session)
    chunk = create_indexed_chunk(
        db_session,
        "Ancient red dragons prefer volcanic lairs and hoard treasure obsessively.",
    )
    qdrant = FakeQdrantIndexer(
        search_hits=[
            QdrantSearchHit(id="point-1", score=0.93, payload={"chunk_id": chunk.id})
        ]
    )
    chat = FakeChatClient(
        "- Ancient red dragons prefer volcanic lairs. [1]\n- Ancient red dragons hoard treasure obsessively. [1]",
        [chunk.id],
    )
    graph = CapturingGraphInvoker(chat)

    with _client(db_session, qdrant, chat, graph) as client:
        response = client.post(
            f"/sessions/{session.id}/messages",
            json={"content": "What do Ancient red dragons prefer?"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert (
        payload["assistant_message"]["content"]
        == "- Ancient red dragons prefer volcanic lairs. [1]\n- Ancient red dragons hoard treasure obsessively. [1]"
    )
    assert payload["assistant_message"]["citations"][0]["document_chunk_id"] == chunk.id


def test_post_session_message_accepts_valid_citations_at_paragraph_end(
    db_session: Session,
) -> None:
    session = create_session(db_session)
    chunk = create_indexed_chunk(
        db_session,
        "Ancient red dragons prefer volcanic lairs and hoard treasure obsessively.",
    )
    qdrant = FakeQdrantIndexer(
        search_hits=[
            QdrantSearchHit(id="point-1", score=0.93, payload={"chunk_id": chunk.id})
        ]
    )
    chat = FakeChatClient(
        "Ancient red dragons prefer volcanic lairs. They hoard treasure obsessively. [1]",
        [chunk.id],
    )
    graph = CapturingGraphInvoker(chat)

    with _client(db_session, qdrant, chat, graph) as client:
        response = client.post(
            f"/sessions/{session.id}/messages",
            json={"content": "What do Ancient red dragons prefer?"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert (
        payload["assistant_message"]["content"]
        == "Ancient red dragons prefer volcanic lairs. They hoard treasure obsessively. [1]"
    )
    assert payload["assistant_message"]["citations"][0]["document_chunk_id"] == chunk.id
    assert payload["no_evidence"] is False


def test_post_session_message_derives_citation_order_from_chunk_id_inline_markers(
    db_session: Session,
) -> None:
    session = create_session(db_session)
    chunk_a = create_indexed_chunk(
        db_session, "Source A supports the first claim.", filename="source-a.md"
    )
    chunk_b = create_indexed_chunk(
        db_session, "Source B supports the third claim.", filename="source-b.md"
    )
    chunk_c = create_indexed_chunk(
        db_session, "Source C supports the second claim.", filename="source-c.md"
    )
    qdrant = FakeQdrantIndexer(
        search_hits=[
            QdrantSearchHit(id="point-1", score=0.99, payload={"chunk_id": chunk_a.id}),
            QdrantSearchHit(id="point-2", score=0.98, payload={"chunk_id": chunk_b.id}),
            QdrantSearchHit(id="point-3", score=0.97, payload={"chunk_id": chunk_c.id}),
        ]
    )
    answer = (
        f"First claim. [chunk_id={chunk_a.id}] "
        f"Second claim. [chunk_id={chunk_c.id}] "
        f"Third claim. [chunk_id={chunk_b.id}]"
    )
    chat = FakeChatClient(answer, [chunk_a.id, chunk_b.id, chunk_c.id])
    graph = CapturingGraphInvoker(chat)

    with _client(db_session, qdrant, chat, graph) as client:
        response = client.post(
            f"/sessions/{session.id}/messages", json={"content": "Explain the claims."}
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["no_evidence"] is False
    assert (
        payload["assistant_message"]["content"]
        == "First claim. [1] Second claim. [2] Third claim. [3]"
    )
    assert [
        citation["document_chunk_id"]
        for citation in payload["assistant_message"]["citations"]
    ] == [
        chunk_a.id,
        chunk_c.id,
        chunk_b.id,
    ]


def test_post_session_message_falls_back_when_hash_style_citation_token_trails_answer(
    db_session: Session,
) -> None:
    session = create_session(db_session)
    chunk = create_indexed_chunk(
        db_session,
        "Ancient red dragons prefer volcanic lairs and hoard treasure obsessively.",
    )
    qdrant = FakeQdrantIndexer(
        search_hits=[
            QdrantSearchHit(id="point-1", score=0.93, payload={"chunk_id": chunk.id})
        ]
    )
    chat = FakeChatClient(
        "Ancient red dragons prefer volcanic lairs. [84bc7124e9f1]", [chunk.id]
    )
    graph = CapturingGraphInvoker(chat)

    with _client(db_session, qdrant, chat, graph) as client:
        response = client.post(
            f"/sessions/{session.id}/messages",
            json={"content": "What do Ancient red dragons prefer?"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert (
        payload["assistant_message"]["content"]
        == "I do not have enough evidence in the indexed corpus to answer that question."
    )
    assert payload["assistant_message"]["citations"] == []
    assert payload["no_evidence"] is True
    assert (
        db_session.scalars(
            select(Citation).where(
                Citation.assistant_message_id == payload["assistant_message"]["id"]
            )
        ).all()
        == []
    )


def test_post_session_message_falls_back_when_duplicate_hits_drift_into_multiple_labels(
    db_session: Session,
) -> None:
    session = create_session(db_session)
    chunk = create_indexed_chunk(
        db_session,
        "Ancient red dragons prefer volcanic lairs and hoard treasure obsessively.",
    )
    qdrant = FakeQdrantIndexer(
        search_hits=[
            QdrantSearchHit(id="point-1", score=0.95, payload={"chunk_id": chunk.id}),
            QdrantSearchHit(id="point-2", score=0.94, payload={"chunk_id": chunk.id}),
        ]
    )
    chat = FakeChatClient(
        "Ancient red dragons prefer volcanic lairs. [1][2]", [chunk.id, chunk.id]
    )
    graph = CapturingGraphInvoker(chat)

    with _client(db_session, qdrant, chat, graph) as client:
        response = client.post(
            f"/sessions/{session.id}/messages",
            json={"content": "What do Ancient red dragons prefer?"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert (
        payload["assistant_message"]["content"]
        == "I do not have enough evidence in the indexed corpus to answer that question."
    )
    assert payload["assistant_message"]["citations"] == []
    assert payload["no_evidence"] is True
    assert (
        db_session.scalars(
            select(Citation).where(
                Citation.assistant_message_id == payload["assistant_message"]["id"]
            )
        ).all()
        == []
    )


def test_post_session_message_deduplicates_imported_chunks_by_shared_source_span(
    db_session: Session,
) -> None:
    session = create_session(db_session)
    duplicate_a = create_indexed_chunk(
        db_session,
        "Ancient red dragons prefer volcanic lairs and hoard treasure obsessively.",
        filename="monster-manual-a.epub",
    )
    duplicate_b = create_indexed_chunk(
        db_session,
        "Ancient red dragons prefer volcanic lairs and hoard treasure obsessively.",
        filename="monster-manual-b.epub",
    )
    distinct = create_indexed_chunk(
        db_session,
        "Ancient red dragons hate cold climates and seek volcanic lairs.",
        filename="monster-manual-c.epub",
    )

    duplicate_a.metadata_json = json.dumps(
        {
            **json.loads(duplicate_a.metadata_json),
            "source_sha256": "monster-manual-sha256",
            "start_char": 120,
            "end_char": 210,
        },
        sort_keys=True,
    )
    duplicate_b.metadata_json = json.dumps(
        {
            **json.loads(duplicate_b.metadata_json),
            "source_sha256": "monster-manual-sha256",
            "start_char": 120,
            "end_char": 210,
        },
        sort_keys=True,
    )
    distinct.metadata_json = json.dumps(
        {
            **json.loads(distinct.metadata_json),
            "source_sha256": "monster-manual-sha256-distinct",
            "start_char": 330,
            "end_char": 388,
        },
        sort_keys=True,
    )
    db_session.commit()

    qdrant = FakeQdrantIndexer(
        search_hits=[
            QdrantSearchHit(
                id="point-1", score=0.99, payload={"chunk_id": duplicate_a.id}
            ),
            QdrantSearchHit(
                id="point-2", score=0.98, payload={"chunk_id": duplicate_b.id}
            ),
            QdrantSearchHit(
                id="point-3", score=0.97, payload={"chunk_id": distinct.id}
            ),
        ]
    )
    chat = FakeChatClient(
        "Ancient red dragons prefer volcanic lairs. [1] Ancient red dragons hate cold climates. [2]",
        [duplicate_a.id, distinct.id],
    )
    graph = CapturingGraphInvoker(chat)

    with _client(db_session, qdrant, chat, graph) as client:
        response = client.post(
            f"/sessions/{session.id}/messages",
            json={"content": "What do Ancient red dragons prefer?"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert (
        payload["assistant_message"]["content"]
        == "Ancient red dragons prefer volcanic lairs. [1] Ancient red dragons hate cold climates. [2]"
    )
    assert [
        citation["document_chunk_id"]
        for citation in payload["assistant_message"]["citations"]
    ] == [duplicate_a.id, distinct.id]
    assert [request[1] for request in chat.requests] == [[duplicate_a.id, distinct.id]]
    assert [limit for _, limit, _ in qdrant.search_requests] == [50]


def test_post_session_message_falls_back_when_numeric_markers_do_not_match_persisted_citations(
    db_session: Session,
) -> None:
    session = create_session(db_session)
    chunk = create_indexed_chunk(
        db_session,
        "Ancient red dragons prefer volcanic lairs and hoard treasure obsessively.",
    )
    qdrant = FakeQdrantIndexer(
        search_hits=[
            QdrantSearchHit(id="point-1", score=0.93, payload={"chunk_id": chunk.id})
        ]
    )
    chat = FakeChatClient("Ancient red dragons prefer volcanic lairs. [2]", [chunk.id])
    graph = CapturingGraphInvoker(chat)

    with _client(db_session, qdrant, chat, graph) as client:
        response = client.post(
            f"/sessions/{session.id}/messages",
            json={"content": "What do Ancient red dragons prefer?"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert (
        payload["assistant_message"]["content"]
        == "I do not have enough evidence in the indexed corpus to answer that question."
    )
    assert payload["assistant_message"]["citations"] == []
    assert payload["no_evidence"] is True
    assert (
        db_session.scalars(
            select(Citation).where(
                Citation.assistant_message_id == payload["assistant_message"]["id"]
            )
        ).all()
        == []
    )


@contextmanager
def _client(
    db: Session,
    qdrant: FakeQdrantIndexer,
    chat: FakeChatClient,
    graph: CapturingGraphInvoker,
    settings: Settings | None = None,
) -> Generator[TestClient, None, None]:
    def override_db() -> Generator[Session, None, None]:
        yield db

    def override_settings() -> Settings:
        if settings is not None:
            return settings
        return Settings(
            ADMIN_PASSWORD_HASH=os.environ["ADMIN_PASSWORD_HASH"],
            SESSION_SECRET=os.environ["SESSION_SECRET"],
            DATABASE_URL="sqlite+pysqlite:///:memory:",
            RETRIEVAL_TOP_K=5,
            RETRIEVAL_MIN_SCORE=0.2,
        )

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_settings] = override_settings
    app.dependency_overrides[_embedding_dependency] = lambda: FakeEmbeddingClient()
    app.dependency_overrides[_qdrant_dependency] = lambda: qdrant
    app.dependency_overrides[_chat_dependency] = lambda: chat
    app.dependency_overrides[_graph_dependency] = lambda: graph
    with TestClient(app) as test_client:
        assert (
            test_client.post(
                "/auth/login", json={"password": "admin-password"}
            ).status_code
            == 200
        )
        yield test_client
    app.dependency_overrides.clear()


class BoundaryRetrievalService(RetrievalService):
    def __init__(self, db: Session, chunk_id: str, content: str) -> None:
        super().__init__(
            db, FakeEmbeddingClient(), FakeQdrantIndexer(search_hits=[]), Settings()
        )
        self.chunk_id: str = chunk_id
        self.content: str = content
        self.requests: list[tuple[str, str]] = []

    @override
    def retrieve(self, query: str, scope: RetrievalScope) -> RetrievalResult:
        self.requests.append((query, scope.qdrant_collection))
        candidate = RetrievalCandidate(
            chunk_id=self.chunk_id,
            content=self.content,
            score=0.94,
            metadata={"source_filename": "service-boundary.md"},
        )
        return RetrievalResult(
            candidates=[candidate],
            citations=[
                RetrievalCitation(
                    chunk_id=self.chunk_id,
                    label="[1]",
                    metadata={
                        "source_filename": "service-boundary.md",
                        "cited_text": self.content,
                    },
                )
            ],
            trace=RetrievalTrace(
                query_embedding_model="boundary-service",
                query_embedding_dimensions=4,
                requested_limit=1,
                min_score=0.2,
                top_k=1,
                raw_hit_count=1,
                selected_candidate_count=1,
                filtered_low_score_count=0,
                filtered_missing_chunk_count=0,
                deduplicated_count=0,
                scope=scope,
            ),
            weak_result=False,
            weak_reasons=[],
        )


def _activate_runtime(
    db: Session, settings: Settings, version_id: str
) -> RuntimeVersionContext:
    service = VersionLifecycleService(db=db, settings=settings)
    build = service.create_version_namespaces(
        version_id=version_id, archive_bytes=f"archive-{version_id}".encode()
    )
    version = db.get(RuntimeVersion, build.version.id)
    assert version is not None
    version.status = "ready"
    db.flush()
    return service.activate_runtime_version(version.id)
