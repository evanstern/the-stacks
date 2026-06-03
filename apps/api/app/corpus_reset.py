from __future__ import annotations

import hashlib
import json
import shutil
from collections.abc import Iterable, Sequence
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Protocol

import httpx
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .config import Settings
from .corpus_manifest import DEFAULT_RUNTIME_VERSION, DEFAULT_SOURCE_IDENTITIES
from .models import (
    ActiveVersionPointer,
    Document,
    DocumentChunk,
    ImmutableSourceArchive,
    IndexedChunk,
    IngestionEvent,
    IngestionJob,
    RuntimeVersion,
    Section,
    Source,
    TeardownStep,
    Upload,
    UploadBatch,
    VersionLifecycleEvent,
    utcnow,
)
from .version_lifecycle import DEFAULT_ACTIVE_POINTER_NAME, TEARDOWN_LOCKED_STATUSES


RUNNING_JOB_STATUSES = frozenset({"queued", "processing", "chunking", "awaiting_embedding", "embedding", "indexing"})
RESET_EVENT_DRY_RUN = "corpus_reset_dry_run"
RESET_EVENT_STARTED = "corpus_reset_started"
RESET_EVENT_COMPLETED = "corpus_reset_completed"


class CorpusResetError(RuntimeError):
    pass


@dataclass(frozen=True)
class CorpusResetCounts:
    upload_batches: int
    uploads: int
    jobs: int
    ingestion_events: int
    sources: int
    documents: int
    sections: int
    chunks: int
    indexed_chunks: int
    qdrant_points: int
    derived_paths: int


@dataclass(frozen=True)
class CorpusResetManifest:
    corpus_version: str
    runtime_version_id: str
    qdrant_collection: str
    dry_run: bool
    delete: dict[str, object]
    preserve: dict[str, object]
    counts: CorpusResetCounts


@dataclass(frozen=True)
class CorpusResetResult:
    manifest: CorpusResetManifest
    deleted: CorpusResetCounts
    archive_sha_before: str
    archive_sha_after: str


class CorpusResetBackend(Protocol):
    def delete_indexed_points(self, *, collection: str, point_ids: Sequence[str]) -> None:
        ...


class HttpCorpusResetBackend(CorpusResetBackend):
    def __init__(self, settings: Settings) -> None:
        self.url: str = settings.qdrant_url.rstrip("/")

    def delete_indexed_points(self, *, collection: str, point_ids: Sequence[str]) -> None:
        if not point_ids:
            return
        response = httpx.post(
            f"{self.url}/collections/{collection}/points/delete?wait=true",
            json={"points": list(point_ids)},
            timeout=120,
        )
        try:
            _ = response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise CorpusResetError(f"Could not delete Qdrant points for {collection}: {response.text[:1000]}") from exc


