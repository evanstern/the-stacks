import json
import importlib.util
import io
import os
import zipfile
from collections.abc import Generator, Mapping
from pathlib import Path
from textwrap import dedent
from typing import cast

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

from app.config import Settings, get_settings
from app.database import Base
from app.database import get_db
from app.etl.contracts import (
    NormalizedDocument,
    NormalizedSection,
    PluginFailure,
    PluginFailureCategory,
    PluginMetadata,
    PluginResult,
    SourcePlugin,
    TransformerPlugin,
)
from app.etl.load_services import PostgresLoadResult, PostgresLoadService
from app.ingestion import add_event, claim_next_job, process_claimed_job, process_next_job, process_next_queued_job
from app.main import app
from app.models import Document, DocumentChunk, IngestionEvent, IngestionJob, Section, Source, Upload, UploadBatch, utcnow
from tests.fakes import FakeEmbeddingClient, FakeQdrantIndexer


class FailingQdrantIndexer(FakeQdrantIndexer):
    def upsert_points(self, points: object) -> None:
        raise RuntimeError("qdrant unavailable at /srv/the-stacks/private/collection")


class FailingPostgresLoadService(PostgresLoadService):
    def persist_document(self, *args: object, **kwargs: object) -> PostgresLoadResult:
        raise SQLAlchemyError("postgres write failed")


class RunnerSuccessPlugin(SourcePlugin):
    metadata: PluginMetadata = PluginMetadata(name="runner_success", version="1.0.0", source_types=("runner",))

    def __init__(self) -> None:
        self.calls: list[tuple[Path, dict[str, object]]] = []

    def extract(self, source_path: Path, source_metadata: Mapping[str, object] | None = None) -> PluginResult:
        metadata = dict(source_metadata or {})
        self.calls.append((source_path, metadata))
        return PluginResult(
            document=NormalizedDocument(
                source_type="runner",
                parser="runner_success",
                title="Runner title",
                sections=(NormalizedSection(text="Runner plugin text.", heading="Runner heading"),),
            )
        )


class TypedFailurePlugin(SourcePlugin):
    metadata: PluginMetadata = PluginMetadata(name="typed_failure", version="1.0.0", source_types=("runner",))

    def extract(self, source_path: Path, source_metadata: Mapping[str, object] | None = None) -> PluginResult:
        del source_path, source_metadata
        return PluginResult(
            failure=PluginFailure(
                category=PluginFailureCategory.PARSE_ERROR,
                message="Typed plugin says no",
                diagnostics={"private_path": "/srv/private/plugin.log"},
            )
        )


class RaisingPlugin(SourcePlugin):
    metadata: PluginMetadata = PluginMetadata(name="raising_plugin", version="1.0.0", source_types=("runner",))

    def extract(self, source_path: Path, source_metadata: Mapping[str, object] | None = None) -> PluginResult:
        del source_path, source_metadata
        raise RuntimeError("plugin exploded at /srv/private/plugin.py")


class EmptyTransformer(TransformerPlugin):
    metadata: PluginMetadata = PluginMetadata(name="empty_transformer", version="1.0.0", source_types=("runner",))

    def transform(self, document: NormalizedDocument) -> NormalizedDocument:
        del document
        return NormalizedDocument(source_type="runner", parser="empty_transformer", sections=(NormalizedSection(text="   "),))


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_worker_claims_oldest_queued_job_transactionally(db_session: Session, tmp_path: Path) -> None:
    first = _create_upload_and_job(db_session, tmp_path, "first.md", "First")
    second = _create_upload_and_job(db_session, tmp_path, "second.md", "Second")

    claimed = claim_next_job(db_session)

    assert claimed is not None
    assert claimed.id == first.id
    assert claimed.status == "processing"
    assert db_session.get(IngestionJob, second.id).status == "queued"
    assert _event_types(db_session, first.id) == ["queued", "processing"]


def test_worker_processes_markdown_to_awaiting_embedding(db_session: Session, tmp_path: Path) -> None:
    job = _create_upload_and_job(db_session, tmp_path, "dragons.md", "# Dragons\nAncient red dragons prefer volcanic lairs.")

    claimed = claim_next_job(db_session)
    assert claimed is not None
    processed = process_claimed_job(db_session, claimed.id, continue_to_index=False)

    assert processed is not None
    assert processed.id == job.id
    assert processed.status == "awaiting_embedding"
    assert processed.error_summary is None
    metadata = json.loads(processed.metadata_json)
    assert metadata["parser"] == "markdown"
    assert metadata["title"] == "Dragons"
    assert metadata["chunk_count"] == 1

    chunks = db_session.scalars(select(DocumentChunk).where(DocumentChunk.ingestion_job_id == job.id)).all()
    assert len(chunks) == 1
    assert chunks[0].chunk_index == 0
    assert chunks[0].content == "Ancient red dragons prefer volcanic lairs."
    chunk_metadata = json.loads(chunks[0].metadata_json)
    assert chunk_metadata["section_heading"] == "Dragons"
    assert chunk_metadata["source_filename"] == "dragons.md"
    assert db_session.scalars(select(Source)).one().filename == "dragons.md"
    assert db_session.scalars(select(Document)).one().source_id == chunks[0].source_id
    assert db_session.scalars(select(Section)).one().id == chunks[0].section_id

    assert _event_types(db_session, job.id) == [
        "queued",
        "processing",
        "parsing_started",
        "parsing_completed",
        "chunking_started",
        "chunking_completed",
        "awaiting_embedding",
    ]


def test_process_next_queued_job_stops_after_chunking_without_embedding(db_session: Session, tmp_path: Path) -> None:
    job = _create_upload_and_job(db_session, tmp_path, "dragons.md", "# Dragons\nAncient red dragons prefer volcanic lairs.")

    processed = process_next_queued_job(db_session)

    assert processed is not None
    assert processed.id == job.id
    assert processed.status == "awaiting_embedding"
    assert db_session.scalars(select(DocumentChunk).where(DocumentChunk.ingestion_job_id == job.id)).all()
    assert _event_types(db_session, job.id) == [
        "queued",
        "processing",
        "parsing_started",
        "parsing_completed",
        "chunking_started",
        "chunking_completed",
        "awaiting_embedding",
    ]


