import os
from collections.abc import Generator
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

from app.database import Base
from app.ingestion import add_event
from app.models import IngestionJob, Upload, utcnow


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


def create_upload_and_job(
    db: Session,
    tmp_path: Path,
    filename: str,
    content: str | bytes,
    extension: str | None = None,
    content_type: str = "text/markdown",
) -> IngestionJob:
    extension = extension or Path(filename).suffix.lower()
    stored_path = tmp_path / filename
    if isinstance(content, bytes):
        stored_path.write_bytes(content)
        size_bytes = len(content)
    else:
        stored_path.write_text(content, encoding="utf-8")
        size_bytes = len(content.encode())
    upload = Upload(
        original_filename=filename,
        stored_path=str(stored_path),
        content_type=content_type,
        extension=extension,
        sha256="abc123",
        size_bytes=size_bytes,
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
