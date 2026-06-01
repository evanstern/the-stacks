import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import current_admin_session
from app.database import get_db
from app.models import AdminSession, IngestionEvent, IngestionJob
from app.schemas import IngestionEventRead, IngestionJobRead


router = APIRouter(tags=["jobs"])


@router.get("/jobs/{job_id}", response_model=IngestionJobRead)
def read_job(
    job_id: str,
    _: AdminSession = Depends(current_admin_session),
    db: Session = Depends(get_db),
) -> IngestionJobRead:
    job = db.get(IngestionJob, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ingestion job not found")
    return _job_read(job)


@router.get("/jobs/{job_id}/events", response_model=list[IngestionEventRead])
def read_job_events(
    job_id: str,
    _: AdminSession = Depends(current_admin_session),
    db: Session = Depends(get_db),
) -> list[IngestionEventRead]:
    if db.get(IngestionJob, job_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ingestion job not found")
    events = db.scalars(
        select(IngestionEvent).where(IngestionEvent.ingestion_job_id == job_id).order_by(IngestionEvent.created_at)
    ).all()
    return [_event_read(event) for event in events]


@router.get("/ingestion/jobs/{job_id}", response_model=IngestionJobRead, include_in_schema=False)
def read_ingestion_job_alias(
    job_id: str,
    admin_session: AdminSession = Depends(current_admin_session),
    db: Session = Depends(get_db),
) -> IngestionJobRead:
    return read_job(job_id, admin_session, db)


@router.get("/ingestion/jobs/{job_id}/events", response_model=list[IngestionEventRead], include_in_schema=False)
def read_ingestion_job_events_alias(
    job_id: str,
    admin_session: AdminSession = Depends(current_admin_session),
    db: Session = Depends(get_db),
) -> list[IngestionEventRead]:
    return read_job_events(job_id, admin_session, db)


def _job_read(job: IngestionJob) -> IngestionJobRead:
    return IngestionJobRead(
        id=job.id,
        upload_id=job.upload_id,
        status=job.status,
        error_summary=job.error_summary,
        metadata=json.loads(job.metadata_json),
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


def _event_read(event: IngestionEvent) -> IngestionEventRead:
    return IngestionEventRead(
        id=event.id,
        ingestion_job_id=event.ingestion_job_id,
        upload_id=event.upload_id,
        event_type=event.event_type,
        message=event.message,
        metadata=json.loads(event.metadata_json),
        created_at=event.created_at,
    )