def test_direct_sequential_runner_plugin_success_uses_host_load_services(db_session: Session, tmp_path: Path) -> None:
    job = _create_upload_and_job(db_session, tmp_path, "runner.md", "ignored by fake plugin")
    claimed = claim_next_job(db_session)
    assert claimed is not None
    plugin = RunnerSuccessPlugin()

    processed = process_claimed_job(db_session, claimed.id, continue_to_index=False, source_plugin=plugin)

    assert processed.status == "awaiting_embedding"
    assert plugin.calls == [(tmp_path / "runner.md", {})]
    metadata = json.loads(processed.metadata_json)
    assert metadata["parser"] == "runner_success"
    assert metadata["title"] == "Runner title"
    chunks = db_session.scalars(select(DocumentChunk).where(DocumentChunk.ingestion_job_id == job.id)).all()
    assert len(chunks) == 1
    assert chunks[0].content == "Runner plugin text."
    assert db_session.scalars(select(Source)).one().source_type == "runner"
    assert _event_types(db_session, job.id) == [
        "queued",
        "processing",
        "parsing_started",
        "parsing_completed",
        "chunking_started",
        "chunking_completed",
        "awaiting_embedding",
    ]


def test_direct_sequential_runner_typed_plugin_failure_marks_job_failed(db_session: Session, tmp_path: Path) -> None:
    job = _create_upload_and_job(db_session, tmp_path, "typed.md", "ignored")
    claimed = claim_next_job(db_session)
    assert claimed is not None

    processed = process_claimed_job(db_session, claimed.id, continue_to_index=False, source_plugin=TypedFailurePlugin())

    assert processed.status == "failed"
    assert processed.error_summary == "Import plugin failed. Review the file and try again."
    failure = json.loads(processed.metadata_json)["failure"]
    assert failure["filename"] == "typed.md"
    assert failure["category"] == "plugin_error"
    assert failure["message"] == processed.error_summary
    assert "Typed plugin says no" in failure["diagnostics"]["summary"]
    assert db_session.scalars(select(DocumentChunk).where(DocumentChunk.ingestion_job_id == job.id)).all() == []
    assert _event_types(db_session, job.id) == ["queued", "processing", "job_failed"]


def test_direct_sequential_runner_unexpected_plugin_exception_is_sanitized(db_session: Session, tmp_path: Path) -> None:
    job = _create_upload_and_job(db_session, tmp_path, "raising.md", "ignored")
    claimed = claim_next_job(db_session)
    assert claimed is not None

    processed = process_claimed_job(db_session, claimed.id, continue_to_index=False, source_plugin=RaisingPlugin())

    assert processed.status == "failed"
    assert processed.error_summary == "Import failed. Review the file and try again."
    failure = json.loads(processed.metadata_json)["failure"]
    assert failure["category"] == "unknown_error"
    assert failure["message"] == processed.error_summary
    assert "plugin exploded" in failure["diagnostics"]["summary"]
    public_text = json.dumps({"error_summary": processed.error_summary, "message": failure["message"]})
    assert "plugin exploded" not in public_text
    assert "/srv/private" not in public_text
    assert _event_types(db_session, job.id) == ["queued", "processing", "job_failed"]


def test_direct_sequential_runner_empty_transform_output_fails_before_load(db_session: Session, tmp_path: Path) -> None:
    job = _create_upload_and_job(db_session, tmp_path, "empty-transform.md", "ignored")
    claimed = claim_next_job(db_session)
    assert claimed is not None

    processed = process_claimed_job(
        db_session,
        claimed.id,
        continue_to_index=False,
        source_plugin=RunnerSuccessPlugin(),
        transformers=(EmptyTransformer(),),
    )

    assert processed.status == "failed"
    assert processed.error_summary == "Import plugin failed. Review the file and try again."
    failure = json.loads(processed.metadata_json)["failure"]
    assert failure["category"] == "plugin_error"
    assert "Transformer produced no sections" in failure["diagnostics"]["summary"]
    assert db_session.scalars(select(DocumentChunk).where(DocumentChunk.ingestion_job_id == job.id)).all() == []
    assert _event_types(db_session, job.id) == ["queued", "processing", "job_failed"]


def test_direct_sequential_runner_failure_propagates_to_job_status(db_session: Session, tmp_path: Path) -> None:
    job = _create_upload_and_job(db_session, tmp_path, "propagate.md", "ignored")
    processed = process_next_job(
        db_session,
        embedding_client=FakeEmbeddingClient(dimensions=3),
        qdrant_indexer=FakeQdrantIndexer(),
        source_plugin=TypedFailurePlugin(),
    )

    assert processed is not None
    assert processed.id == job.id
    assert processed.status == "failed"
    assert processed.error_summary == "Import plugin failed. Review the file and try again."
    assert db_session.scalars(select(DocumentChunk).where(DocumentChunk.ingestion_job_id == job.id)).all() == []


def test_worker_entrypoint_uses_full_drain_helper(db_session: Session, tmp_path: Path) -> None:
    worker_path = tmp_path / "main" / "apps" / "worker" / "worker.py"
    worker_path.parent.mkdir(parents=True, exist_ok=True)
    worker_path.write_text(
        dedent(
            '''
            import os
            import signal
            import time

            from app.database import SessionLocal
            from app.ingestion import process_next_job


            running = True


            def handle_shutdown(signum: int, frame: object) -> None:
                global running
                running = False


            signal.signal(signal.SIGTERM, handle_shutdown)
            signal.signal(signal.SIGINT, handle_shutdown)


            def main() -> None:
                upload_dir = os.getenv("UPLOAD_DIR", "/data/uploads")
                poll_seconds = float(os.getenv("WORKER_POLL_SECONDS", "5"))
                run_once = os.getenv("WORKER_RUN_ONCE", "false").lower() in {"1", "true", "yes"}
                print(f"Worker ready; upload_dir={upload_dir}; mode=full-drain", flush=True)

                while running:
                    with SessionLocal() as db:
                        job = process_next_job(db)
                    if job is not None:
                        print(f"Processed ingestion job {job.id}; status={job.status}", flush=True)
                    if run_once:
                        break
                    time.sleep(poll_seconds)


            if __name__ == "__main__":
                main()
            '''
        ).lstrip(),
        encoding="utf-8",
    )

    spec = importlib.util.spec_from_file_location("worker", worker_path)
    assert spec is not None and spec.loader is not None
    worker = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(worker)

    calls: list[str] = []

    class FakeSession:
        def __enter__(self) -> object:
            return object()

        def __exit__(self, exc_type, exc, tb) -> bool:
            return False

    def fake_session_factory() -> FakeSession:
        return FakeSession()

    def fake_process_next_job(db: object) -> object | None:
        calls.append("process_next_job")
        return None

    worker.SessionLocal = fake_session_factory
    worker.process_next_job = fake_process_next_job
    worker.running = True
    worker.os.environ["WORKER_RUN_ONCE"] = "true"

    worker.main()

    assert calls == ["process_next_job"]


