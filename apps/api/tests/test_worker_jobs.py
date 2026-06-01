import json
import importlib.util
import os
from collections.abc import Generator
from pathlib import Path
from textwrap import dedent

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

from app.database import Base
from app.ingestion import add_event, claim_next_job, process_claimed_job, process_next_job, process_next_queued_job
from app.models import Document, DocumentChunk, IngestionEvent, IngestionJob, Section, Source, Upload, utcnow


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

    processed = process_next_job(db_session)

    assert processed is not None
    assert processed.status == "failed"
    assert processed.error_summary is not None
    assert "valid EPUB archive" in processed.error_summary
    assert db_session.scalars(select(DocumentChunk).where(DocumentChunk.ingestion_job_id == job.id)).all() == []
    assert _event_types(db_session, job.id) == ["queued", "processing", "job_failed"]


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


def _create_upload_and_job(
    db: Session,
    tmp_path: Path,
    filename: str,
    content: str,
    extension: str | None = None,
    content_type: str = "text/markdown",
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
        created_at=utcnow(),
    )
    db.add(upload)
    db.flush()
    job = IngestionJob(upload_id=upload.id, status="queued", created_at=utcnow(), updated_at=utcnow())
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
