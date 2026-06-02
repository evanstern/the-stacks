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
from app.models import ChatMessage, Citation, RetrievalHit, RetrievalRun
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


def test_post_session_message_returns_archive_viewer_citation_metadata(db_session: Session) -> None:
    session = create_session(db_session)
    chunk = create_indexed_chunk(db_session, "Archive goblins prefer moonlit ruins.", filename="archive.zip")
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
                    {"text": "Bestiary", "level": 1, "id": "bestiary", "slug": "bestiary"},
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
    qdrant = FakeQdrantIndexer(search_hits=[QdrantSearchHit(id="point-1", score=0.93, payload={"chunk_id": chunk.id})])
    chat = FakeChatClient("Archive goblins prefer moonlit ruins. [1]", [chunk.id])
    graph = CapturingGraphInvoker(chat)

    with _client(db_session, qdrant, chat, graph) as client:
        response = client.post(f"/sessions/{session.id}/messages", json={"content": "Where do archive goblins lair?"})

    assert response.status_code == 200
    citation = response.json()["assistant_message"]["citations"][0]
    metadata = citation["metadata"]

    assert citation["document_chunk_id"] == chunk.id
    assert metadata["source_type"] == "archived_webpage"
    assert metadata["source_title"] == "Moonlit Goblin Archive"
    assert metadata["viewer_url"] == f"/records/sources/{chunk.source_id}/archive/viewer?target=archive-target-123"
    assert metadata["target_chunk_id"] == "archive-target-123"
    assert metadata["target_selector"] == "#source-chunk-archive-target-123"
    assert metadata["quote"] == "Archive goblins prefer moonlit ruins."
    assert metadata["section_path"] == metadata["semantic_section"]["path_text"]
    assert metadata["cited_text"] == "Archive goblins prefer moonlit ruins."
    assert metadata["source_filename"] == "archive.zip"
    assert "archive_entry_path" not in metadata
    assert "archive_served_entry_path" not in metadata
    assert "archive_manifest_path" not in metadata
    assert "raw_html_path" not in metadata
    assert "original/index.html" not in json.dumps(metadata)
    assert "/tmp/" not in json.dumps(metadata)


def test_post_session_message_keeps_non_archive_citation_metadata_compatible(db_session: Session) -> None:
    session = create_session(db_session)
    chunk = create_indexed_chunk(db_session, "Plain goblins prefer caves.", filename="plain.html", section="Bestiary")
    qdrant = FakeQdrantIndexer(search_hits=[QdrantSearchHit(id="point-1", score=0.93, payload={"chunk_id": chunk.id})])
    chat = FakeChatClient("Plain goblins prefer caves. [1]", [chunk.id])
    graph = CapturingGraphInvoker(chat)

    with _client(db_session, qdrant, chat, graph) as client:
        response = client.post(f"/sessions/{session.id}/messages", json={"content": "Where do plain goblins lair?"})

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

    assert "JSON with answer and citations as chunk IDs" in prompt
    assert "concise Markdown" in prompt
    assert "Markdown tables" in prompt
    assert "[1]" in prompt
    assert "[2][3]" in prompt
    assert "immediately next to the supported claims" in prompt
    assert "Repeat [1] on every factual sentence that the same source supports." in prompt
    assert "Never leave citations only at the end of a paragraph when they belong to multiple sentences." in prompt
    assert "When two sources support one sentence, keep [1][2] immediately after that sentence." in prompt
    assert "Put citations on each bullet line that makes a factual claim." in prompt