def test_worker_marks_parser_failures_failed_with_event(db_session: Session, tmp_path: Path) -> None:
    job = _create_upload_and_job(db_session, tmp_path, "book.epub", "placeholder", extension=".epub")

    claimed = claim_next_job(db_session)
    assert claimed is not None
    processed = process_claimed_job(db_session, claimed.id, continue_to_index=False)

    assert processed is not None
    assert processed.status == "failed"
    assert processed.error_summary is not None
    assert processed.error_summary == "Uploaded archive is not a valid ZIP file."
    failure = json.loads(processed.metadata_json)["failure"]
    assert failure["filename"] == "book.epub"
    assert failure["category"] == "invalid_zip"
    assert failure["message"] == "Uploaded archive is not a valid ZIP file."
    assert failure["diagnostics"]["exception_type"] == "ParserError"
    assert "valid EPUB archive" in failure["diagnostics"]["summary"]
    assert db_session.scalars(select(DocumentChunk).where(DocumentChunk.ingestion_job_id == job.id)).all() == []
    assert _event_types(db_session, job.id) == ["queued", "processing", "job_failed"]


def test_worker_parser_failure_stores_structured_metadata_without_public_leak(db_session: Session, tmp_path: Path) -> None:
    job = _create_upload_and_job(
        db_session,
        tmp_path,
        "malformed-ddb.html",
        """
        <html><head><link rel="canonical" href="https://www.dndbeyond.com/sources/test/broken"></head>
        <body><article class="ddb-article"><h1>Broken DDB</h1></article></body></html>
        """,
        extension=".html",
        content_type="text/html",
    )

    claimed = claim_next_job(db_session)
    assert claimed is not None
    processed = process_claimed_job(db_session, claimed.id, continue_to_index=False)

    assert processed.status == "failed"
    assert processed.error_summary == "D&D Beyond saved HTML could not be parsed. Review the saved page and try again."
    failure = json.loads(processed.metadata_json)["failure"]
    assert failure["filename"] == "malformed-ddb.html"
    assert failure["category"] == "ddb_parse_error"
    assert failure["message"] == processed.error_summary
    assert failure["diagnostics"]["exception_type"] == "DdbParserError"
    assert "Traceback" in failure["diagnostics"]["traceback"]


def test_multi_zip_jobs_independent_after_parser_failure_and_batch_aggregate_partial_failed(
    db_session: Session,
    tmp_path: Path,
) -> None:
    os.environ["ADMIN_PASSWORD_HASH"] = "$2b$12$AVhh6Snv3FcaevOnJ0dwR.SfBrkaPp036/Nt/wwdVTsVQNuR1XKx2"
    os.environ["SESSION_SECRET"] = "test-session-secret"
    now = utcnow()
    batch = UploadBatch(status="queued", file_count=2, created_at=now, updated_at=now)
    db_session.add(batch)
    db_session.flush()
    failed_job = _create_upload_and_job(
        db_session,
        tmp_path,
        "malformed-ddb.zip",
        """
        <html><head><link rel="canonical" href="https://www.dndbeyond.com/sources/test/broken"></head>
        <body><article class="ddb-article"><h1>Broken DDB</h1></article></body></html>
        """,
        extension=".html",
        content_type="application/zip",
        batch_id=batch.id,
        batch_position=0,
    )
    completed_job = _create_upload_and_job(
        db_session,
        tmp_path,
        "valid-ddb-b.zip",
        "# Valid sibling\nQueued siblings continue after a failed import.",
        extension=".md",
        content_type="application/zip",
        batch_id=batch.id,
        batch_position=1,
    )

    first = process_next_job(db_session, embedding_client=FakeEmbeddingClient(dimensions=3), qdrant_indexer=FakeQdrantIndexer())
    second = process_next_job(db_session, embedding_client=FakeEmbeddingClient(dimensions=3), qdrant_indexer=FakeQdrantIndexer())

    assert first is not None
    assert first.id == failed_job.id
    assert first.status == "failed"
    assert second is not None
    assert second.id == completed_job.id
    assert second.status == "completed"

    def override_db() -> Generator[Session, None, None]:
        yield db_session

    def override_settings() -> Settings:
        return Settings(
            ADMIN_PASSWORD_HASH=os.environ["ADMIN_PASSWORD_HASH"],
            SESSION_SECRET=os.environ["SESSION_SECRET"],
            DATABASE_URL="sqlite+pysqlite:///:memory:",
            UPLOAD_DIR=str(tmp_path / "uploads"),
        )

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_settings] = override_settings
    with TestClient(app) as client:
        assert client.post("/auth/login", json={"password": "admin-password"}).status_code == 200
        response = client.get(f"/uploads/batches/{batch.id}")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "partial_failed"
    assert payload["summary"] == {"queued": 0, "running": 0, "completed": 1, "partial_failed": 1, "failed": 1, "total": 2}
    failed_error = payload["items"][0]["error"]
    assert failed_error == {
        "filename": "malformed-ddb.zip",
        "category": "ddb_parse_error",
        "message": "D&D Beyond saved HTML could not be parsed. Review the saved page and try again.",
    }
    response_text = json.dumps(payload)
    assert "Traceback" not in response_text
    assert str(tmp_path) not in response_text
    assert "DdbParserError(" not in response_text
    assert payload["items"][1]["error"] is None


