import json
import os

from sqlalchemy import select
from sqlalchemy.orm import Session

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

from app.chat_rag import NO_EVIDENCE_RESPONSE, answer_session_message
from app.config import Settings
from app.models import Citation, RetrievalRun
from app.qdrant_index import QdrantSearchHit
from tests.fakes import FakeEmbeddingClient, FakeQdrantIndexer
from tests.rag_support import CapturingGraphInvoker, FakeChatClient, create_indexed_chunk, create_session
from tests.support import db_session


def test_weak_retrieval_returns_no_evidence_without_calling_chat(db_session: Session) -> None:
    session = create_session(db_session)
    chunk = create_indexed_chunk(db_session, "Ancient red dragons prefer volcanic lairs.")
    qdrant = FakeQdrantIndexer(search_hits=[QdrantSearchHit(id="point-1", score=0.05, payload={"chunk_id": chunk.id})])
    chat = FakeChatClient("Should not be used", [chunk.id])

    assistant = answer_session_message(
        db_session,
        session.id,
        "What is the tax code in Waterdeep?",
        embedding_client=FakeEmbeddingClient(),
        qdrant_indexer=qdrant,
        chat_client=chat,
        graph_invoker=CapturingGraphInvoker(chat),
        settings=Settings(RETRIEVAL_MIN_SCORE=0.2),
    )

    assert assistant.content == NO_EVIDENCE_RESPONSE
    assert "[" not in assistant.content
    assert chat.requests == []
    assert db_session.scalars(select(Citation).where(Citation.assistant_message_id == assistant.id)).all() == []
    run = db_session.scalars(select(RetrievalRun).where(RetrievalRun.chat_session_id == session.id)).one()
    assert run.status == "no_evidence"
    assert json.loads(run.metadata_json)["weak_reasons"] == ["no_candidates", "all_candidates_below_min_score"]


def test_empty_retrieval_returns_no_evidence(db_session: Session) -> None:
    session = create_session(db_session)
    chat = FakeChatClient("Should not be used", [])

    assistant = answer_session_message(
        db_session,
        session.id,
        "Who rules a place not in the corpus?",
        embedding_client=FakeEmbeddingClient(),
        qdrant_indexer=FakeQdrantIndexer(search_hits=[]),
        chat_client=chat,
        graph_invoker=CapturingGraphInvoker(chat),
        settings=Settings(RETRIEVAL_MIN_SCORE=0.2),
    )

    assert assistant.content == NO_EVIDENCE_RESPONSE
    assert "[" not in assistant.content
    assert chat.requests == []
    run = db_session.scalars(select(RetrievalRun).where(RetrievalRun.chat_session_id == session.id)).one()
    assert run.status == "no_evidence"
    assert json.loads(run.metadata_json)["weak_reasons"] == ["empty_result", "no_candidates"]