class CorpusResetService:
    def __init__(self, *, db: Session, settings: Settings, backend: CorpusResetBackend | None = None) -> None:
        self.db: Session = db
        self.settings: Settings = settings
        self.backend: CorpusResetBackend = backend or HttpCorpusResetBackend(settings)

    def dry_run(self, *, version: str = DEFAULT_RUNTIME_VERSION) -> CorpusResetResult:
        return self.reset(version=version, confirm_version=None, dry_run=True)

    def reset(
        self,
        *,
        version: str = DEFAULT_RUNTIME_VERSION,
        confirm_version: str | None = None,
        dry_run: bool = False,
    ) -> CorpusResetResult:
        runtime_version = self._locked_runtime_version(version)
        self._refuse_active_version(runtime_version)
        self._refuse_teardown_locked(runtime_version)
        target = self._collect_target(runtime_version)
        if target.running_job_ids:
            raise CorpusResetError(f"Refusing reset while target jobs are running: {', '.join(sorted(target.running_job_ids))}")
        archive_sha_before = self._archive_sha(runtime_version)
        manifest = self._manifest(runtime_version=runtime_version, target=target, dry_run=dry_run or confirm_version is None)

        if confirm_version is None:
            return CorpusResetResult(
                manifest=manifest,
                deleted=_zero_counts(),
                archive_sha_before=archive_sha_before,
                archive_sha_after=self._archive_sha(runtime_version),
            )
        if confirm_version != version:
            raise CorpusResetError(f"--confirm-version {version} required")
        if dry_run:
            raise CorpusResetError("Dry-run reset cannot also provide a confirmation version")

        self._record_event(runtime_version.id, RESET_EVENT_STARTED, "Corpus runtime reset started", {"manifest": _as_jsonable(manifest)})
        deleted = self._delete_target_runtime(runtime_version, target)
        archive_sha_after = self._archive_sha(runtime_version)
        if archive_sha_after != archive_sha_before:
            raise CorpusResetError("Immutable archive SHA changed during reset")
        self._record_event(
            runtime_version.id,
            RESET_EVENT_COMPLETED,
            "Corpus runtime reset completed",
            {"deleted": asdict(deleted), "archive_sha256": archive_sha_after},
        )
        self.db.flush()
        return CorpusResetResult(
            manifest=self._manifest(runtime_version=runtime_version, target=target, dry_run=False),
            deleted=deleted,
            archive_sha_before=archive_sha_before,
            archive_sha_after=archive_sha_after,
        )

    def _locked_runtime_version(self, version: str) -> RuntimeVersion:
        statement = (
            select(RuntimeVersion)
            .where(
                (RuntimeVersion.id == version)
                | (RuntimeVersion.label_slug == version)
                | (RuntimeVersion.display_label == version)
            )
            .with_for_update()
        )
        matches = list(self.db.scalars(statement).all())
        if not matches:
            raise CorpusResetError(f"Runtime version {version!r} does not exist")
        if len(matches) > 1:
            raise CorpusResetError(f"Runtime version {version!r} is ambiguous")
        return matches[0]

    def _refuse_active_version(self, runtime_version: RuntimeVersion) -> None:
        pointer = self.db.get(ActiveVersionPointer, DEFAULT_ACTIVE_POINTER_NAME)
        if pointer is not None and pointer.runtime_version_id == runtime_version.id:
            raise CorpusResetError("Active runtime version cannot be reset")

    def _refuse_teardown_locked(self, runtime_version: RuntimeVersion) -> None:
        locked_step = self.db.scalars(
            select(TeardownStep).where(
                TeardownStep.runtime_version_id == runtime_version.id,
                TeardownStep.status.in_(TEARDOWN_LOCKED_STATUSES),
            )
        ).first()
        if locked_step is not None:
            raise CorpusResetError("Runtime version is locked by an in-progress lifecycle operation")

    def _collect_target(self, runtime_version: RuntimeVersion) -> _TargetRuntime:
        source_ids = set(DEFAULT_SOURCE_IDENTITIES)
        sources = list(self.db.scalars(select(Source).where(Source.id.in_(source_ids))).all())
        source_row_ids = {source.id for source in sources}
        upload_ids = {source.upload_id for source in sources}
        documents = list(self.db.scalars(select(Document).where(Document.source_id.in_(source_row_ids))).all()) if source_row_ids else []
        document_ids = {document.id for document in documents}
        sections = list(self.db.scalars(select(Section).where(Section.document_id.in_(document_ids))).all()) if document_ids else []
        chunks = list(self.db.scalars(select(DocumentChunk).where(DocumentChunk.source_id.in_(source_row_ids))).all()) if source_row_ids else []
        chunk_ids = {chunk.id for chunk in chunks}

        jobs_by_upload = list(self.db.scalars(select(IngestionJob).where(IngestionJob.upload_id.in_(upload_ids))).all()) if upload_ids else []
        jobs_by_metadata = [
            job
            for job in self.db.scalars(select(IngestionJob)).all()
            if _job_targets_version(job, runtime_version, source_ids)
        ]
        jobs = _unique_by_id([*jobs_by_upload, *jobs_by_metadata])
        job_ids = {job.id for job in jobs}
        upload_ids.update(job.upload_id for job in jobs)
        uploads = list(self.db.scalars(select(Upload).where(Upload.id.in_(upload_ids))).all()) if upload_ids else []
        indexed_conditions = [IndexedChunk.qdrant_collection == runtime_version.qdrant_collection]
        if chunk_ids:
            indexed_conditions.append(IndexedChunk.document_chunk_id.in_(chunk_ids))
        if job_ids:
            indexed_conditions.append(IndexedChunk.ingestion_job_id.in_(job_ids))
        indexed_chunks = list(self.db.scalars(select(IndexedChunk).where(or_(*indexed_conditions))).all())
        ingestion_events = list(self.db.scalars(select(IngestionEvent).where(IngestionEvent.ingestion_job_id.in_(job_ids))).all()) if job_ids else []
        batch_ids = {job.batch_id for job in jobs if job.batch_id is not None}
        upload_batches = list(self.db.scalars(select(UploadBatch).where(UploadBatch.id.in_(batch_ids))).all()) if batch_ids else []
        safe_paths = self._existing_safe_derived_paths(runtime_version)
        running_job_ids = {job.id for job in jobs if job.status in RUNNING_JOB_STATUSES}
        return _TargetRuntime(
            sources=sources,
            documents=documents,
            sections=sections,
            chunks=chunks,
            indexed_chunks=indexed_chunks,
            ingestion_events=ingestion_events,
            jobs=jobs,
            uploads=uploads,
            upload_batches=upload_batches,
            derived_paths=safe_paths,
            running_job_ids=running_job_ids,
        )

    def _existing_safe_derived_paths(self, runtime_version: RuntimeVersion) -> list[Path]:
        paths: list[Path] = []
        for prefix in (runtime_version.upload_prefix, runtime_version.static_prefix, runtime_version.runtime_prefix):
            path = self._safe_derived_path(prefix)
            if path.exists():
                paths.append(path)
        return paths

    def _safe_derived_path(self, prefix: str) -> Path:
        if not prefix.startswith("versions/") or "source-archives" in prefix:
            raise CorpusResetError(f"Unsafe runtime-derived path prefix: {prefix}")
        upload_root = Path(self.settings.upload_dir).resolve()
        path = (upload_root / prefix).resolve()
        try:
            _ = path.relative_to(upload_root)
        except ValueError as exc:
            raise CorpusResetError(f"Unsafe runtime-derived path prefix: {prefix}") from exc
        return path

    def _manifest(self, *, runtime_version: RuntimeVersion, target: _TargetRuntime, dry_run: bool) -> CorpusResetManifest:
        counts = target.counts()
        return CorpusResetManifest(
            corpus_version=runtime_version.label_slug or runtime_version.display_label or runtime_version.id,
            runtime_version_id=runtime_version.id,
            qdrant_collection=runtime_version.qdrant_collection,
            dry_run=dry_run,
            delete={
                "db_rows": asdict(counts),
                "source_ids": sorted(source.id for source in target.sources),
                "upload_ids": sorted(upload.id for upload in target.uploads),
                "job_ids": sorted(job.id for job in target.jobs),
                "qdrant_point_ids": sorted(indexed.qdrant_point_id for indexed in target.indexed_chunks),
                "derived_paths": [str(path) for path in target.derived_paths],
            },
            preserve={
                "runtime_version_id": runtime_version.id,
                "active_pointer": DEFAULT_ACTIVE_POINTER_NAME,
                "archive": self._archive_reference(runtime_version),
                "other_runtime_versions": "preserved",
            },
            counts=counts,
        )

    def _delete_target_runtime(self, runtime_version: RuntimeVersion, target: _TargetRuntime) -> CorpusResetCounts:
        self.backend.delete_indexed_points(
            collection=runtime_version.qdrant_collection,
            point_ids=[indexed.qdrant_point_id for indexed in target.indexed_chunks],
        )
        for rows in (
            target.indexed_chunks,
            target.ingestion_events,
            target.chunks,
            target.sections,
            target.documents,
            target.sources,
            target.jobs,
            target.uploads,
        ):
            for row in rows:
                self.db.delete(row)

        deleted_batches = 0
        for batch in target.upload_batches:
            remaining_upload = self.db.scalars(select(Upload).where(Upload.batch_id == batch.id, ~Upload.id.in_({upload.id for upload in target.uploads}))).first()
            if remaining_upload is None:
                self.db.delete(batch)
                deleted_batches += 1

        deleted_paths = 0
        for path in target.derived_paths:
            if path.exists():
                if path.is_dir():
                    shutil.rmtree(path)
                else:
                    path.unlink()
                deleted_paths += 1
        self.db.flush()
        counts = target.counts()
        return CorpusResetCounts(**{**asdict(counts), "upload_batches": deleted_batches, "derived_paths": deleted_paths})

    def _archive_reference(self, runtime_version: RuntimeVersion) -> dict[str, object]:
        archive = self.db.get(ImmutableSourceArchive, runtime_version.source_archive_hash)
        if archive is None:
            raise CorpusResetError("Runtime version immutable archive metadata is missing")
        return {
            "content_hash": archive.content_hash,
            "storage_path": archive.storage_path,
            "size_bytes": archive.size_bytes,
            "original_filename": archive.original_filename,
        }

    def _archive_sha(self, runtime_version: RuntimeVersion) -> str:
        archive = self.db.get(ImmutableSourceArchive, runtime_version.source_archive_hash)
        if archive is None:
            raise CorpusResetError("Runtime version immutable archive metadata is missing")
        archive_path = Path(archive.storage_path)
        if not archive_path.is_file():
            raise CorpusResetError("Runtime version immutable archive bytes are missing")
        actual_sha = hashlib.sha256(archive_path.read_bytes()).hexdigest()
        if actual_sha != archive.content_hash:
            raise CorpusResetError("Runtime version immutable archive SHA does not match metadata")
        return actual_sha

    def _record_event(self, runtime_version_id: str, event_type: str, message: str, metadata: dict[str, object]) -> None:
        self.db.add(
            VersionLifecycleEvent(
                runtime_version_id=runtime_version_id,
                event_type=event_type,
                message=message,
                metadata_json=json.dumps(metadata, sort_keys=True, separators=(",", ":")),
                created_at=utcnow(),
            )
        )