def test_worker_categorizes_indexing_failure_without_public_diagnostics(db_session: Session, tmp_path: Path) -> None:
    job = _create_upload_and_job(db_session, tmp_path, "index-me.md", "# Index me\nThis chunk reaches Qdrant.")

    processed = process_next_job(
        db_session,
        embedding_client=FakeEmbeddingClient(dimensions=3),
        qdrant_indexer=FailingQdrantIndexer(),
    )

    assert processed is not None
    assert processed.id == job.id
    assert processed.status == "failed"
    assert processed.error_summary == "Search indexing failed. Try again later."
    failure = json.loads(processed.metadata_json)["failure"]
    assert failure["filename"] == "index-me.md"
    assert failure["category"] == "qdrant_index_error"
    assert failure["message"] == "Search indexing failed. Try again later."
    assert "qdrant unavailable" in failure["diagnostics"]["summary"]
    assert "/srv/the-stacks/private" in failure["diagnostics"]["summary"]
    public_text = json.dumps({"error_summary": processed.error_summary, "category": failure["category"], "message": failure["message"]})
    assert "qdrant unavailable" not in public_text
    assert "/srv/the-stacks/private" not in public_text


def test_postgres_load_failure_prevents_embedding_and_qdrant_load(db_session: Session, tmp_path: Path) -> None:
    job = _create_upload_and_job(db_session, tmp_path, "persist-me.md", "# Persist me\nThis should not reach embeddings.")
    claimed = claim_next_job(db_session)
    assert claimed is not None
    embeddings = FakeEmbeddingClient(dimensions=3)
    qdrant = FakeQdrantIndexer()

    processed = process_claimed_job(
        db_session,
        claimed.id,
        embedding_client=embeddings,
        qdrant_indexer=qdrant,
        postgres_load_service=FailingPostgresLoadService(),
    )

    assert processed.status == "failed"
    assert processed.error_summary == "The import could not be saved. Try again later."
    failure = json.loads(processed.metadata_json)["failure"]
    assert failure["category"] == "database_error"
    assert db_session.scalars(select(DocumentChunk).where(DocumentChunk.ingestion_job_id == job.id)).all() == []
    assert embeddings.requests == []
    assert qdrant.ensured_dimensions == []
    assert qdrant.points == []
    assert _event_types(db_session, job.id) == ["queued", "processing", "job_failed"]


def test_qdrant_failure_after_postgres_load_preserves_terminal_failure_semantics(db_session: Session, tmp_path: Path) -> None:
    job = _create_upload_and_job(db_session, tmp_path, "index-me.md", "# Index me\nThis reaches PostgreSQL before Qdrant fails.")

    processed = process_next_job(
        db_session,
        embedding_client=FakeEmbeddingClient(dimensions=3),
        qdrant_indexer=FailingQdrantIndexer(),
    )

    assert processed is not None
    assert processed.status == "failed"
    assert processed.error_summary == "Search indexing failed. Try again later."
    assert db_session.scalars(select(Source).where(Source.upload_id == processed.upload_id)).all()
    assert db_session.scalars(select(DocumentChunk).where(DocumentChunk.ingestion_job_id == job.id)).all()
    assert _event_types(db_session, job.id)[-1] == "job_failed"


def test_job_detail_redacts_private_failure_diagnostics(db_session: Session, tmp_path: Path) -> None:
    os.environ["ADMIN_PASSWORD_HASH"] = "$2b$12$AVhh6Snv3FcaevOnJ0dwR.SfBrkaPp036/Nt/wwdVTsVQNuR1XKx2"
    os.environ["SESSION_SECRET"] = "test-session-secret"
    job = _create_upload_and_job(db_session, tmp_path, "index-me.md", "# Index me\nThis chunk reaches Qdrant.")

    processed = process_next_job(
        db_session,
        embedding_client=FakeEmbeddingClient(dimensions=3),
        qdrant_indexer=FailingQdrantIndexer(),
    )

    assert processed is not None
    assert processed.id == job.id
    persisted_failure = json.loads(processed.metadata_json)["failure"]
    assert "diagnostics" in persisted_failure
    assert "qdrant unavailable" in persisted_failure["diagnostics"]["summary"]
    assert "/srv/the-stacks/private" in persisted_failure["diagnostics"]["summary"]

    def override_db() -> Generator[Session, None, None]:
        yield db_session

    def override_settings() -> Settings:
        return Settings(
            ADMIN_PASSWORD_HASH=os.environ["ADMIN_PASSWORD_HASH"],
            SESSION_SECRET=os.environ["SESSION_SECRET"],
            DATABASE_URL="sqlite+pysqlite:///:memory:",
            UPLOAD_DIR=str(tmp_path / "uploads"),
        )

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_settings] = override_settings
    with TestClient(app) as client:
        assert client.post("/auth/login", json={"password": "admin-password"}).status_code == 200
        response = client.get(f"/jobs/{job.id}")
        alias_response = client.get(f"/ingestion/jobs/{job.id}")
    app.dependency_overrides.clear()

    for job_response in (response, alias_response):
        assert job_response.status_code == 200
        payload = job_response.json()
        assert payload["error_summary"] == "Search indexing failed. Try again later."
        assert payload["metadata"]["failure"] == {
            "filename": "index-me.md",
            "category": "qdrant_index_error",
            "message": "Search indexing failed. Try again later.",
        }
        response_text = json.dumps(payload)
        assert "diagnostics" not in response_text
        assert "Traceback" not in response_text
        assert "/srv/" not in response_text
        assert "/tmp/" not in response_text
        assert "qdrant unavailable" not in response_text
        assert "/srv/the-stacks/private" not in response_text


