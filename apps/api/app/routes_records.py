import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.auth import current_admin_session
from app.database import get_db
from app.models import AdminSession, DocumentChunk, IndexedChunk, IngestionJob, RetrievalRun, Source, Upload
from app.schemas import ChunkRead, IngestionJobRead, RecordsStatsRead, RetrievalRunRead, SourceRead, UploadRead


router = APIRouter(prefix="/records", tags=["records"])


@router.get("/stats", response_model=RecordsStatsRead)
def read_stats(
    _: AdminSession = Depends(current_admin_session),
    db: Session = Depends(get_db),
) -> RecordsStatsRead:
    return RecordsStatsRead(
        uploads=db.scalar(select(func.count(Upload.id))) or 0,
        jobs=db.scalar(select(func.count(IngestionJob.id))) or 0,
        sources=db.scalar(select(func.count(Source.id))) or 0,
        chunks=db.scalar(select(func.count(DocumentChunk.id))) or 0,
        indexed_chunks=db.scalar(select(func.count(IndexedChunk.id))) or 0,
        retrieval_runs=db.scalar(select(func.count(RetrievalRun.id))) or 0,
    )


@router.get("/uploads", response_model=list[UploadRead])
def list_uploads(
    _: AdminSession = Depends(current_admin_session),
    db: Session = Depends(get_db),
) -> list[UploadRead]:
    uploads = db.scalars(select(Upload).order_by(desc(Upload.created_at)).limit(50)).all()
    return [_upload_read(upload) for upload in uploads]


@router.get("/uploads/{upload_id}", response_model=UploadRead)
def read_upload(
    upload_id: str,
    _: AdminSession = Depends(current_admin_session),
    db: Session = Depends(get_db),
) -> UploadRead:
    upload = db.get(Upload, upload_id)
    if upload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")
    return _upload_read(upload)


@router.get("/jobs", response_model=list[IngestionJobRead])
def list_jobs(
    _: AdminSession = Depends(current_admin_session),
    db: Session = Depends(get_db),
) -> list[IngestionJobRead]:
    jobs = db.scalars(select(IngestionJob).order_by(desc(IngestionJob.updated_at), desc(IngestionJob.created_at)).limit(50)).all()
    return [_job_read(job) for job in jobs]


@router.get("/retrieval-runs", response_model=list[RetrievalRunRead])
def list_retrieval_runs(
    _: AdminSession = Depends(current_admin_session),
    db: Session = Depends(get_db),
) -> list[RetrievalRunRead]:
    runs = db.scalars(select(RetrievalRun).order_by(desc(RetrievalRun.created_at)).limit(25)).all()
    return [_retrieval_run_read(run) for run in runs]


@router.get("/sources", response_model=list[SourceRead])
def list_sources(
    _: AdminSession = Depends(current_admin_session),
    db: Session = Depends(get_db),
) -> list[SourceRead]:
    chunk_counts = select(DocumentChunk.source_id, func.count(DocumentChunk.id).label("chunk_count")).group_by(DocumentChunk.source_id).subquery()
    indexed_counts = (
        select(DocumentChunk.source_id, func.count(IndexedChunk.id).label("indexed_chunk_count"))
        .join(IndexedChunk, IndexedChunk.document_chunk_id == DocumentChunk.id)
        .group_by(DocumentChunk.source_id)
        .subquery()
    )
    rows = db.execute(
        select(
            Source,
            func.coalesce(chunk_counts.c.chunk_count, 0),
            func.coalesce(indexed_counts.c.indexed_chunk_count, 0),
        )
        .outerjoin(chunk_counts, chunk_counts.c.source_id == Source.id)
        .outerjoin(indexed_counts, indexed_counts.c.source_id == Source.id)
        .order_by(desc(Source.created_at))
        .limit(50)
    ).all()
    return [
        SourceRead(
            id=source.id,
            upload_id=source.upload_id,
            title=source.title,
            original_filename=source.filename,
            extension=source.source_type,
            sha256=str(json.loads(source.metadata_json).get("sha256", "")),
            chunk_count=chunk_count,
            indexed_chunk_count=indexed_chunk_count,
            created_at=source.created_at,
        )
        for source, chunk_count, indexed_chunk_count in rows
    ]


@router.get("/chunks", response_model=list[ChunkRead])
def list_chunks(
    _: AdminSession = Depends(current_admin_session),
    db: Session = Depends(get_db),
) -> list[ChunkRead]:
    chunks = db.scalars(
        select(DocumentChunk).order_by(desc(DocumentChunk.created_at), DocumentChunk.chunk_index).limit(25)
    ).all()
    return [_chunk_read(chunk) for chunk in chunks]


def _upload_read(upload: Upload) -> UploadRead:
    return UploadRead(
        id=upload.id,
        original_filename=upload.original_filename,
        content_type=upload.content_type,
        extension=upload.extension,
        sha256=upload.sha256,
        size_bytes=upload.size_bytes,
        created_at=upload.created_at,
    )


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


def _chunk_read(chunk: DocumentChunk) -> ChunkRead:
    return ChunkRead(
        id=chunk.id,
        upload_id=chunk.upload_id,
        ingestion_job_id=chunk.ingestion_job_id,
        chunk_index=chunk.chunk_index,
        content=chunk.content,
        metadata=json.loads(chunk.metadata_json),
        created_at=chunk.created_at,
    )


def _retrieval_run_read(run: RetrievalRun) -> RetrievalRunRead:
    return RetrievalRunRead(
        id=run.id,
        chat_session_id=run.chat_session_id,
        user_message_id=run.user_message_id,
        assistant_message_id=run.assistant_message_id,
        query=run.query,
        status=run.status,
        metadata=json.loads(run.metadata_json),
        created_at=run.created_at,
    )
