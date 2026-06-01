import hashlib
import os
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["ADMIN_PASSWORD_HASH"] = "$2b$12$AVhh6Snv3FcaevOnJ0dwR.SfBrkaPp036/Nt/wwdVTsVQNuR1XKx2"
os.environ["SESSION_SECRET"] = "test-session-secret"
os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

from app.config import Settings, get_settings
from app.database import Base, get_db
from app.main import app
from app.models import IngestionEvent, IngestionJob, Upload


SUPPORTED_FIXTURES = [
    ("sample.md", "text/markdown"),
    ("sample.markdown", "text/markdown"),
    ("sample.txt", "text/plain"),
    ("sample.html", "text/html"),
    ("sample.htm", "text/html"),
    ("sample.epub", "application/epub+zip"),
]


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


@pytest.fixture()
def client(tmp_path: Path, db_session: Session) -> Generator[TestClient, None, None]:
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
    with TestClient(app) as test_client:
        assert test_client.post("/auth/login", json={"password": "admin-password"}).status_code == 200
        yield test_client
    app.dependency_overrides.clear()


@pytest.mark.parametrize(("filename", "content_type"), SUPPORTED_FIXTURES)
def test_upload_supported_files_creates_raw_file_and_queued_job(
    client: TestClient,
    db_session: Session,
    filename: str,
    content_type: str,
) -> None:
    content = f"content for {filename}".encode()

    response = client.post("/uploads", files={"file": (filename, content, content_type)})

    assert response.status_code == 201
    payload = response.json()
    assert set(payload) == {"upload_id", "job_id", "queued"}
    assert payload["queued"] is True

    upload = db_session.get(Upload, payload["upload_id"])
    assert upload is not None
    assert upload.original_filename == filename
    assert upload.sha256 == hashlib.sha256(content).hexdigest()
    assert upload.size_bytes == len(content)
    assert Path(upload.stored_path).name == f"{upload.id}{Path(filename).suffix}"
    assert Path(upload.stored_path).read_bytes() == content

    job = db_session.get(IngestionJob, payload["job_id"])
    assert job is not None
    assert job.upload_id == upload.id
    assert job.status == "queued"

    event = db_session.scalars(select(IngestionEvent).where(IngestionEvent.ingestion_job_id == job.id)).one()
    assert event.event_type == "queued"


@pytest.mark.parametrize(
    ("filename", "content_type"),
    [
        ("sample.pdf", "application/pdf"),
        ("sample.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        ("sample.png", "image/png"),
        ("sample.bin", "application/octet-stream"),
    ],
)
def test_upload_rejects_unsupported_files(
    client: TestClient,
    db_session: Session,
    filename: str,
    content_type: str,
) -> None:
    response = client.post("/uploads", files={"file": (filename, b"unsupported", content_type)})

    assert response.status_code == 415
    assert response.json() == {"detail": "Unsupported file type. Supported types: EPUB, HTML, TXT, MD."}
    assert db_session.scalars(select(Upload)).all() == []
    assert db_session.scalars(select(IngestionJob)).all() == []


def test_upload_rejects_supported_extension_with_wrong_content_type(client: TestClient) -> None:
    response = client.post("/uploads", files={"file": ("sample.md", b"markdown", "application/pdf")})

    assert response.status_code == 415
    assert response.json() == {"detail": "Unsupported file type. Supported types: EPUB, HTML, TXT, MD."}


def test_upload_is_observable_through_list_and_detail_endpoints(client: TestClient) -> None:
    response = client.post("/uploads", files={"file": ("sample.md", b"# Notes", "text/markdown")})
    assert response.status_code == 201
    upload_id = response.json()["upload_id"]

    list_response = client.get("/records/uploads")
    detail_response = client.get(f"/records/uploads/{upload_id}")

    assert list_response.status_code == 200
    assert list_response.json()[0]["id"] == upload_id
    assert detail_response.status_code == 200
    assert detail_response.json()["id"] == upload_id
    assert detail_response.json()["original_filename"] == "sample.md"


def test_upload_requires_authentication() -> None:
    with TestClient(app) as unauthenticated_client:
        response = unauthenticated_client.post("/uploads", files={"file": ("sample.md", b"markdown", "text/markdown")})

    assert response.status_code == 401