def test_worker_surfaces_html_parser_warnings_in_events_and_metadata(db_session: Session, tmp_path: Path) -> None:
    fixture = Path(__file__).resolve().parent / "fixtures" / "sample.html"
    job = _create_upload_and_job(
        db_session,
        tmp_path,
        "sample.html",
        fixture.read_text(encoding="utf-8"),
        extension=".html",
        content_type="text/html",
    )

    claimed = claim_next_job(db_session)
    assert claimed is not None
    processed = process_claimed_job(db_session, claimed.id, continue_to_index=False)

    assert processed is not None
    assert processed.status == "awaiting_embedding"
    metadata = json.loads(processed.metadata_json)
    assert metadata["title"] == "Bestiary"
    assert metadata["parser_warnings"]

    events = db_session.scalars(select(IngestionEvent).where(IngestionEvent.ingestion_job_id == job.id)).all()
    parsing_completed = next(event for event in events if event.event_type == "parsing_completed")
    parsing_completed_metadata = json.loads(parsing_completed.metadata_json)
    assert parsing_completed_metadata["warnings"]
    assert any(event.event_type == "parsing_warnings" for event in events)


def test_worker_persists_ddb_saved_html_chunk_metadata(db_session: Session, tmp_path: Path) -> None:
    fixture = Path(__file__).resolve().parent / "fixtures" / "ddb" / "a-world-of-your-own-ddb.html"
    job = _create_upload_and_job(
        db_session,
        tmp_path,
        "a-world-of-your-own-ddb.html",
        fixture.read_text(encoding="utf-8"),
        extension=".html",
        content_type="text/html",
    )

    claimed = claim_next_job(db_session)
    assert claimed is not None
    processed = process_claimed_job(db_session, claimed.id, continue_to_index=False)

    assert processed is not None
    assert processed.status == "awaiting_embedding"
    metadata = json.loads(processed.metadata_json)
    assert metadata["parser"] == "ddb_saved_html"
    assert metadata["title"] == "A World of Your Own"
    assert metadata["book_title"] == "Dungeon Master’s Guide (2014)"
    assert metadata["document_title"] == "A World of Your Own"
    artifact_dir = Path(str(tmp_path / "a-world-of-your-own-ddb.html") + ".artifacts")
    assert metadata["raw_html_path"] == str(artifact_dir / "raw.html")
    assert metadata["rendered_html_path"] == str(artifact_dir / "rendered.html")
    assert metadata["jsonl_path"] == str(artifact_dir / "chunks.jsonl")
    assert (artifact_dir / "raw.html").read_text(encoding="utf-8") == fixture.read_text(encoding="utf-8")
    assert (artifact_dir / "rendered.html").is_file()
    jsonl_records = [json.loads(line) for line in (artifact_dir / "chunks.jsonl").read_text(encoding="utf-8").splitlines()]
    assert jsonl_records[0]["source_type"] == "ddb_saved_html"
    assert jsonl_records[0]["book_title"] == "Dungeon Master’s Guide (2014)"
    assert jsonl_records[0]["document_title"] == "A World of Your Own"
    assert jsonl_records[0]["content_chunk_id"] == "AWorldofYourOwn"
    assert jsonl_records[0]["semantic_section"]["heading"]["id"] == "AWorldofYourOwn"
    assert jsonl_records[0]["semantic_section"]["heading"]["level"] == 1
    assert jsonl_records[0]["semantic_section"]["path_text"] == ["A World of Your Own"]
    assert jsonl_records[0]["heading_level"] == 1
    assert jsonl_records[0]["heading_id"] == "AWorldofYourOwn"
    assert jsonl_records[0]["section_path"] == ["A World of Your Own"]
    assert jsonl_records[0]["content_chunk_ids"] == ["chunk-root", "chunk-intro"]
    assert jsonl_records[0]["chunk_index"] == 0
    assert jsonl_records[0]["citation"] == {
        "label": "A World of Your Own",
        "source_url": "https://www.dndbeyond.com/sources/dnd/dmg-2014/a-world-of-your-own#AWorldofYourOwn",
        "raw_html_path": str(artifact_dir / "raw.html"),
        "rendered_html_path": str(artifact_dir / "rendered.html"),
        "jsonl_path": str(artifact_dir / "chunks.jsonl"),
        "raw_sha256": metadata["raw_sha256"],
        "heading_id": "AWorldofYourOwn",
        "content_chunk_ids": ["chunk-root", "chunk-intro"],
    }
    assert 'data-content-chunk-id="chunk-root"' in jsonl_records[0]["html"]
    manifest = json.loads((artifact_dir / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["parser"] == "ddb_saved_html"
    assert manifest["book_title"] == "Dungeon Master’s Guide (2014)"
    assert manifest["document_title"] == "A World of Your Own"
    assert "heading_level" not in manifest
    assert "heading_id" not in manifest
    assert "section_path" not in manifest
    assert "content_chunk_ids" not in manifest
    assert "source_content_ids" not in manifest

    chunks = db_session.scalars(
        select(DocumentChunk).where(DocumentChunk.ingestion_job_id == job.id).order_by(DocumentChunk.chunk_index)
    ).all()
    assert len(chunks) == 3
    chunk_metadata = [json.loads(chunk.metadata_json) for chunk in chunks]
    assert chunk_metadata[0]["source_type"] == "ddb_saved_html"
    assert chunk_metadata[0]["book_title"] == "Dungeon Master’s Guide (2014)"
    assert chunk_metadata[0]["document_title"] == "A World of Your Own"
    assert chunk_metadata[0]["raw_sha256"]
    assert chunk_metadata[0]["raw_html_path"] == str(artifact_dir / "raw.html")
    assert chunk_metadata[0]["content_chunk_id"] == "AWorldofYourOwn"
    assert chunk_metadata[0]["heading_id"] == "AWorldofYourOwn"
    assert chunk_metadata[0]["section_path"] == ["A World of Your Own"]
    assert chunk_metadata[0]["content_chunk_ids"] == ["chunk-root", "chunk-intro"]
    assert chunk_metadata[0]["citation_anchor"] == "#AWorldofYourOwn"
    assert chunk_metadata[0]["semantic_section"]["heading"]["id"] == "AWorldofYourOwn"
    assert chunk_metadata[1]["semantic_section"]["heading"]["id"] == "TheBigPicture"
    assert chunk_metadata[1]["semantic_section"]["path_text"] == ["A World of Your Own", "The Big Picture"]
    assert chunk_metadata[2]["semantic_section"]["heading"]["id"] == "CoreAssumptions"
    assert chunk_metadata[1]["heading_id"] == "TheBigPicture"
    assert chunk_metadata[1]["section_path"] == ["A World of Your Own", "The Big Picture"]
    assert chunk_metadata[1]["content_chunk_ids"] == ["chunk-big-picture", "chunk-big-picture-body", "chunk-list"]
    assert chunk_metadata[1]["citation_anchor"] == "#TheBigPicture"
    assert chunk_metadata[2]["heading_id"] == "CoreAssumptions"
    assert chunk_metadata[2]["section_path"] == ["A World of Your Own", "The Big Picture", "Core Assumptions"]
    assert chunk_metadata[2]["content_chunk_ids"] == ["chunk-core-assumptions", "chunk-table"]
    assert chunk_metadata[2]["citation_anchor"] == "#CoreAssumptions"


def test_worker_indexes_archive_from_served_html_with_locator_metadata(db_session: Session, tmp_path: Path) -> None:
    from app.archive_storage import store_source_archive
    from app.config import Settings
    from tests.fakes import FakeEmbeddingClient, FakeQdrantIndexer

    source_id = "archive-source-worker"
    archive = store_source_archive(
        source_id=source_id,
        original_filename="saved-page.zip",
        content=_zip_bytes(
            {
                "page.html": b"""
                <html>
                  <head>
                    <title>Archive title</title>
                    <link rel="canonical" href="https://example.test/archive-source">
                  </head>
                  <body><h1>Archive heading</h1><script>bad()</script><p onclick="bad()">Safe archive quote.</p></body>
                </html>
                """,
            }
        ),
        settings=Settings(UPLOAD_DIR=str(tmp_path / "uploads")),
    )
    upload = Upload(
        original_filename="saved-page.zip",
        stored_path=str(archive.served_html_path),
        content_type="application/zip",
        extension=".html",
        sha256="zip-sha",
        size_bytes=1,
        created_at=utcnow(),
    )
    db_session.add(upload)
    db_session.flush()
    job_metadata = {
        "source_id": source_id,
        "source_type": "archived_webpage",
        "archive_manifest_path": str(archive.manifest_path),
        "archive_entry_path": "page.html",
        "archive_primary_html_path": "page.html",
        "archive_served_entry_path": "page.html",
        "archive_served_html_path": "page.html",
        "archive_anchor_map_path": "anchor-map.json",
        "source_url": archive.manifest["source_url"],
    }
    job = IngestionJob(
        upload_id=upload.id,
        status="queued",
        metadata_json=json.dumps(job_metadata),
        created_at=utcnow(),
        updated_at=utcnow(),
    )
    db_session.add(job)
    db_session.flush()
    add_event(db_session, job, "queued", "Upload queued for ingestion", {"status": "queued"})
    db_session.commit()

    claimed = claim_next_job(db_session)
    assert claimed is not None
    qdrant = FakeQdrantIndexer(collection="mock_chunks")
    processed = process_claimed_job(
        db_session,
        claimed.id,
        continue_to_index=True,
        embedding_client=FakeEmbeddingClient(dimensions=5),
        qdrant_indexer=qdrant,
        settings=Settings(UPLOAD_DIR=str(tmp_path / "uploads")),
    )

    assert processed is not None
    assert processed.status == "completed"
    source = db_session.get(Source, source_id)
    assert source is not None
    assert source.source_type == "archived_webpage"
    chunk = db_session.scalars(select(DocumentChunk).where(DocumentChunk.ingestion_job_id == job.id)).one()
    assert chunk.content == "Safe archive quote."
    assert "bad()" not in chunk.content
    metadata = json.loads(chunk.metadata_json)
    expected_path_text = ["Archive heading"]
    assert metadata["parser"] == "archived_webpage"
    assert metadata["source_type"] == "archived_webpage"
    assert metadata["archive_source_id"] == source_id
    assert metadata["archive_entry_path"] == "page.html"
    assert metadata["archive_served_entry_path"] == "page.html"
    assert metadata["archive_manifest_path"] == str(archive.manifest_path)
    assert metadata["target_chunk_id"].startswith("archive-")
    target_chunk_id = metadata["target_chunk_id"]
    assert metadata["target_selector"] == f'[data-source-chunk-id="{target_chunk_id}"]'
    assert metadata["viewer_fragment"] == f"#source-chunk-{target_chunk_id}"
    assert metadata["quote"] == "Safe archive quote."
    assert metadata["semantic_section"]["kind"] == "heading"
    assert metadata["semantic_section"]["path_text"] == expected_path_text
    assert metadata["semantic_section"]["path_text"] == ["Archive heading"]
    assert "section_path" not in metadata
    assert metadata["source_url"] == "https://example.test/archive-source"
    assert len(qdrant.points) == 1
    qdrant_payload = qdrant.points[0].payload
    semantic_section = cast(dict[str, object], qdrant_payload["semantic_section"])
    assert semantic_section["path_text"] == expected_path_text
    assert "section_path" not in qdrant_payload


def test_worker_indexes_archive_qdrant_payload_uses_semantic_section_path_text(db_session: Session, tmp_path: Path) -> None:
    source_id = "archive-source-qdrant-worker"
    served_html_path = tmp_path / "served.html"
    served_html_path.write_text(
        "<html><head><title>Archive title</title><link rel=\"canonical\" href=\"https://example.test/archive-source-qdrant-worker\"></head><body><h1>Archive heading</h1><p>Safe archive quote.</p></body></html>",
        encoding="utf-8",
    )
    upload = Upload(
        original_filename="served.html",
        stored_path=str(served_html_path),
        content_type="text/html",
        extension=".html",
        sha256="zip-sha",
        size_bytes=served_html_path.stat().st_size,
        created_at=utcnow(),
    )
    db_session.add(upload)
    db_session.flush()
    job_metadata = {
        "source_id": source_id,
        "source_type": "archived_webpage",
        "archive_manifest_path": str(tmp_path / "manifest.json"),
        "archive_entry_path": "page.html",
        "archive_primary_html_path": "page.html",
        "archive_served_entry_path": "page.html",
        "archive_served_html_path": "page.html",
        "archive_anchor_map_path": "anchor-map.json",
        "source_url": "https://example.test/archive-source-qdrant-worker",
    }
    job = IngestionJob(
        upload_id=upload.id,
        status="queued",
        metadata_json=json.dumps(job_metadata),
        created_at=utcnow(),
        updated_at=utcnow(),
    )
    db_session.add(job)
    db_session.flush()
    add_event(db_session, job, "queued", "Upload queued for ingestion", {"status": "queued"})
    db_session.commit()

    (tmp_path / "anchor-map.json").write_text(
        json.dumps(
            {
                "source_id": source_id,
                "source_path": "page.html",
                "anchors": [
                    {
                        "chunk_id": "archive-target-1",
                        "selector": '[data-source-chunk-id="archive-target-1"]',
                        "heading_path": ["Archive heading"],
                        "quote": "Safe archive quote.",
                        "source_path": "page.html",
                        "viewer_fragment": "#source-chunk-archive-target-1",
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    qdrant = FakeQdrantIndexer(collection="mock_chunks")
    processed = process_next_job(
        db_session,
        embedding_client=FakeEmbeddingClient(dimensions=5),
        qdrant_indexer=qdrant,
    )

    assert processed is not None
    assert processed.status == "completed"
    assert len(qdrant.points) == 1
    qdrant_payload = cast(dict[str, object], qdrant.points[0].payload)
    assert qdrant_payload["archive_source_id"] == source_id
    assert qdrant_payload["target_chunk_id"] == "archive-target-1"
    assert qdrant_payload["target_selector"] == '[data-source-chunk-id="archive-target-1"]'
    assert qdrant_payload["viewer_fragment"] == "#source-chunk-archive-target-1"
    assert qdrant_payload["quote"] == "Safe archive quote."
    assert qdrant_payload["semantic_section"]["path_text"] == ["Archive heading"]
    assert "section_path" not in qdrant_payload
    assert qdrant_payload["source_url"] == "https://example.test/archive-source-qdrant-worker"


def test_worker_processes_ddb_saved_html_after_upload_queueing(db_session: Session, tmp_path: Path) -> None:
    from app.config import Settings, get_settings
    from app.database import get_db

    fixture = Path(__file__).resolve().parent / "fixtures" / "ddb" / "a-world-of-your-own-ddb.html"
    content = fixture.read_bytes()

    def override_db() -> Generator[Session, None, None]:
        yield db_session

    def override_settings() -> Settings:
        return Settings(
            ADMIN_PASSWORD_HASH=os.environ["ADMIN_PASSWORD_HASH"],
            SESSION_SECRET=os.environ["SESSION_SECRET"],
            DATABASE_URL="sqlite+pysqlite:///:memory:",
            UPLOAD_DIR=str(tmp_path / "uploads"),
        )

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_settings] = override_settings
    with TestClient(app) as client:
        assert client.post("/auth/login", json={"password": "admin-password"}).status_code == 200
        response = client.post("/uploads", files={"file": ("a-world-of-your-own-ddb.html", content, "text/html")})
    app.dependency_overrides.clear()

    assert response.status_code == 201
    payload = response.json()
    upload = db_session.get(Upload, payload["upload_id"])
    job = db_session.get(IngestionJob, payload["job_id"])
    assert upload is not None
    assert job is not None
    assert upload.extension == ".html"
    assert upload.original_filename == "a-world-of-your-own-ddb.html"
    assert Path(upload.stored_path).read_bytes() == content
    assert job.status == "queued"

    claimed = claim_next_job(db_session)
    assert claimed is not None
    processed = process_claimed_job(db_session, claimed.id, continue_to_index=False)

    assert processed is not None
    assert processed.status == "awaiting_embedding"
    metadata = json.loads(processed.metadata_json)
    assert metadata["parser"] == "ddb_saved_html"
    assert metadata["title"] == "A World of Your Own"
    assert metadata["book_title"] == "Dungeon Master’s Guide (2014)"
    assert metadata["document_title"] == "A World of Your Own"
    artifact_dir = Path(str(upload.stored_path) + ".artifacts")
    assert metadata["raw_html_path"] == str(artifact_dir / "raw.html")
    assert metadata["rendered_html_path"] == str(artifact_dir / "rendered.html")
    assert metadata["jsonl_path"] == str(artifact_dir / "chunks.jsonl")
    assert (artifact_dir / "raw.html").read_bytes() == content
    assert (artifact_dir / "rendered.html").is_file()

    chunks = db_session.scalars(
        select(DocumentChunk).where(DocumentChunk.ingestion_job_id == job.id).order_by(DocumentChunk.chunk_index)
    ).all()
    assert len(chunks) == 3
    first_chunk_metadata = json.loads(chunks[0].metadata_json)
    assert first_chunk_metadata["source_type"] == "ddb_saved_html"
    assert first_chunk_metadata["raw_html_path"] == str(artifact_dir / "raw.html")
    assert first_chunk_metadata["citation_anchor"] == "#AWorldofYourOwn"

    events = _event_types(db_session, job.id)
    assert events[:4] == ["queued", "processing", "parsing_started", "parsing_completed"]


def test_worker_processes_zip_wrapped_ddb_saved_html_as_archived_webpage(db_session: Session, tmp_path: Path) -> None:
    from app.archive_storage import store_source_archive
    from app.config import Settings

    fixture = Path(__file__).resolve().parent / "fixtures" / "ddb" / "a-world-of-your-own-ddb.html"
    source_id = "ddb-zip-current-contract"
    archive = store_source_archive(
        source_id=source_id,
        original_filename="a-world-of-your-own-ddb.zip",
        content=_zip_bytes({"A World of Your Own/page.html": fixture.read_bytes()}),
        settings=Settings(UPLOAD_DIR=str(tmp_path / "uploads")),
    )
    upload = Upload(
        original_filename="a-world-of-your-own-ddb.zip",
        stored_path=str(archive.served_html_path),
        content_type="application/zip",
        extension=".html",
        sha256="zip-sha",
        size_bytes=1,
        created_at=utcnow(),
    )
    db_session.add(upload)
    db_session.flush()
    job_metadata = {
        "source_id": source_id,
        "source_type": "archived_webpage",
        "archive_manifest_path": str(archive.manifest_path),
        "archive_entry_path": "A World of Your Own/page.html",
        "archive_primary_html_path": "A World of Your Own/page.html",
        "archive_served_entry_path": "A World of Your Own/page.html",
        "archive_served_html_path": "A World of Your Own/page.html",
        "archive_anchor_map_path": "anchor-map.json",
    }
    if archive.manifest.get("source_url"):
        job_metadata["source_url"] = archive.manifest["source_url"]
    job = IngestionJob(
        upload_id=upload.id,
        status="queued",
        metadata_json=json.dumps(job_metadata),
        created_at=utcnow(),
        updated_at=utcnow(),
    )
    db_session.add(job)
    db_session.flush()
    add_event(db_session, job, "queued", "Upload queued for ingestion", {"status": "queued"})
    db_session.commit()

    processed = process_next_job(db_session, embedding_client=FakeEmbeddingClient(dimensions=3), qdrant_indexer=FakeQdrantIndexer())

    assert processed is not None
    assert processed.status == "completed"
    metadata = json.loads(processed.metadata_json)
    assert metadata["parser"] == "archived_webpage"
    assert metadata["source_type"] == "archived_webpage"
    assert metadata["source_id"] == source_id
    source = db_session.get(Source, source_id)
    assert source is not None
    assert source.source_type == "archived_webpage"
    chunks = db_session.scalars(select(DocumentChunk).where(DocumentChunk.ingestion_job_id == job.id).order_by(DocumentChunk.chunk_index)).all()
    assert len(chunks) == 5
    first_chunk_metadata = json.loads(chunks[0].metadata_json)
    assert first_chunk_metadata["parser"] == "archived_webpage"
    assert first_chunk_metadata["archive_source_id"] == source_id
    assert first_chunk_metadata["target_chunk_id"].startswith("archive-")
    assert "raw_html_path" not in first_chunk_metadata
    assert "content_chunk_ids" not in first_chunk_metadata


def test_job_status_upload_view_url(db_session: Session, tmp_path: Path) -> None:
    from app.config import Settings, get_settings
    from app.database import get_db
    from app.main import app
    from fastapi.testclient import TestClient

    os.environ["ADMIN_PASSWORD_HASH"] = "$2b$12$AVhh6Snv3FcaevOnJ0dwR.SfBrkaPp036/Nt/wwdVTsVQNuR1XKx2"
    os.environ["SESSION_SECRET"] = "test-session-secret"

    now = utcnow()
    batch = UploadBatch(status="queued", file_count=1, created_at=now, updated_at=now)
    db_session.add(batch)
    db_session.flush()
    upload = Upload(
        original_filename="valid-ddb-a.zip",
        stored_path=str(tmp_path / "valid-ddb-a.html"),
        content_type="application/zip",
        extension=".html",
        sha256="abc123",
        size_bytes=123,
        batch_id=batch.id,
        batch_position=0,
        created_at=now,
    )
    db_session.add(upload)
    db_session.flush()
    job = IngestionJob(upload_id=upload.id, batch_id=batch.id, status="queued", created_at=now, updated_at=now)
    db_session.add(job)
    db_session.commit()

    def override_db() -> Generator[Session, None, None]:
        yield db_session

    def override_settings() -> Settings:
        return Settings(
            ADMIN_PASSWORD_HASH=os.environ["ADMIN_PASSWORD_HASH"],
            SESSION_SECRET=os.environ["SESSION_SECRET"],
            DATABASE_URL="sqlite+pysqlite:///:memory:",
            UPLOAD_DIR=str(tmp_path / "uploads"),
        )

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_settings] = override_settings
    with TestClient(app) as client:
        assert client.post("/auth/login", json={"password": "admin-password"}).status_code == 200
        response = client.get(f"/jobs/{job.id}")
        alias_response = client.get(f"/ingestion/jobs/{job.id}")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert alias_response.status_code == 200
    assert response.json()["batch_id"] == batch.id
    assert response.json()["upload_status_url"] == f"/upload?batch_id={batch.id}"
    assert alias_response.json()["batch_id"] == batch.id
    assert alias_response.json()["upload_status_url"] == f"/upload?batch_id={batch.id}"



def _create_upload_and_job(
    db: Session,
    tmp_path: Path,
    filename: str,
    content: str,
    extension: str | None = None,
    content_type: str = "text/markdown",
    batch_id: str | None = None,
    batch_position: int | None = None,
) -> IngestionJob:
    extension = extension or Path(filename).suffix.lower()
    stored_path = tmp_path / filename
    stored_path.write_text(content, encoding="utf-8")
    upload = Upload(
        original_filename=filename,
        stored_path=str(stored_path),
        content_type=content_type,
        extension=extension,
        sha256="abc123",
        size_bytes=len(content.encode()),
        batch_id=batch_id,
        batch_position=batch_position,
        created_at=utcnow(),
    )
    db.add(upload)
    db.flush()
    job = IngestionJob(upload_id=upload.id, batch_id=batch_id, status="queued", created_at=utcnow(), updated_at=utcnow())
    db.add(job)
    db.flush()
    add_event(db, job, "queued", "Upload queued for ingestion", {"status": "queued"})
    db.commit()
    db.refresh(job)
    return job


def _event_types(db: Session, job_id: str) -> list[str]:
    events = db.scalars(
        select(IngestionEvent).where(IngestionEvent.ingestion_job_id == job_id).order_by(IngestionEvent.created_at)
    ).all()
    return [event.event_type for event in events]


def _zip_bytes(entries: dict[str, bytes]) -> bytes:
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for name, content in entries.items():
            zip_file.writestr(name, content)
    return archive.getvalue()