@dataclass(frozen=True)
class _TargetRuntime:
    sources: list[Source]
    documents: list[Document]
    sections: list[Section]
    chunks: list[DocumentChunk]
    indexed_chunks: list[IndexedChunk]
    ingestion_events: list[IngestionEvent]
    jobs: list[IngestionJob]
    uploads: list[Upload]
    upload_batches: list[UploadBatch]
    derived_paths: list[Path]
    running_job_ids: set[str]

    def counts(self) -> CorpusResetCounts:
        return CorpusResetCounts(
            upload_batches=len(self.upload_batches),
            uploads=len(self.uploads),
            jobs=len(self.jobs),
            ingestion_events=len(self.ingestion_events),
            sources=len(self.sources),
            documents=len(self.documents),
            sections=len(self.sections),
            chunks=len(self.chunks),
            indexed_chunks=len(self.indexed_chunks),
            qdrant_points=len(self.indexed_chunks),
            derived_paths=len(self.derived_paths),
        )


def _job_targets_version(job: IngestionJob, runtime_version: RuntimeVersion, source_ids: set[str]) -> bool:
    metadata = _json_dict(job.metadata_json)
    if metadata.get("runtime_version") in {runtime_version.id, runtime_version.label_slug, runtime_version.display_label}:
        return True
    if metadata.get("runtime_version_id") == runtime_version.id:
        return True
    if metadata.get("corpus_version") in {runtime_version.label_slug, runtime_version.display_label}:
        return True
    if metadata.get("source_id") in source_ids:
        return True
    return metadata.get("qdrant_collection") == runtime_version.qdrant_collection


def _json_dict(raw_json: str) -> dict[str, object]:
    try:
        value = json.loads(raw_json or "{}")
    except json.JSONDecodeError:
        return {}
    return dict(value) if isinstance(value, dict) else {}


def _unique_by_id(rows: Iterable[IngestionJob]) -> list[IngestionJob]:
    seen: set[str] = set()
    unique: list[IngestionJob] = []
    for row in rows:
        if row.id not in seen:
            seen.add(row.id)
            unique.append(row)
    return unique


def _zero_counts() -> CorpusResetCounts:
    return CorpusResetCounts(
        upload_batches=0,
        uploads=0,
        jobs=0,
        ingestion_events=0,
        sources=0,
        documents=0,
        sections=0,
        chunks=0,
        indexed_chunks=0,
        qdrant_points=0,
        derived_paths=0,
    )


def _as_jsonable(manifest: CorpusResetManifest) -> dict[str, object]:
    return asdict(manifest)