def test_post_session_message_repeats_single_source_citation_on_multiple_factual_sentences(db_session: Session) -> None:
    session = create_session(db_session)
    chunk = create_indexed_chunk(db_session, "Ancient red dragons prefer volcanic lairs and hoard treasure obsessively.")
    qdrant = FakeQdrantIndexer(search_hits=[QdrantSearchHit(id="point-1", score=0.93, payload={"chunk_id": chunk.id})])
    chat = FakeChatClient("Ancient red dragons prefer volcanic lairs. [1] They hoard treasure obsessively. [1]", [chunk.id])
    graph = CapturingGraphInvoker(chat)

    with _client(db_session, qdrant, chat, graph) as client:
        response = client.post(f"/sessions/{session.id}/messages", json={"content": "What do Ancient red dragons prefer?"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["assistant_message"]["content"] == "Ancient red dragons prefer volcanic lairs. [1] They hoard treasure obsessively. [1]"
    assert payload["assistant_message"]["citations"][0]["document_chunk_id"] == chunk.id


def test_post_session_message_derives_archive_citation_section_path_from_semantic_section_path_text(db_session: Session) -> None:
    session = create_session(db_session)
    chunk = create_indexed_chunk(db_session, "Archive goblins prefer moonlit ruins.", filename="archive.zip")
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
                    {"text": "Bestiary", "level": 1, "id": "bestiary", "slug": "bestiary"},
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
    qdrant = FakeQdrantIndexer(search_hits=[QdrantSearchHit(id="point-1", score=0.93, payload={"chunk_id": chunk.id})])
    chat = FakeChatClient("Archive goblins prefer moonlit ruins. [1]", [chunk.id])
    graph = CapturingGraphInvoker(chat)

    with _client(db_session, qdrant, chat, graph) as client:
        response = client.post(f"/sessions/{session.id}/messages", json={"content": "Where do archive goblins lair?"})

    assert response.status_code == 200
    citation = response.json()["assistant_message"]["citations"][0]
    metadata = citation["metadata"]

    assert metadata["section_path"] == metadata["semantic_section"]["path_text"]
    assert metadata["section_path"] != legacy_section_path
    assert metadata["viewer_url"] == f"/records/sources/{chunk.source_id}/archive/viewer?target=archive-target-456"
    assert json.loads(chunk.metadata_json)["section_path"] == legacy_section_path


def test_post_session_message_rewrites_paragraph_end_only_citation_drift(db_session: Session) -> None:
    session = create_session(db_session)
    chunk = create_indexed_chunk(db_session, "Ancient red dragons prefer volcanic lairs and hoard treasure obsessively.")
    qdrant = FakeQdrantIndexer(search_hits=[QdrantSearchHit(id="point-1", score=0.93, payload={"chunk_id": chunk.id})])
    chat = FakeChatClient("Ancient red dragons prefer volcanic lairs. They hoard treasure obsessively. [1][2]", [chunk.id])
    graph = CapturingGraphInvoker(chat)

    with _client(db_session, qdrant, chat, graph) as client:
        response = client.post(f"/sessions/{session.id}/messages", json={"content": "What do Ancient red dragons prefer?"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["assistant_message"]["content"] == "I do not have enough evidence in the indexed corpus to answer that question."
    assert payload["assistant_message"]["citations"] == []
    assert payload["no_evidence"] is True
    assert db_session.scalars(select(RetrievalRun).where(RetrievalRun.chat_session_id == session.id)).one().status == "no_evidence"


def test_post_session_message_keeps_multi_source_citations_immediately_after_sentence(db_session: Session) -> None:
    session = create_session(db_session)
    chunk_a = create_indexed_chunk(db_session, "Ancient red dragons prefer volcanic lairs.", filename="source-a.md")
    chunk_b = create_indexed_chunk(db_session, "Ancient red dragons hoard treasure obsessively.", filename="source-b.md")
    qdrant = FakeQdrantIndexer(
        search_hits=[
            QdrantSearchHit(id="point-1", score=0.97, payload={"chunk_id": chunk_a.id}),
            QdrantSearchHit(id="point-2", score=0.95, payload={"chunk_id": chunk_b.id}),
        ]
    )
    chat = FakeChatClient("Ancient red dragons are volcanic and greedy. [1][2]", [chunk_a.id, chunk_b.id])
    graph = CapturingGraphInvoker(chat)

    with _client(db_session, qdrant, chat, graph) as client:
        response = client.post(f"/sessions/{session.id}/messages", json={"content": "What do Ancient red dragons prefer?"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["assistant_message"]["content"] == "Ancient red dragons are volcanic and greedy. [1][2]"
    assert [citation["document_chunk_id"] for citation in payload["assistant_message"]["citations"]] == [chunk_a.id, chunk_b.id]


def test_post_session_message_attaches_citations_to_each_bullet_line(db_session: Session) -> None:
    session = create_session(db_session)
    chunk = create_indexed_chunk(db_session, "Ancient red dragons prefer volcanic lairs and hoard treasure obsessively.")
    qdrant = FakeQdrantIndexer(search_hits=[QdrantSearchHit(id="point-1", score=0.93, payload={"chunk_id": chunk.id})])
    chat = FakeChatClient("- Ancient red dragons prefer volcanic lairs. [1]\n- Ancient red dragons hoard treasure obsessively. [1]", [chunk.id])
    graph = CapturingGraphInvoker(chat)

    with _client(db_session, qdrant, chat, graph) as client:
        response = client.post(f"/sessions/{session.id}/messages", json={"content": "What do Ancient red dragons prefer?"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["assistant_message"]["content"] == "- Ancient red dragons prefer volcanic lairs. [1]\n- Ancient red dragons hoard treasure obsessively. [1]"
    assert payload["assistant_message"]["citations"][0]["document_chunk_id"] == chunk.id


def test_post_session_message_accepts_valid_citations_at_paragraph_end(db_session: Session) -> None:
    session = create_session(db_session)
    chunk = create_indexed_chunk(db_session, "Ancient red dragons prefer volcanic lairs and hoard treasure obsessively.")
    qdrant = FakeQdrantIndexer(search_hits=[QdrantSearchHit(id="point-1", score=0.93, payload={"chunk_id": chunk.id})])
    chat = FakeChatClient("Ancient red dragons prefer volcanic lairs. They hoard treasure obsessively. [1]", [chunk.id])
    graph = CapturingGraphInvoker(chat)

    with _client(db_session, qdrant, chat, graph) as client:
        response = client.post(f"/sessions/{session.id}/messages", json={"content": "What do Ancient red dragons prefer?"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["assistant_message"]["content"] == "Ancient red dragons prefer volcanic lairs. They hoard treasure obsessively. [1]"
    assert payload["assistant_message"]["citations"][0]["document_chunk_id"] == chunk.id
    assert payload["no_evidence"] is False


def test_post_session_message_derives_citation_order_from_chunk_id_inline_markers(db_session: Session) -> None:
    session = create_session(db_session)
    chunk_a = create_indexed_chunk(db_session, "Source A supports the first claim.", filename="source-a.md")
    chunk_b = create_indexed_chunk(db_session, "Source B supports the third claim.", filename="source-b.md")
    chunk_c = create_indexed_chunk(db_session, "Source C supports the second claim.", filename="source-c.md")
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
        response = client.post(f"/sessions/{session.id}/messages", json={"content": "Explain the claims."})

    assert response.status_code == 200
    payload = response.json()
    assert payload["no_evidence"] is False
    assert payload["assistant_message"]["content"] == "First claim. [1] Second claim. [2] Third claim. [3]"
    assert [citation["document_chunk_id"] for citation in payload["assistant_message"]["citations"]] == [
        chunk_a.id,
        chunk_c.id,
        chunk_b.id,
    ]


def test_post_session_message_falls_back_when_hash_style_citation_token_trails_answer(db_session: Session) -> None:
    session = create_session(db_session)
    chunk = create_indexed_chunk(db_session, "Ancient red dragons prefer volcanic lairs and hoard treasure obsessively.")
    qdrant = FakeQdrantIndexer(search_hits=[QdrantSearchHit(id="point-1", score=0.93, payload={"chunk_id": chunk.id})])
    chat = FakeChatClient("Ancient red dragons prefer volcanic lairs. [84bc7124e9f1]", [chunk.id])
    graph = CapturingGraphInvoker(chat)

    with _client(db_session, qdrant, chat, graph) as client:
        response = client.post(f"/sessions/{session.id}/messages", json={"content": "What do Ancient red dragons prefer?"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["assistant_message"]["content"] == "I do not have enough evidence in the indexed corpus to answer that question."
    assert payload["assistant_message"]["citations"] == []
    assert payload["no_evidence"] is True
    assert db_session.scalars(select(Citation).where(Citation.assistant_message_id == payload["assistant_message"]["id"])).all() == []


def test_post_session_message_falls_back_when_duplicate_hits_drift_into_multiple_labels(db_session: Session) -> None:
    session = create_session(db_session)
    chunk = create_indexed_chunk(db_session, "Ancient red dragons prefer volcanic lairs and hoard treasure obsessively.")
    qdrant = FakeQdrantIndexer(
        search_hits=[
            QdrantSearchHit(id="point-1", score=0.95, payload={"chunk_id": chunk.id}),
            QdrantSearchHit(id="point-2", score=0.94, payload={"chunk_id": chunk.id}),
        ]
    )
    chat = FakeChatClient("Ancient red dragons prefer volcanic lairs. [1][2]", [chunk.id, chunk.id])
    graph = CapturingGraphInvoker(chat)

    with _client(db_session, qdrant, chat, graph) as client:
        response = client.post(f"/sessions/{session.id}/messages", json={"content": "What do Ancient red dragons prefer?"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["assistant_message"]["content"] == "I do not have enough evidence in the indexed corpus to answer that question."
    assert payload["assistant_message"]["citations"] == []
    assert payload["no_evidence"] is True
    assert db_session.scalars(select(Citation).where(Citation.assistant_message_id == payload["assistant_message"]["id"])).all() == []


def test_post_session_message_deduplicates_imported_chunks_by_shared_source_span(db_session: Session) -> None:
    session = create_session(db_session)
    duplicate_a = create_indexed_chunk(db_session, "Ancient red dragons prefer volcanic lairs and hoard treasure obsessively.", filename="monster-manual-a.epub")
    duplicate_b = create_indexed_chunk(db_session, "Ancient red dragons prefer volcanic lairs and hoard treasure obsessively.", filename="monster-manual-b.epub")
    distinct = create_indexed_chunk(db_session, "Ancient red dragons hate cold climates and seek volcanic lairs.", filename="monster-manual-c.epub")

    duplicate_a.metadata_json = json.dumps(
        {**json.loads(duplicate_a.metadata_json), "source_sha256": "monster-manual-sha256", "start_char": 120, "end_char": 210},
        sort_keys=True,
    )
    duplicate_b.metadata_json = json.dumps(
        {**json.loads(duplicate_b.metadata_json), "source_sha256": "monster-manual-sha256", "start_char": 120, "end_char": 210},
        sort_keys=True,
    )
    distinct.metadata_json = json.dumps(
        {**json.loads(distinct.metadata_json), "source_sha256": "monster-manual-sha256-distinct", "start_char": 330, "end_char": 388},
        sort_keys=True,
    )
    db_session.commit()

    qdrant = FakeQdrantIndexer(
        search_hits=[
            QdrantSearchHit(id="point-1", score=0.99, payload={"chunk_id": duplicate_a.id}),
            QdrantSearchHit(id="point-2", score=0.98, payload={"chunk_id": duplicate_b.id}),
            QdrantSearchHit(id="point-3", score=0.97, payload={"chunk_id": distinct.id}),
        ]
    )
    chat = FakeChatClient("Ancient red dragons prefer volcanic lairs. [1] Ancient red dragons hate cold climates. [2]", [duplicate_a.id, distinct.id])
    graph = CapturingGraphInvoker(chat)

    with _client(db_session, qdrant, chat, graph) as client:
        response = client.post(f"/sessions/{session.id}/messages", json={"content": "What do Ancient red dragons prefer?"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["assistant_message"]["content"] == "Ancient red dragons prefer volcanic lairs. [1] Ancient red dragons hate cold climates. [2]"
    assert [citation["document_chunk_id"] for citation in payload["assistant_message"]["citations"]] == [duplicate_a.id, distinct.id]
    assert [request[1] for request in chat.requests] == [[duplicate_a.id, distinct.id]]
    assert [limit for _, limit in qdrant.search_requests] == [50]


def test_post_session_message_falls_back_when_numeric_markers_do_not_match_persisted_citations(db_session: Session) -> None:
    session = create_session(db_session)
    chunk = create_indexed_chunk(db_session, "Ancient red dragons prefer volcanic lairs and hoard treasure obsessively.")
    qdrant = FakeQdrantIndexer(search_hits=[QdrantSearchHit(id="point-1", score=0.93, payload={"chunk_id": chunk.id})])
    chat = FakeChatClient("Ancient red dragons prefer volcanic lairs. [2]", [chunk.id])
    graph = CapturingGraphInvoker(chat)

    with _client(db_session, qdrant, chat, graph) as client:
        response = client.post(f"/sessions/{session.id}/messages", json={"content": "What do Ancient red dragons prefer?"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["assistant_message"]["content"] == "I do not have enough evidence in the indexed corpus to answer that question."
    assert payload["assistant_message"]["citations"] == []
    assert payload["no_evidence"] is True
    assert db_session.scalars(select(Citation).where(Citation.assistant_message_id == payload["assistant_message"]["id"])).all() == []


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
