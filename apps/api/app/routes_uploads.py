import hashlib
import json
import re
import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.archive_storage import ARCHIVE_SOURCE_TYPE, ArchiveValidationError, StoredArchive, store_source_archive
from app.auth import current_admin_session
from app.config import Settings, get_settings
from app.database import get_db
from app.ingestion import FAILURE_CATEGORIES, FAILURE_METADATA_KEY, add_event
from app.models import AdminSession, IngestionJob, Upload, UploadBatch, utcnow
from app.schemas import (
    UploadBatchChildError,
    UploadBatchQueued,
    UploadBatchQueuedItem,
    UploadBatchStatusItem,
    UploadBatchStatusRead,
    UploadBatchStatusSummary,
    UploadQueued,
)


SUPPORTED_TYPE_MESSAGE = "Unsupported file type. Supported types: ZIP, EPUB, HTML, TXT, MD."
MAX_UPLOAD_BATCH_FILE_COUNT = 25
DEFAULT_UPLOAD_FILE_MAX_SIZE_BYTES = 100 * 1024 * 1024
DEFAULT_UPLOAD_BATCH_MAX_SIZE_BYTES = 500 * 1024 * 1024
TERMINAL_SUCCESS_STATUSES = {"completed"}
TERMINAL_FAILURE_STATUSES = {"failed"}
RUNNING_STATUSES = {"processing", "chunking", "awaiting_embedding", "embedding", "indexing"}
UNSAFE_ERROR_PATTERNS = [
    re.compile(r"Traceback", re.IGNORECASE),
    re.compile(r"\bFile \""),
    re.compile(r"/(?:home|tmp|var|srv|data|app|mnt)/"),
    re.compile(r"[A-Za-z]:\\\\"),
]

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


def _safe_filename(filename: str | None) -> str:
    if not filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="unsafe filename")
    if Path(filename).name != filename or filename in {".", ".."}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="unsafe filename")
    return filename


def _metadata_for_archive(source_id: str, stored_archive: StoredArchive) -> dict[str, object]:
    manifest = stored_archive.manifest
    job_metadata: dict[str, object] = {
        "source_id": source_id,
        "source_type": ARCHIVE_SOURCE_TYPE,
        "archive_manifest_path": str(stored_archive.manifest_path),
        "archive_original_zip_path": str(stored_archive.original_zip_path),
        "archive_original_dir": str(stored_archive.original_dir),
        "archive_entry_path": manifest["primary_html_path"],
        "archive_primary_html_path": manifest["primary_html_path"],
        "archive_served_entry_path": manifest["served_html_path"],
        "archive_served_html_path": manifest["served_html_path"],
        "archive_anchor_map_path": manifest["anchor_map_path"],
        "archive_file_count": manifest["file_count"],
        "archive_extracted_size_bytes": manifest["extracted_size_bytes"],
    }
    if manifest.get("source_url"):
        job_metadata["source_url"] = manifest["source_url"]
    return job_metadata


def _create_upload_and_job(
    *,
    db: Session,
    settings: Settings,
    upload_dir: Path,
    file: UploadFile,
    content: bytes,
    extension: str,
    now: object,
    batch_id: str | None = None,
    batch_position: int | None = None,
    staged_archive_roots: list[Path] | None = None,
) -> tuple[Upload, IngestionJob]:
    digest = hashlib.sha256(content).hexdigest()

    upload = Upload(
        original_filename=file.filename or f"upload{extension}",
        stored_path="",
        content_type=(file.content_type or "application/octet-stream").lower(),
        extension=".html" if extension == ".zip" else extension,
        sha256=digest,
        size_bytes=len(content),
        batch_id=batch_id,
        batch_position=batch_position,
        created_at=now,
    )
    db.add(upload)
    db.flush()

    job_metadata: dict[str, object] = {}
    if extension == ".zip":
        source_id = str(uuid4())
        stored_archive = store_source_archive(
            source_id=source_id,
            original_filename=upload.original_filename,
            content=content,
            settings=settings,
        )
        if staged_archive_roots is not None:
            staged_archive_roots.append(Path(settings.upload_dir) / "source-archives" / source_id)
        upload.stored_path = str(stored_archive.served_html_path)
        job_metadata = _metadata_for_archive(source_id, stored_archive)
    else:
        stored_path = upload_dir / f"{upload.id}{extension}"
        stored_path.write_bytes(content)
        upload.stored_path = str(stored_path)

    job = IngestionJob(
        upload_id=upload.id,
        batch_id=batch_id,
        status="queued",
        metadata_json=json.dumps(job_metadata, sort_keys=True, separators=(",", ":")),
        created_at=now,
        updated_at=now,
    )
    db.add(job)
    db.flush()
    return upload, job


