import json
import os
import importlib.util
from collections.abc import Generator
from contextlib import contextmanager
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import inspect, select
from sqlalchemy.orm import Session

os.environ["ADMIN_PASSWORD_HASH"] = "$2b$12$AVhh6Snv3FcaevOnJ0dwR.SfBrkaPp036/Nt/wwdVTsVQNuR1XKx2"
os.environ["SESSION_SECRET"] = "test-session-secret"
os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

from app.config import Settings, get_settings
from app.database import Base, get_db
from app.ingestion import process_next_job
from app.main import app
from app.chat_rag import PostgresCheckpointedGraphInvoker, RetrievalGraphInvoker, get_graph_invoker, message_citations
from app.models import Document, DocumentChunk, Section, Source
from app.routes_sessions import _chat_dependency, _qdrant_dependency
from tests.rag_support import FakeChatClient, create_indexed_chunk, create_session
from tests.fakes import FakeEmbeddingClient, FakeQdrantIndexer
from app.qdrant_index import QdrantSearchHit
from tests.support import create_upload_and_job, db_session


def test_canonical_schema_tables_exist(db_session: Session) -> None:
    table_names = set(inspect(db_session.bind).get_table_names())

    assert {"sources", "documents", "sections", "chunks"}.issubset(table_names)
    assert "document_chunks" not in table_names


def test_chat_record_foreign_keys_target_canonical_chunks_table(db_session: Session) -> None:
    inspector = inspect(db_session.bind)
    retrieval_hit_fks = inspector.get_foreign_keys("retrieval_hits")
    citation_fks = inspector.get_foreign_keys("citations")

    assert any(fk["referred_table"] == "chunks" and fk["constrained_columns"] == ["document_chunk_id"] for fk in retrieval_hit_fks)
    assert any(fk["referred_table"] == "chunks" and fk["constrained_columns"] == ["document_chunk_id"] for fk in citation_fks)


def test_repair_migration_retargets_legacy_document_chunk_foreign_keys() -> None:
    migration = _load_repair_migration()
    migration.op = _ConstraintRecorder()
    migration._retarget_document_chunk_fk(_LegacyChunkFkInspector(), "retrieval_hits")

    recorder = migration.op
    assert recorder.dropped == [("retrieval_hits", "foreignkey")]
    assert recorder.created == [("retrieval_hits", "chunks", ["document_chunk_id"], ["id"], True)]


def test_ingestion_writes_canonical_source_document_section_chunk_records(db_session: Session, tmp_path: Path) -> None:
    create_upload_and_job(db_session, tmp_path, "sample.md", "# Bestiary\nAncient red dragons prefer volcanic lairs.")

    processed = process_next_job(db_session, embedding_client=FakeEmbeddingClient(), qdrant_indexer=FakeQdrantIndexer())

    assert processed is not None
    source = db_session.scalars(select(Source)).one()
    document = db_session.scalars(select(Document)).one()
    section = db_session.scalars(select(Section)).one()
    chunk = db_session.scalars(select(DocumentChunk)).one()
    assert source.filename == "sample.md"
    assert source.chunk_count == 1
    assert document.source_id == source.id
    assert section.document_id == document.id
    assert chunk.source_id == source.id
    assert chunk.document_id == document.id
    assert chunk.section_id == section.id
    assert chunk.content_hash
    assert chunk.token_count > 0


def test_jobs_route_surface_exposes_detail_and_events(db_session: Session, tmp_path: Path) -> None:
    job = create_upload_and_job(db_session, tmp_path, "sample.md", "# Bestiary\nAncient red dragons prefer volcanic lairs.")

    with _client(db_session) as client:
        detail = client.get(f"/jobs/{job.id}")
        events = client.get(f"/jobs/{job.id}/events")

    assert detail.status_code == 200
    assert detail.json()["id"] == job.id
    assert events.status_code == 200
    assert isinstance(events.json(), list)


def test_records_sources_reads_canonical_sources(db_session: Session, tmp_path: Path) -> None:
    create_upload_and_job(db_session, tmp_path, "sample.md", "# Bestiary\nAncient red dragons prefer volcanic lairs.")
    process_next_job(db_session, embedding_client=FakeEmbeddingClient(), qdrant_indexer=FakeQdrantIndexer())

    with _client(db_session) as client:
        response = client.get("/records/sources")

    assert response.status_code == 200
    payload = response.json()
    assert payload[0]["id"]
    assert payload[0]["original_filename"] == "sample.md"
    assert payload[0]["chunk_count"] == 1
    assert payload[0]["indexed_chunk_count"] == 1


def test_records_stats_reads_total_counts(db_session: Session, tmp_path: Path) -> None:
    create_upload_and_job(db_session, tmp_path, "sample.md", "# Bestiary\nAncient red dragons prefer volcanic lairs.")
    process_next_job(db_session, embedding_client=FakeEmbeddingClient(), qdrant_indexer=FakeQdrantIndexer())

    with _client(db_session) as client:
        response = client.get("/records/stats")

    assert response.status_code == 200
    assert response.json() == {
        "uploads": 1,
        "jobs": 1,
        "sources": 1,
        "chunks": 1,
        "indexed_chunks": 1,
        "retrieval_runs": 0,
    }


