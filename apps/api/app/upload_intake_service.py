import hashlib
import io
import json
import shutil
import zipfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from uuid import uuid4

from sqlalchemy.orm import Session

from app.archive_storage import (
    ARCHIVE_SOURCE_TYPE,
    ArchiveValidationError,
    StoredArchive,
    store_source_archive,
)
from app.config import Settings
from app.ingestion import add_event
from app.models import IngestionJob, Upload, UploadBatch, utcnow
from app.schemas import UploadBatchQueued, UploadBatchQueuedItem, UploadQueued


SUPPORTED_TYPE_MESSAGE = (
    "Unsupported file type. Supported types: ZIP, EPUB, HTML, TXT, MD."
)
MAX_UPLOAD_BATCH_FILE_COUNT = 64
DEFAULT_UPLOAD_FILE_MAX_SIZE_BYTES = 100 * 1024 * 1024
DEFAULT_UPLOAD_BATCH_MAX_SIZE_BYTES = 768 * 1024 * 1024

SUPPORTED_CONTENT_TYPES = {
    ".md": {"text/markdown", "text/plain", "application/octet-stream"},
    ".markdown": {"text/markdown", "text/plain", "application/octet-stream"},
    ".txt": {"text/plain", "application/octet-stream"},
    ".html": {"text/html", "application/xhtml+xml", "application/octet-stream"},
    ".htm": {"text/html", "application/xhtml+xml", "application/octet-stream"},
    ".epub": {"application/epub+zip", "application/octet-stream"},
    ".zip": {
        "application/zip",
        "application/x-zip-compressed",
        "application/octet-stream",
    },
}


class UploadIntakeError(ValueError):
    status_code: int
    detail: str

    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


@dataclass(frozen=True)
class UploadIntakeFile:
    filename: str | None
    content: bytes
    content_type: str | None


@dataclass(frozen=True)
class _UploadBatchInput:
    filename: str
    content: bytes
    content_type: str


class UploadIntakeService:
    def create_upload(
        self,
        *,
        db: Session,
        settings: Settings,
        files: list[UploadIntakeFile],
    ) -> UploadQueued | UploadBatchQueued:
        upload_dir = Path(settings.upload_dir)
        upload_dir.mkdir(parents=True, exist_ok=True)

        now = utcnow()
        if len(files) == 1:
            upload_file = files[0]
            extension = _validate_upload(upload_file)
            if extension == ".zip":
                batch_items = _nested_zip_batch_inputs(upload_file.content, settings)
                if batch_items is not None:
                    return _queue_batch_uploads(
                        db=db,
                        settings=settings,
                        upload_dir=upload_dir,
                        items=batch_items,
                        now=now,
                    )
            try:
                upload, job = _create_upload_and_job(
                    db=db,
                    settings=settings,
                    upload_dir=upload_dir,
                    filename=upload_file.filename,
                    content_type=upload_file.content_type,
                    content=upload_file.content,
                    extension=extension,
                    now=now,
                )
            except ArchiveValidationError as exc:
                db.rollback()
                raise UploadIntakeError(400, str(exc)) from exc
            add_event(
                db, job, "queued", "Upload queued for ingestion", {"status": "queued"}
            )
            db.commit()
            db.refresh(upload)
            db.refresh(job)
            return UploadQueued(
                upload_id=upload.id, job_id=job.id, queued=job.status == "queued"
            )

        batch_items = _batch_inputs_from_uploads(files, settings)
        return _queue_batch_uploads(
            db=db, settings=settings, upload_dir=upload_dir, items=batch_items, now=now
        )


def _extension(filename: str | None) -> str:
    if not filename:
        return ""
    return Path(filename).suffix.lower()


