import json
import os
from contextlib import contextmanager
from collections.abc import Generator

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

os.environ["ADMIN_PASSWORD_HASH"] = "$2b$12$AVhh6Snv3FcaevOnJ0dwR.SfBrkaPp036/Nt/wwdVTsVQNuR1XKx2"
os.environ["SESSION_SECRET"] = "test-session-secret"
os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

from app.chat_rag import _system_prompt, answer_session_message
from app.config import Settings, get_settings
from app.database import get_db
from app.embeddings import EmbeddingError
from app.main import app
from app.models import ChatMessage, RetrievalHit, RetrievalRun
from app.routes_sessions import _chat_dependency, _embedding_dependency, _graph_dependency, _qdrant_dependency
from app.qdrant_index import QdrantSearchHit
from tests.fakes import FakeEmbeddingClient, FakeQdrantIndexer
from tests.rag_support import CapturingGraphInvoker, FakeChatClient, create_indexed_chunk, create_session
from tests.support import db_session


def test_answer_session_message_persists_messages_retrieval_and_thread_config(db_session: Session) -> None:
    session = create_session(db_session)
    chunk = create_indexed_chunk(db_session, "Ancient red dragons prefer volcanic lairs and hoard treasure obsessively.")
    qdrant = FakeQdrantIndexer(search_hits=[QdrantSearchHit(id="point-1", score=0.91, payload={"chunk_id": chunk.id})])
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
    messages = db_session.scalars(select(ChatMessage).where(ChatMessage.chat_session_id == session.id)).all()
    assert [message.role for message in messages] == ["user", "assistant"]
    run = db_session.scalars(select(RetrievalRun).where(RetrievalRun.chat_session_id == session.id)).one()
    assert run.status == "answered"
    assert json.loads(run.metadata_json)["thread_id"] == session.id
    assert db_session.scalars(select(RetrievalHit).where(RetrievalHit.retrieval_run_id == run.id)).one().document_chunk_id == chunk.id
    assert graph.configs == [{"configurable": {"thread_id": session.id}}]


def test_post_session_message_returns_grounded_answer_shape(db_session: Session) -> None:
    session = create_session(db_session)
    chunk = create_indexed_chunk(db_session, "Ancient red dragons prefer volcanic lairs and hoard treasure obsessively.")
    qdrant = FakeQdrantIndexer(search_hits=[QdrantSearchHit(id="point-1", score=0.93, payload={"chunk_id": chunk.id})])
    chat = FakeChatClient("Ancient red dragons prefer volcanic lairs. [1]", [chunk.id])
    graph = CapturingGraphInvoker(chat)

    with _client(db_session, qdrant, chat, graph) as client:
        response = client.post(f"/sessions/{session.id}/messages", json={"content": "Ancient red dragons?"})

    assert response.status_code == 200
    payload = response.json()
    assert set(payload) == {"user_message", "assistant_message", "retrieval_run_id", "no_evidence"}
    assert payload["user_message"]["role"] == "user"
    assert payload["assistant_message"]["role"] == "assistant"
    assert payload["assistant_message"]["content"] == "Ancient red dragons prefer volcanic lairs. [1]"
    assert payload["assistant_message"]["citations"][0]["document_chunk_id"] == chunk.id
    assert payload["assistant_message"]["citations"][0]["metadata"]["source_filename"] == "sample.md"
    assert payload["assistant_message"]["citations"][0]["metadata"]["cited_text"] == "Ancient red dragons prefer volcanic lairs and hoard treasure obsessively."
    assert payload["retrieval_run_id"]
    assert payload["no_evidence"] is False


def test_post_session_message_returns_service_error_for_embedding_failure(db_session: Session) -> None:
    class FailingEmbeddingClient(FakeEmbeddingClient):
        def embed_texts(self, texts):
            raise EmbeddingError("OPENAI_API_KEY is required for embedding")

    session = create_session(db_session)
    qdrant = FakeQdrantIndexer(search_hits=[])
    chat = FakeChatClient("Should not be used", [])
    graph = CapturingGraphInvoker(chat)

    with _client(db_session, qdrant, chat, graph) as client:
        app.dependency_overrides[_embedding_dependency] = lambda: FailingEmbeddingClient()
        response = client.post(f"/sessions/{session.id}/messages", json={"content": "Ancient red dragons?"})

    assert response.status_code == 503
    assert response.json() == {"detail": "OPENAI_API_KEY is required for embedding"}


def test_system_prompt_requires_inline_citation_markers() -> None:
    prompt = _system_prompt()

    assert "[1]" in prompt
    assert "[2][3]" in prompt
    assert "returned citations" in prompt


@contextmanager
def _client(
    db: Session,
    qdrant: FakeQdrantIndexer,
    chat: FakeChatClient,
    graph: CapturingGraphInvoker,
) -> Generator[TestClient, None, None]:
    def override_db() -> Generator[Session, None, None]:
        yield db

    def override_settings() -> Settings:
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
        assert test_client.post("/auth/login", json={"password": "admin-password"}).status_code == 200
        yield test_client
    app.dependency_overrides.clear()