def test_openapi_documents_chat_envelope_and_jobs_routes(db_session: Session) -> None:
    with _client(db_session) as client:
        schema = client.get("/openapi.json").json()

    assert "/jobs/{job_id}" in schema["paths"]
    assert "/jobs/{job_id}/events" in schema["paths"]
    response_schema = schema["paths"]["/sessions/{session_id}/messages"]["post"]["responses"]["200"]["content"]["application/json"]["schema"]
    assert response_schema["$ref"].endswith("/ChatMessageEnvelope")


def test_session_message_route_preserves_citation_metadata_and_marker_order(db_session: Session) -> None:
    import app.routes_sessions as routes_sessions

    session = create_session(db_session)
    first_chunk = create_indexed_chunk(db_session, "Ancient red dragons prefer volcanic lairs.", filename="first.md")
    second_chunk = create_indexed_chunk(db_session, "Ancient red dragons hoard treasure obsessively.", filename="second.md")

    with _client(db_session) as client:
        app.dependency_overrides[routes_sessions._qdrant_dependency] = lambda: FakeQdrantIndexer(
            search_hits=[
                QdrantSearchHit(id="point-1", score=0.92, payload={"chunk_id": first_chunk.id}),
                QdrantSearchHit(id="point-2", score=0.88, payload={"chunk_id": second_chunk.id}),
            ]
        )
        app.dependency_overrides[routes_sessions._embedding_dependency] = lambda: FakeEmbeddingClient()
        app.dependency_overrides[routes_sessions._chat_dependency] = lambda: FakeChatClient(
            "Ancient red dragons prefer volcanic lairs [1] and hoard treasure obsessively [2].",
            [second_chunk.id, first_chunk.id],
        )
        response = client.post(f"/sessions/{session.id}/messages", json={"content": "Where do ancient red dragons lair?"})

    assert response.status_code == 200
    payload = response.json()
    citations = payload["assistant_message"]["citations"]
    persisted_citations = message_citations(db_session, payload["assistant_message"]["id"])

    assert [citation["label"] for citation in citations] == [citation.label for citation in persisted_citations]
    assert [citation["document_chunk_id"] for citation in citations] == [first_chunk.id, second_chunk.id]
    assert citations[0]["document_chunk_id"] == first_chunk.id
    assert citations[1]["document_chunk_id"] == second_chunk.id
    assert citations[0]["metadata"]["cited_text"] == "Ancient red dragons prefer volcanic lairs."
    assert citations[1]["metadata"]["cited_text"] == "Ancient red dragons hoard treasure obsessively."
    assert citations[0]["label"] == "[1]"
    assert citations[1]["label"] == "[2]"



def test_postgres_settings_select_checkpointed_langgraph_invoker() -> None:
    sqlite_invoker = get_graph_invoker(FakeChatClient("unused", []), Settings(DATABASE_URL="sqlite+pysqlite:///:memory:"))
    postgres_invoker = get_graph_invoker(
        FakeChatClient("unused", []),
        Settings(DATABASE_URL="postgresql+psycopg://thestacks:thestacks@postgres:5432/thestacks"),
    )

    assert isinstance(sqlite_invoker, RetrievalGraphInvoker)
    assert not isinstance(sqlite_invoker, PostgresCheckpointedGraphInvoker)
    assert isinstance(postgres_invoker, PostgresCheckpointedGraphInvoker)


@contextmanager
def _client(db: Session) -> Generator[TestClient, None, None]:
    def override_db() -> Generator[Session, None, None]:
        yield db

    def override_settings() -> Settings:
        return Settings(
            ADMIN_PASSWORD_HASH=os.environ["ADMIN_PASSWORD_HASH"],
            SESSION_SECRET=os.environ["SESSION_SECRET"],
            DATABASE_URL="sqlite+pysqlite:///:memory:",
        )

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_settings] = override_settings
    with TestClient(app) as test_client:
        assert test_client.post("/auth/login", json={"password": "admin-password"}).status_code == 200
        yield test_client
    app.dependency_overrides.clear()


def _load_repair_migration():
    migration_path = Path(__file__).resolve().parents[1] / "alembic" / "versions" / "20260601_0006_repair_canonical_ingestion_tables.py"
    spec = importlib.util.spec_from_file_location("repair_canonical_ingestion_tables", migration_path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class _ConstraintRecorder:
    def __init__(self) -> None:
        self.dropped: list[tuple[str, str]] = []
        self.created: list[tuple[str, str, list[str], list[str], bool]] = []

    def drop_constraint(self, name: str, table_name: str, type_: str) -> None:
        self.dropped.append((table_name, type_))

    def create_foreign_key(
        self,
        name: str | None,
        source_table: str,
        referent_table: str,
        local_cols: list[str],
        remote_cols: list[str],
        postgresql_not_valid: bool = False,
    ) -> None:
        self.created.append((source_table, referent_table, local_cols, remote_cols, postgresql_not_valid))


class _LegacyChunkFkInspector:
    def get_table_names(self) -> list[str]:
        return ["retrieval_hits"]

    def get_foreign_keys(self, table_name: str) -> list[dict[str, object]]:
        return [
            {
                "name": "retrieval_hits_document_chunk_id_fkey",
                "constrained_columns": ["document_chunk_id"],
                "referred_table": "document_chunks",
            }
        ]
