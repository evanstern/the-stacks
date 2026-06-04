#!/usr/bin/env python3
# pyright: reportMissingImports=false
"""Compose-backed ETL smoke verification for PostgreSQL and Qdrant.

The smoke creates one small markdown upload/job in the compose PostgreSQL
database, processes it through the real ETL indexing path with deterministic
local embeddings, then independently verifies that both PostgreSQL rows and
Qdrant points were persisted.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys
import tempfile
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

import httpx
from sqlalchemy import create_engine, delete, select
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings
from app.database import Base
from app.embeddings import EmbeddingBatch, EmbeddingClient
from app.ingestion import add_event, process_next_job
from app.models import Document, DocumentChunk, IndexedChunk, IngestionEvent, IngestionJob, Section, Source, Upload, utcnow
from app.qdrant_index import HttpQdrantIndexer


DEFAULT_DATABASE_URL = "postgresql+psycopg://thestacks:thestacks@localhost:5432/thestacks"
DEFAULT_QDRANT_URL = "http://localhost:6333"
DEFAULT_COLLECTION = "etl_live_smoke_chunks"
SMOKE_CONTENT = "# Live Smoke Fixture\nA deterministic goblin cartographer maps real Postgres and Qdrant state.\n"
EMBEDDING_DIMENSIONS = 8
EMBEDDING_MODEL = "deterministic-live-smoke"


@dataclass(frozen=True)
class SmokeContext:
    run_id: str
    source_id: str
    collection: str
    upload_path: Path


class DeterministicEmbeddingClient(EmbeddingClient):
    model = EMBEDDING_MODEL
    dimensions = EMBEDDING_DIMENSIONS

    def embed_texts(self, texts: Sequence[str]) -> EmbeddingBatch:
        return EmbeddingBatch(
            vectors=[_deterministic_vector(text, self.dimensions) for text in texts],
            model=self.model,
            dimensions=self.dimensions,
        )


def main() -> int:
    args = parse_args()
    database_url = args.database_url or os.environ.get("DATABASE_URL") or DEFAULT_DATABASE_URL
    qdrant_url = args.qdrant_url or os.environ.get("QDRANT_URL") or DEFAULT_QDRANT_URL
    collection = args.collection or os.environ.get("QDRANT_COLLECTION") or DEFAULT_COLLECTION
    run_id = args.run_id or f"etl-live-smoke-{uuid4().hex[:12]}"
    context = SmokeContext(
        run_id=run_id,
        source_id=f"{run_id}-source",
        collection=collection,
        upload_path=Path(tempfile.mkdtemp(prefix=f"{run_id}-")) / "fixture.md",
    )

    print(f"[etl-live-smoke] namespace={context.run_id}")
    print(f"[etl-live-smoke] postgres={_redact_database_url(database_url)}")
    print(f"[etl-live-smoke] qdrant={qdrant_url} collection={collection}")

    engine = create_engine(database_url)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    settings = Settings(DATABASE_URL=database_url, QDRANT_URL=qdrant_url, QDRANT_COLLECTION=collection)

    try:
        Base.metadata.create_all(bind=engine)
        reset_qdrant_collection(qdrant_url, collection)
        with SessionLocal() as db:
            cleanup_postgres_namespace(db, context.run_id, context.source_id)
            job_id = create_fixture_job(db, context)
            processed = process_next_job(
                db,
                embedding_client=DeterministicEmbeddingClient(),
                qdrant_indexer=HttpQdrantIndexer(settings),
                settings=settings,
            )
            if processed is None or processed.id != job_id:
                fail(f"expected to process job {job_id}, got {getattr(processed, 'id', None)}")
            assert processed is not None
            if processed.status != "completed":
                fail(f"job {job_id} ended with status={processed.status} error={processed.error_summary}")
            evidence = verify_postgres(db, job_id, collection, context.source_id)
        verify_qdrant(qdrant_url, collection, evidence)
    finally:
        shutil.rmtree(context.upload_path.parent, ignore_errors=True)
        engine.dispose()

    print(
        "[etl-live-smoke] verified "
        f"job={evidence['job_id']} chunks={evidence['chunk_count']} indexed={evidence['indexed_count']} "
        f"qdrant_points={evidence['point_count']}"
    )
    print("[etl-live-smoke] completed successfully")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run compose-backed ETL live smoke verification.")
    parser.add_argument("--database-url", help="PostgreSQL URL; defaults to compose localhost credentials.")
    parser.add_argument("--qdrant-url", help="Qdrant URL; defaults to http://localhost:6333.")
    parser.add_argument("--collection", help=f"Qdrant collection to reset/use; defaults to {DEFAULT_COLLECTION}.")
    parser.add_argument("--run-id", help="Optional isolated namespace prefix for inserted rows.")
    return parser.parse_args()


def create_fixture_job(db: Session, context: SmokeContext) -> str:
    context.upload_path.write_text(SMOKE_CONTENT, encoding="utf-8")
    content_bytes = SMOKE_CONTENT.encode("utf-8")
    upload = Upload(
        original_filename=f"{context.run_id}-fixture.md",
        stored_path=str(context.upload_path),
        content_type="text/markdown",
        extension=".md",
        sha256=hashlib.sha256(content_bytes).hexdigest(),
        size_bytes=len(content_bytes),
        created_at=utcnow(),
    )
    db.add(upload)
    db.flush()
    job = IngestionJob(
        upload_id=upload.id,
        status="queued",
        metadata_json=json.dumps({"source_id": context.source_id, "smoke_run_id": context.run_id}),
        created_at=utcnow(),
        updated_at=utcnow(),
    )
    db.add(job)
    db.flush()
    add_event(db, job, "queued", "ETL live smoke queued fixture", {"status": "queued", "smoke_run_id": context.run_id})
    db.commit()
    db.refresh(job)
    print(f"[etl-live-smoke] queued fixture job={job.id}")
    return job.id


def verify_postgres(db: Session, job_id: str, collection: str, source_id: str) -> dict[str, object]:
    job = db.get(IngestionJob, job_id)
    if job is None:
        fail(f"PostgreSQL verification could not find job {job_id}")
    assert job is not None
    if job.status != "completed":
        fail(f"PostgreSQL job status is {job.status}, expected completed")

    source = db.get(Source, source_id)
    if source is None:
        fail(f"PostgreSQL verification could not find source {source_id}")
    assert source is not None

    chunks = list(db.scalars(select(DocumentChunk).where(DocumentChunk.ingestion_job_id == job_id)).all())
    indexed = list(db.scalars(select(IndexedChunk).where(IndexedChunk.ingestion_job_id == job_id)).all())
    event_types = list(
        db.scalars(
            select(IngestionEvent.event_type)
            .where(IngestionEvent.ingestion_job_id == job_id)
            .order_by(IngestionEvent.created_at)
        ).all()
    )

    if len(chunks) != 1:
        fail(f"PostgreSQL expected exactly one chunk, found {len(chunks)}")
    if len(indexed) != 1:
        fail(f"PostgreSQL expected exactly one indexed chunk, found {len(indexed)}")
    if indexed[0].qdrant_collection != collection:
        fail(f"PostgreSQL indexed chunk collection={indexed[0].qdrant_collection}, expected {collection}")
    required_events = {"queued", "awaiting_embedding", "indexing_completed", "job_completed"}
    missing_events = sorted(required_events.difference(event_types))
    if missing_events:
        fail(f"PostgreSQL missing ingestion events: {', '.join(missing_events)}")

    print(
        "[etl-live-smoke] postgres observed "
        f"source={source.id} job={job.id} chunk={chunks[0].id} point={indexed[0].qdrant_point_id}"
    )
    return {
        "job_id": job.id,
        "chunk_id": chunks[0].id,
        "point_id": indexed[0].qdrant_point_id,
        "chunk_count": len(chunks),
        "indexed_count": len(indexed),
        "point_count": len(indexed),
    }


def verify_qdrant(qdrant_url: str, collection: str, evidence: dict[str, object]) -> None:
    response = httpx.post(
        f"{qdrant_url.rstrip('/')}/collections/{collection}/points",
        json={"ids": [evidence["point_id"]], "with_payload": True, "with_vector": False},
        timeout=30,
    )
    if response.status_code != 200:
        fail(f"Qdrant point lookup failed: HTTP {response.status_code} {response.text[:500]}")
    points = response.json().get("result", [])
    if len(points) != 1:
        fail(f"Qdrant expected one point id={evidence['point_id']}, found {len(points)}")
    payload = points[0].get("payload", {})
    if payload.get("chunk_id") != evidence["chunk_id"]:
        fail(f"Qdrant payload chunk_id={payload.get('chunk_id')}, expected {evidence['chunk_id']}")
    if payload.get("ingestion_job_id") != evidence["job_id"]:
        fail(f"Qdrant payload ingestion_job_id={payload.get('ingestion_job_id')}, expected {evidence['job_id']}")
    print(f"[etl-live-smoke] qdrant observed point={evidence['point_id']} payload_job={payload.get('ingestion_job_id')}")


def reset_qdrant_collection(qdrant_url: str, collection: str) -> None:
    response = httpx.delete(f"{qdrant_url.rstrip('/')}/collections/{collection}", timeout=30)
    if response.status_code not in {200, 404}:
        fail(f"Qdrant collection reset failed: HTTP {response.status_code} {response.text[:500]}")
    print(f"[etl-live-smoke] reset qdrant collection={collection}")


def cleanup_postgres_namespace(db: Session, run_id: str, source_id: str) -> None:
    upload_ids = list(
        db.scalars(select(Upload.id).where(Upload.original_filename.like(f"{run_id}%"))).all()
    )
    job_ids = list(db.scalars(select(IngestionJob.id).where(IngestionJob.upload_id.in_(upload_ids))).all()) if upload_ids else []
    chunk_ids = list(db.scalars(select(DocumentChunk.id).where(DocumentChunk.ingestion_job_id.in_(job_ids))).all()) if job_ids else []
    document_ids = list(db.scalars(select(Document.id).where(Document.source_id == source_id)).all())

    if job_ids:
        db.execute(delete(IngestionEvent).where(IngestionEvent.ingestion_job_id.in_(job_ids)))
        db.execute(delete(IndexedChunk).where(IndexedChunk.ingestion_job_id.in_(job_ids)))
    if chunk_ids:
        db.execute(delete(DocumentChunk).where(DocumentChunk.id.in_(chunk_ids)))
    if document_ids:
        db.execute(delete(Section).where(Section.document_id.in_(document_ids)))
        db.execute(delete(Document).where(Document.id.in_(document_ids)))
    db.execute(delete(Source).where(Source.id == source_id))
    if job_ids:
        db.execute(delete(IngestionJob).where(IngestionJob.id.in_(job_ids)))
    if upload_ids:
        db.execute(delete(Upload).where(Upload.id.in_(upload_ids)))
    db.commit()


def _deterministic_vector(text: str, dimensions: int) -> list[float]:
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    return [((digest[index] / 255.0) * 2.0) - 1.0 for index in range(dimensions)]


def _redact_database_url(database_url: str) -> str:
    return database_url.replace(":thestacks@", ":***@")


def fail(message: str) -> None:
    print(f"[etl-live-smoke] ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


if __name__ == "__main__":
    raise SystemExit(main())
