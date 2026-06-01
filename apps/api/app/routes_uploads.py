import hashlib
import json
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.archive_storage import ARCHIVE_SOURCE_TYPE, ArchiveValidationError, store_source_archive
from app.auth import current_admin_session
from app.config import Settings, get_settings
from app.database import get_db
from app.ingestion import add_event
from app.models import AdminSession, IngestionJob, Upload, utcnow
from app.schemas import UploadQueued


SUPPORTED_TYPE_MESSAGE = "Unsupported file type. Supported types: ZIP, EPUB, HTML, TXT, MD."

SUPPORTED_CONTENT_TYPES = {
    ".md": {"text/markdown", "text/plain", "application/octet-stream"},
    ".markdown": {"text/markdown", "text/plain", "application/octet-stream"},
    ".txt": {"text/plain", "application/octet-stream"},
    ".html": {"text/html", "application/xhtml+xml", "application/octet-stream"},
    ".htm": {"text/html", "application/xhtml+xml", "application/octet-stream"},
    ".epub": {"application/epub+zip", "application/octet-stream"},
    ".zip": {"application/zip", "application/x-zip-compressed", "application/octet-stream"},
}


router = APIRouter(prefix="/uploads", tags=["uploads"])


def _extension(filename: str | None) -> str:
    if not filename:
        return ""
    return Path(filename).suffix.lower()


def _validate_upload(file: UploadFile) -> str:
    extension = _extension(file.filename)
    if extension not in SUPPORTED_CONTENT_TYPES:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=SUPPORTED_TYPE_MESSAGE)

    content_type = (file.content_type or "application/octet-stream").lower()
    if content_type not in SUPPORTED_CONTENT_TYPES[extension]:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=SUPPORTED_TYPE_MESSAGE)
    return extension


@router.post("", response_model=UploadQueued, status_code=status.HTTP_201_CREATED)
def create_upload(
    file: UploadFile = File(...),
    _: AdminSession = Depends(current_admin_session),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> UploadQueued:
    extension = _validate_upload(file)
    content = file.file.read()
    digest = hashlib.sha256(content).hexdigest()

    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)

    now = utcnow()
    upload = Upload(
        original_filename=file.filename or f"upload{extension}",
        stored_path="",
        content_type=(file.content_type or "application/octet-stream").lower(),
        extension=".html" if extension == ".zip" else extension,
        sha256=digest,
        size_bytes=len(content),
        created_at=now,
    )
    db.add(upload)
    db.flush()

    job_metadata: dict[str, object] = {}
    if extension == ".zip":
        source_id = str(uuid4())
        try:
            stored_archive = store_source_archive(
                source_id=source_id,
                original_filename=upload.original_filename,
                content=content,
                settings=settings,
            )
        except ArchiveValidationError as exc:
            db.rollback()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        upload.stored_path = str(stored_archive.served_html_path)
        job_metadata = {
            "source_id": source_id,
            "source_type": ARCHIVE_SOURCE_TYPE,
            "archive_manifest_path": str(stored_archive.manifest_path),
            "archive_original_zip_path": str(stored_archive.original_zip_path),
            "archive_original_dir": str(stored_archive.original_dir),
            "archive_entry_path": stored_archive.manifest["primary_html_path"],
            "archive_primary_html_path": stored_archive.manifest["primary_html_path"],
            "archive_served_entry_path": stored_archive.manifest["served_html_path"],
            "archive_served_html_path": stored_archive.manifest["served_html_path"],
            "archive_anchor_map_path": stored_archive.manifest["anchor_map_path"],
            "archive_file_count": stored_archive.manifest["file_count"],
            "archive_extracted_size_bytes": stored_archive.manifest["extracted_size_bytes"],
        }
        if stored_archive.manifest.get("source_url"):
            job_metadata["source_url"] = stored_archive.manifest["source_url"]
    else:
        stored_path = upload_dir / f"{upload.id}{extension}"
        stored_path.write_bytes(content)
        upload.stored_path = str(stored_path)

    job = IngestionJob(
        upload_id=upload.id,
        status="queued",
        metadata_json=json.dumps(job_metadata, sort_keys=True, separators=(",", ":")),
        created_at=now,
        updated_at=now,
    )
    db.add(job)
    db.flush()
    add_event(db, job, "queued", "Upload queued for ingestion", {"status": "queued"})
    db.commit()
    db.refresh(upload)
    db.refresh(job)

    return UploadQueued(upload_id=upload.id, job_id=job.id, queued=job.status == "queued")
