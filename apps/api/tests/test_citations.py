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


def test_only_valid_retrieved_chunk_ids_become_citations(db_session: Session) -> None:
    session = create_session(db_session)
    chunk = create_indexed_chunk(db_session, "Ancient red dragons prefer volcanic lairs.")
    qdrant = FakeQdrantIndexer(search_hits=[QdrantSearchHit(id="point-1", score=0.88, payload={"chunk_id": chunk.id})])
    chat = FakeChatClient("Ancient red dragons prefer volcanic lairs. [1]", [chunk.id, "invented-chunk"])

    assistant = answer_session_message(
        db_session,
        session.id,
        "Where do Ancient red dragons lair?",
        embedding_client=FakeEmbeddingClient(),
        qdrant_indexer=qdrant,
        chat_client=chat,
        graph_invoker=CapturingGraphInvoker(chat),
        settings=Settings(RETRIEVAL_MIN_SCORE=0.2),
    )

    citations = db_session.scalars(select(Citation).where(Citation.assistant_message_id == assistant.id)).all()
    assert len(citations) == 1
    assert citations[0].document_chunk_id == chunk.id
    assert "Ancient red dragons prefer volcanic lairs." in citations[0].metadata_json


def test_invalid_only_citations_fall_back_to_no_evidence(db_session: Session) -> None:
    session = create_session(db_session)
    chunk = create_indexed_chunk(db_session, "Ancient red dragons prefer volcanic lairs.")
    qdrant = FakeQdrantIndexer(search_hits=[QdrantSearchHit(id="point-1", score=0.88, payload={"chunk_id": chunk.id})])
    chat = FakeChatClient("This answer cites something unavailable. [1]", ["invented-chunk"])

    assistant = answer_session_message(
        db_session,
        session.id,
        "Where do Ancient red dragons lair?",
        embedding_client=FakeEmbeddingClient(),
        qdrant_indexer=qdrant,
        chat_client=chat,
        graph_invoker=CapturingGraphInvoker(chat),
        settings=Settings(RETRIEVAL_MIN_SCORE=0.2),
    )

    assert assistant.content == NO_EVIDENCE_RESPONSE
    assert db_session.scalars(select(Citation).where(Citation.assistant_message_id == assistant.id)).all() == []
    run = db_session.scalars(select(RetrievalRun).where(RetrievalRun.chat_session_id == session.id)).one()
    assert run.status == "no_evidence"