def _validate_upload(file: UploadIntakeFile) -> str:
    extension = _extension(file.filename)
    if extension not in SUPPORTED_CONTENT_TYPES:
        raise UploadIntakeError(415, SUPPORTED_TYPE_MESSAGE)

    content_type = (file.content_type or "application/octet-stream").lower()
    if content_type not in SUPPORTED_CONTENT_TYPES[extension]:
        raise UploadIntakeError(415, SUPPORTED_TYPE_MESSAGE)
    return extension


def _safe_filename(filename: str | None) -> str:
    if not filename:
        raise UploadIntakeError(400, "unsafe filename")
    if Path(filename).name != filename or filename in {".", ".."}:
        raise UploadIntakeError(400, "unsafe filename")
    return filename


def _metadata_for_archive(
    source_id: str, stored_archive: StoredArchive
) -> dict[str, object]:
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
    filename: str | None,
    content_type: str | None,
    content: bytes,
    extension: str,
    now: object,
    batch_id: str | None = None,
    batch_position: int | None = None,
    staged_archive_roots: list[Path] | None = None,
) -> tuple[Upload, IngestionJob]:
    digest = hashlib.sha256(content).hexdigest()

    upload = Upload(
        original_filename=filename or f"upload{extension}",
        stored_path="",
        content_type=(content_type or "application/octet-stream").lower(),
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
            staged_archive_roots.append(
                Path(settings.upload_dir) / "source-archives" / source_id
            )
        upload.stored_path = str(stored_archive.served_html_path)
        job_metadata = _metadata_for_archive(source_id, stored_archive)
    else:
        stored_path = upload_dir / f"{upload.id}{extension}"
        _ = stored_path.write_bytes(content)
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


def _validate_batch_inputs(items: list[_UploadBatchInput], settings: Settings) -> None:
    if not items:
        raise UploadIntakeError(
            400, "upload_limit_exceeded: at least one file is required"
        )
    if len(items) > MAX_UPLOAD_BATCH_FILE_COUNT:
        raise UploadIntakeError(
            400,
            f"upload_limit_exceeded: maximum file count is {MAX_UPLOAD_BATCH_FILE_COUNT}",
        )

    seen_filenames: set[str] = set()
    for item in items:
        filename = _safe_filename(item.filename)
        if filename in seen_filenames:
            raise UploadIntakeError(400, f"duplicate filename: {filename}")
        seen_filenames.add(filename)

        extension = _extension(filename)
        if (
            extension != ".zip"
            or item.content_type.lower() not in SUPPORTED_CONTENT_TYPES[".zip"]
        ):
            raise UploadIntakeError(415, SUPPORTED_TYPE_MESSAGE)

    per_file_limit = getattr(
        settings, "upload_file_max_size_bytes", DEFAULT_UPLOAD_FILE_MAX_SIZE_BYTES
    )
    aggregate_limit = getattr(
        settings, "upload_batch_max_size_bytes", DEFAULT_UPLOAD_BATCH_MAX_SIZE_BYTES
    )
    if any(len(item.content) > per_file_limit for item in items):
        raise UploadIntakeError(
            413, "upload_limit_exceeded: per-file size limit exceeded"
        )
    if sum(len(item.content) for item in items) > aggregate_limit:
        raise UploadIntakeError(
            413, "upload_limit_exceeded: aggregate size limit exceeded"
        )


def _batch_inputs_from_uploads(
    files: list[UploadIntakeFile], settings: Settings
) -> list[_UploadBatchInput]:
    items: list[_UploadBatchInput] = []
    for file in files:
        filename = _safe_filename(file.filename)
        extension = _validate_upload(file)
        if extension != ".zip":
            raise UploadIntakeError(415, SUPPORTED_TYPE_MESSAGE)

        nested_items = _nested_zip_batch_inputs(file.content, settings)
        if nested_items is not None:
            items.extend(nested_items)
        else:
            items.append(
                _UploadBatchInput(
                    filename=filename,
                    content=file.content,
                    content_type=file.content_type or "application/octet-stream",
                )
            )

    _validate_batch_inputs(items, settings)
    return items


def _nested_zip_batch_inputs(
    content: bytes, settings: Settings
) -> list[_UploadBatchInput] | None:
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            entries = [info for info in archive.infolist() if not info.is_dir()]
            if not entries:
                return None
            if any("\\" in info.filename for info in entries):
                return None

            paths_by_entry = [(info, PurePosixPath(info.filename)) for info in entries]
            if any(
                path.is_absolute()
                or any(part in {"", ".", ".."} for part in path.parts)
                for _info, path in paths_by_entry
            ):
                return None

            content_entries = [
                (info, path)
                for info, path in paths_by_entry
                if not _is_nested_zip_bundle_metadata_path(path)
            ]
            if not content_entries:
                return None
            if any(
                path.suffix.lower() in {".html", ".htm"}
                for _info, path in content_entries
            ):
                return None
            if not all(
                path.suffix.lower() == ".zip" for _info, path in content_entries
            ):
                return None

            items = [
                _UploadBatchInput(
                    filename=path.name,
                    content=archive.read(info.filename),
                    content_type="application/zip",
                )
                for info, path in content_entries
            ]
    except zipfile.BadZipFile:
        return None

    _validate_batch_inputs(items, settings)
    return items


def _is_nested_zip_bundle_metadata_path(path: PurePosixPath) -> bool:
    return path.name == ".DS_Store" or bool(path.parts and path.parts[0] == "__MACOSX")


def _remove_staged_archive_roots(
    settings: Settings, staged_archive_roots: list[Path]
) -> None:
    for archive_root in staged_archive_roots:
        shutil.rmtree(archive_root, ignore_errors=True)
    source_archives_dir = Path(settings.upload_dir) / "source-archives"
    try:
        source_archives_dir.rmdir()
    except OSError:
        pass


def _queue_batch_uploads(
    *,
    db: Session,
    settings: Settings,
    upload_dir: Path,
    items: list[_UploadBatchInput],
    now: object,
) -> UploadBatchQueued:
    batch = UploadBatch(
        status="queued",
        file_count=len(items),
        metadata_json=json.dumps(
            {"filenames": [item.filename for item in items]},
            sort_keys=True,
            separators=(",", ":"),
        ),
        created_at=now,
        updated_at=now,
    )
    db.add(batch)
    db.flush()

    staged_archive_roots: list[Path] = []
    jobs: list[tuple[str, Upload, IngestionJob]] = []
    current_filename = "upload"
    try:
        for position, item in enumerate(items):
            current_filename = item.filename
            upload, job = _create_upload_and_job(
                db=db,
                settings=settings,
                upload_dir=upload_dir,
                filename=item.filename,
                content_type=item.content_type,
                content=item.content,
                extension=".zip",
                now=now,
                batch_id=batch.id,
                batch_position=position,
                staged_archive_roots=staged_archive_roots,
            )
            jobs.append((item.filename, upload, job))
        for _filename, _upload, job in jobs:
            add_event(
                db,
                job,
                "queued",
                "Upload queued for ingestion",
                {"status": "queued", "batch_id": batch.id},
            )
        db.commit()
    except ArchiveValidationError as exc:
        db.rollback()
        _remove_staged_archive_roots(settings, staged_archive_roots)
        detail = str(exc)
        if current_filename not in detail:
            detail = f"{current_filename}: {detail}"
        raise UploadIntakeError(400, detail) from exc
    except Exception:
        db.rollback()
        _remove_staged_archive_roots(settings, staged_archive_roots)
        raise

    db.refresh(batch)
    return UploadBatchQueued(
        batch_id=batch.id,
        status=batch.status,
        items=[
            UploadBatchQueuedItem(
                filename=filename, upload_id=upload.id, job_id=job.id, status=job.status
            )
            for filename, upload, job in jobs
        ],
        queued=all(job.status == "queued" for _, _, job in jobs),
        upload_status_url=f"/upload?batch_id={batch.id}",
    )
