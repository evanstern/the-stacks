import json
import re

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import current_admin_session
from app.config import Settings, get_settings
from app.database import get_db
from app.ingestion import FAILURE_CATEGORIES, FAILURE_METADATA_KEY
from app.models import AdminSession, IngestionJob, Upload, UploadBatch, utcnow
from app.schemas import (
    UploadBatchChildError,
    UploadBatchQueued,
    UploadBatchStatusItem,
    UploadBatchStatusRead,
    UploadBatchStatusSummary,
    UploadQueued,
)
from app.upload_intake_service import (
    UploadIntakeError,
    UploadIntakeFile,
    UploadIntakeService,
)


TERMINAL_SUCCESS_STATUSES = {"completed"}
TERMINAL_FAILURE_STATUSES = {"failed"}
RUNNING_STATUSES = {
    "processing",
    "chunking",
    "awaiting_embedding",
    "embedding",
    "indexing",
}
UNSAFE_ERROR_PATTERNS = [
    re.compile(r"Traceback", re.IGNORECASE),
    re.compile(r"\bFile \""),
    re.compile(r"/(?:home|tmp|var|srv|data|app|mnt)/"),
    re.compile(r"[A-Za-z]:\\\\"),
]

router = APIRouter(prefix="/uploads", tags=["uploads"])


def _upload_intake_service_dependency() -> UploadIntakeService:
    return UploadIntakeService()


def _aggregate_batch_status(child_statuses: list[str]) -> str:
    if child_statuses and all(status == "queued" for status in child_statuses):
        return "queued"

    success_count = sum(
        status in TERMINAL_SUCCESS_STATUSES for status in child_statuses
    )
    failure_count = sum(
        status in TERMINAL_FAILURE_STATUSES for status in child_statuses
    )
    terminal_count = success_count + failure_count

    if child_statuses and terminal_count == len(child_statuses):
        if success_count == len(child_statuses):
            return "completed"
        if failure_count == len(child_statuses):
            return "failed"
        return "partial_failed"

    if any(
        status in RUNNING_STATUSES or status == "queued" for status in child_statuses
    ):
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
    return UploadBatchChildError(
        filename=filename, category="unknown_error", message=message[:500]
    )


def _structured_child_error(
    filename: str, job: IngestionJob
) -> UploadBatchChildError | None:
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
    if not isinstance(message, str) or any(
        pattern.search(message) for pattern in UNSAFE_ERROR_PATTERNS
    ):
        message = "Import failed. Review the file and try again."
    if not isinstance(stored_filename, str) or stored_filename != filename:
        stored_filename = filename
    return UploadBatchChildError(
        filename=stored_filename, category=category, message=message[:500]
    )


@router.get("/batches/{batch_id}", response_model=UploadBatchStatusRead)
def read_upload_batch(
    batch_id: str,
    _admin_session: AdminSession = Depends(current_admin_session),
    db: Session = Depends(get_db),
) -> UploadBatchStatusRead:
    batch = db.get(UploadBatch, batch_id)
    if batch is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Upload batch not found"
        )

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


@router.post(
    "",
    response_model=UploadQueued | UploadBatchQueued,
    status_code=status.HTTP_201_CREATED,
)
def create_upload(
    file: list[UploadFile] = File(default=[]),
    _admin_session: AdminSession = Depends(current_admin_session),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    upload_intake_service: UploadIntakeService = Depends(
        _upload_intake_service_dependency
    ),
) -> UploadQueued | UploadBatchQueued:
    intake_files = [
        UploadIntakeFile(
            filename=upload_file.filename,
            content=upload_file.file.read(),
            content_type=upload_file.content_type,
        )
        for upload_file in file
    ]
    try:
        return upload_intake_service.create_upload(
            db=db, settings=settings, files=intake_files
        )
    except UploadIntakeError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