def _validate_batch_files(files: list[UploadFile], contents: list[bytes], settings: Settings) -> list[str]:
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="upload_limit_exceeded: at least one file is required")
    if len(files) > MAX_UPLOAD_BATCH_FILE_COUNT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"upload_limit_exceeded: maximum file count is {MAX_UPLOAD_BATCH_FILE_COUNT}",
        )

    filenames: list[str] = []
    seen_filenames: set[str] = set()
    for file in files:
        filename = _safe_filename(file.filename)
        if filename in seen_filenames:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"duplicate filename: {filename}")
        seen_filenames.add(filename)
        filenames.append(filename)

        extension = _validate_upload(file)
        if extension != ".zip":
            raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=SUPPORTED_TYPE_MESSAGE)

    per_file_limit = getattr(settings, "upload_file_max_size_bytes", DEFAULT_UPLOAD_FILE_MAX_SIZE_BYTES)
    aggregate_limit = getattr(settings, "upload_batch_max_size_bytes", DEFAULT_UPLOAD_BATCH_MAX_SIZE_BYTES)
    if any(len(content) > per_file_limit for content in contents):
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="upload_limit_exceeded: per-file size limit exceeded")
    if sum(len(content) for content in contents) > aggregate_limit:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="upload_limit_exceeded: aggregate size limit exceeded")
    return filenames


def _remove_staged_archive_roots(settings: Settings, staged_archive_roots: list[Path]) -> None:
    for archive_root in staged_archive_roots:
        shutil.rmtree(archive_root, ignore_errors=True)
    source_archives_dir = Path(settings.upload_dir) / "source-archives"
    try:
        source_archives_dir.rmdir()
    except OSError:
        pass


def _aggregate_batch_status(child_statuses: list[str]) -> str:
    if child_statuses and all(status == "queued" for status in child_statuses):
        return "queued"

    success_count = sum(status in TERMINAL_SUCCESS_STATUSES for status in child_statuses)
    failure_count = sum(status in TERMINAL_FAILURE_STATUSES for status in child_statuses)
    terminal_count = success_count + failure_count

    if child_statuses and terminal_count == len(child_statuses):
        if success_count == len(child_statuses):
            return "completed"
        if failure_count == len(child_statuses):
            return "failed"
        return "partial_failed"

    if any(status in RUNNING_STATUSES or status == "queued" for status in child_statuses):
        return "running"
    return "running"


def _status_summary(child_statuses: list[str]) -> UploadBatchStatusSummary:
    completed = sum(status in TERMINAL_SUCCESS_STATUSES for status in child_statuses)
    failed = sum(status in TERMINAL_FAILURE_STATUSES for status in child_statuses)
    queued = sum(status == "queued" for status in child_statuses)
    running = len(child_statuses) - completed - failed - queued
    return UploadBatchStatusSummary(
        queued=queued,
        running=running,
        completed=completed,
        partial_failed=1 if completed and failed else 0,
        failed=failed,
        total=len(child_statuses),
    )


def _safe_child_error(filename: str, job: IngestionJob) -> UploadBatchChildError | None:
    if job.status not in TERMINAL_FAILURE_STATUSES and not job.error_summary:
        return None

    structured_error = _structured_child_error(filename, job)
    if structured_error is not None:
        return structured_error

    message = job.error_summary or "Import failed."
    if any(pattern.search(message) for pattern in UNSAFE_ERROR_PATTERNS):
        message = "Import failed. Review the file and try again."
    return UploadBatchChildError(filename=filename, category="unknown_error", message=message[:500])


def _structured_child_error(filename: str, job: IngestionJob) -> UploadBatchChildError | None:
    try:
        metadata = json.loads(job.metadata_json or "{}")
    except json.JSONDecodeError:
        return None
    if not isinstance(metadata, dict):
        return None
    failure = metadata.get(FAILURE_METADATA_KEY)
    if not isinstance(failure, dict):
        return None
    category = failure.get("category")
    message = failure.get("message")
    stored_filename = failure.get("filename")
    if not isinstance(category, str) or category not in FAILURE_CATEGORIES:
        category = "unknown_error"
    if not isinstance(message, str) or any(pattern.search(message) for pattern in UNSAFE_ERROR_PATTERNS):
        message = "Import failed. Review the file and try again."
    if not isinstance(stored_filename, str) or stored_filename != filename:
        stored_filename = filename
    return UploadBatchChildError(filename=stored_filename, category=category, message=message[:500])


@router.get("/batches/{batch_id}", response_model=UploadBatchStatusRead)
def read_upload_batch(
    batch_id: str,
    _admin_session: AdminSession = Depends(current_admin_session),
    db: Session = Depends(get_db),
) -> UploadBatchStatusRead:
    batch = db.get(UploadBatch, batch_id)
    if batch is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload batch not found")

    rows = db.execute(
        select(Upload, IngestionJob)
        .join(IngestionJob, IngestionJob.upload_id == Upload.id)
        .where(Upload.batch_id == batch_id, IngestionJob.batch_id == batch_id)
        .order_by(Upload.batch_position, Upload.created_at, Upload.id)
    ).all()
    child_statuses = [job.status for _upload, job in rows]
    aggregate_status = _aggregate_batch_status(child_statuses)
    if batch.status != aggregate_status:
        batch.status = aggregate_status
        batch.updated_at = utcnow()
        db.commit()
        db.refresh(batch)

    return UploadBatchStatusRead(
        batch_id=batch.id,
        status=aggregate_status,
        file_count=batch.file_count,
        created_at=batch.created_at,
        updated_at=batch.updated_at,
        items=[
            UploadBatchStatusItem(
                filename=upload.original_filename,
                upload_id=upload.id,
                job_id=job.id,
                status=job.status,
                error=_safe_child_error(upload.original_filename, job),
            )
            for upload, job in rows
        ],
        summary=_status_summary(child_statuses),
        upload_status_url=f"/upload?batch_id={batch.id}",
    )


@router.post("", response_model=UploadQueued | UploadBatchQueued, status_code=status.HTTP_201_CREATED)
def create_upload(
    file: list[UploadFile] = File(default=[]),
    _admin_session: AdminSession = Depends(current_admin_session),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> UploadQueued | UploadBatchQueued:
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)

    now = utcnow()
    contents = [upload_file.file.read() for upload_file in file]

    if len(file) == 1:
        extension = _validate_upload(file[0])
        try:
            upload, job = _create_upload_and_job(
                db=db,
                settings=settings,
                upload_dir=upload_dir,
                file=file[0],
                content=contents[0],
                extension=extension,
                now=now,
            )
        except ArchiveValidationError as exc:
            db.rollback()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        add_event(db, job, "queued", "Upload queued for ingestion", {"status": "queued"})
        db.commit()
        db.refresh(upload)
        db.refresh(job)
        return UploadQueued(upload_id=upload.id, job_id=job.id, queued=job.status == "queued")

    filenames = _validate_batch_files(file, contents, settings)
    batch = UploadBatch(
        status="queued",
        file_count=len(file),
        metadata_json=json.dumps({"filenames": filenames}, sort_keys=True, separators=(",", ":")),
        created_at=now,
        updated_at=now,
    )
    db.add(batch)
    db.flush()

    staged_archive_roots: list[Path] = []
    jobs: list[tuple[str, Upload, IngestionJob]] = []
    current_filename = "upload"
    try:
        for position, (upload_file, content, filename) in enumerate(zip(file, contents, filenames, strict=True)):
            current_filename = filename
            upload, job = _create_upload_and_job(
                db=db,
                settings=settings,
                upload_dir=upload_dir,
                file=upload_file,
                content=content,
                extension=".zip",
                now=now,
                batch_id=batch.id,
                batch_position=position,
                staged_archive_roots=staged_archive_roots,
            )
            jobs.append((filename, upload, job))
        for _filename, _upload, job in jobs:
            add_event(db, job, "queued", "Upload queued for ingestion", {"status": "queued", "batch_id": batch.id})
        db.commit()
    except ArchiveValidationError as exc:
        db.rollback()
        _remove_staged_archive_roots(settings, staged_archive_roots)
        detail = str(exc)
        if current_filename not in detail:
            detail = f"{current_filename}: {detail}"
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail) from exc
    except Exception:
        db.rollback()
        _remove_staged_archive_roots(settings, staged_archive_roots)
        raise

    db.refresh(batch)
    return UploadBatchQueued(
        batch_id=batch.id,
        status=batch.status,
        items=[
            UploadBatchQueuedItem(filename=filename, upload_id=upload.id, job_id=job.id, status=job.status)
            for filename, upload, job in jobs
        ],
        queued=all(job.status == "queued" for _, _, job in jobs),
        upload_status_url=f"/upload?batch_id={batch.id}",
    )
