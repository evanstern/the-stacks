from __future__ import annotations

import hashlib
import json
import shutil
from collections.abc import Callable, Sequence
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import Settings
from .corpus_manifest import (
    DEFAULT_RUNTIME_VERSION,
    EXPECTED_COUNT_KEYS,
    CorpusManifest,
    CorpusManifestError,
    CorpusSource,
    load_corpus_manifest,
)
from .embeddings import EmbeddingClient
from .ingestion import process_next_job
from .models import (
    ActiveVersionPointer,
    Document,
    DocumentChunk,
    IndexedChunk,
    IngestionJob,
    RuntimeVersion,
    Section,
    Source,
    Upload,
    UploadBatch,
    utcnow,
)
from .qdrant_index import QdrantIndexer
from .routes_uploads import _UploadBatchInput, _queue_batch_uploads
from .version_lifecycle import DEFAULT_ACTIVE_POINTER_NAME, VersionLifecycleService


class CorpusSeedError(RuntimeError):
    pass


@dataclass(frozen=True)
class CorpusSeedPlan:
    version: str
    source_ids: list[str]
    filenames: list[str]
    reusable_source_ids: list[str]
    enqueue_source_ids: list[str]
    dry_run: bool


@dataclass(frozen=True)
class CorpusSeedResult:
    version: str
    batch_id: str | None
    reused_source_ids: list[str]
    enqueued_source_ids: list[str]
    verification: dict[str, dict[str, int]] | None


@dataclass(frozen=True)
class CorpusLockResult:
    manifest_path: str
    temp_version: str
    manifest: dict[str, object]


class CorpusSeedService:
    def __init__(
        self,
        *,
        db: Session,
        settings: Settings,
        embedding_client: EmbeddingClient | None = None,
        qdrant_indexer_factory: Callable[[str], QdrantIndexer] | None = None,
    ) -> None:
        self.db = db
        self.settings = settings
        self.embedding_client = embedding_client
        self.qdrant_indexer_factory = qdrant_indexer_factory

    def verify_lock_only(self, *, manifest_path: Path, archive_root: Path) -> CorpusManifest:
        return load_corpus_manifest(manifest_path, archive_root=archive_root, require_lock=True)

    def lock(
        self,
        *,
        identity_manifest_path: Path,
        archive_root: Path,
        output_path: Path,
        temp_version: str | None = None,
    ) -> CorpusLockResult:
        identity = load_corpus_manifest(identity_manifest_path, archive_root=archive_root)
        temp_version = temp_version or f"default-corpus-lock-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid4().hex[:8]}"
        if self.db.scalars(select(RuntimeVersion).where(RuntimeVersion.label_slug == temp_version)).first() is not None:
            raise CorpusSeedError(f"Temporary runtime version already exists: {temp_version}")
        self._refuse_active_version_id(temp_version)
        runtime = self._ensure_runtime_version(temp_version, archive_bytes=b"default corpus lock runtime archive")
        try:
            _ = self._seed_loaded_manifest(
                manifest=identity,
                archive_root=archive_root,
                version=temp_version,
                runtime=runtime,
                dry_run=False,
                verify_after=False,
            )
            actual = self._actual_counts_by_source(runtime)
            manifest = _lock_manifest_from_identity(identity, archive_root, actual)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        finally:
            self._delete_runtime_rows(runtime)
            self.db.flush()
        return CorpusLockResult(manifest_path=str(output_path), temp_version=temp_version, manifest=manifest)

    def seed(
        self,
        *,
        manifest_path: Path,
        archive_root: Path,
        version: str = DEFAULT_RUNTIME_VERSION,
        dry_run: bool = False,
        verify_after: bool = True,
    ) -> CorpusSeedResult | CorpusSeedPlan:
        manifest = load_corpus_manifest(manifest_path, archive_root=archive_root, require_lock=True)
        if version != manifest.runtime_version and version != DEFAULT_RUNTIME_VERSION:
            raise CorpusSeedError(f"Unsupported corpus version {version!r}")
        runtime = self._runtime_version(version)
        return self._seed_loaded_manifest(
            manifest=manifest,
            archive_root=archive_root,
            version=version,
            runtime=runtime,
            dry_run=dry_run,
            verify_after=verify_after,
            manifest_path=manifest_path,
        )

    def _seed_loaded_manifest(
        self,
        *,
        manifest: CorpusManifest,
        archive_root: Path,
        version: str,
        runtime: RuntimeVersion | None,
        dry_run: bool,
        verify_after: bool,
        manifest_path: Path | None = None,
    ) -> CorpusSeedResult | CorpusSeedPlan:
        if runtime is not None:
            self._refuse_active_runtime(runtime)
        reusable, enqueue = self._classify_seed_sources(manifest, runtime)
        plan = CorpusSeedPlan(
            version=version,
            source_ids=list(manifest.source_ids),
            filenames=[source.filename for source in manifest.sources],
            reusable_source_ids=[source.source_id for source in reusable],
            enqueue_source_ids=[source.source_id for source in enqueue],
            dry_run=dry_run,
        )
        if dry_run:
            return plan

        runtime = runtime or self._ensure_runtime_version(version, archive_bytes=b"default corpus runtime archive")
        batch_id: str | None = None
        enqueued_source_ids: list[str] = []
        if enqueue:
            queued = self._enqueue_sources(manifest=manifest, archive_root=archive_root, runtime=runtime, sources=enqueue)
            batch_id = queued.batch_id
            enqueued_source_ids = [source.source_id for source in enqueue]
            self._process_seed_jobs(runtime)
            self._normalize_seed_sources(manifest, runtime)
            self._refresh_batch_status(batch_id)
        verification = None
        if verify_after:
            if manifest_path is None:
                verification = self._verify_loaded_manifest(manifest=manifest, runtime=runtime)
            else:
                verification = self.verify(manifest_path=manifest_path, archive_root=archive_root, version=version)
        return CorpusSeedResult(
            version=version,
            batch_id=batch_id,
            reused_source_ids=[source.source_id for source in reusable],
            enqueued_source_ids=enqueued_source_ids,
            verification=verification,
        )

    def verify(self, *, manifest_path: Path, archive_root: Path, version: str = DEFAULT_RUNTIME_VERSION) -> dict[str, dict[str, int]]:
        manifest = load_corpus_manifest(manifest_path, archive_root=archive_root, require_lock=True)
        runtime = self._runtime_version(version)
        if runtime is None:
            raise CorpusSeedError(f"Runtime version {version!r} does not exist")
        return self._verify_loaded_manifest(manifest=manifest, runtime=runtime)

    def _verify_loaded_manifest(self, *, manifest: CorpusManifest, runtime: RuntimeVersion) -> dict[str, dict[str, int]]:
        actual = self._actual_counts_by_source(runtime)
        expected_ids = set(manifest.source_ids)
        extra_ids = set(actual) - expected_ids
        missing_ids = expected_ids - set(actual)
        if extra_ids:
            raise CorpusSeedError(f"Corpus contains unexpected source IDs: {', '.join(sorted(extra_ids))}")
        if missing_ids:
            raise CorpusSeedError(f"Corpus missing source IDs: {', '.join(sorted(missing_ids))}")
        for source in manifest.sources:
            row = self.db.get(Source, source.source_id)
            if row is None:
                raise CorpusSeedError(f"Source {source.source_id} is missing")
            if row.title != source.title:
                raise CorpusSeedError(f"Source {source.source_id} title mismatch")
            if row.filename != source.filename:
                raise CorpusSeedError(f"Source {source.source_id} filename mismatch")
            if row.metadata_json:
                metadata = _loads_json(row.metadata_json)
                if metadata.get("runtime_version") not in {runtime.label_slug, runtime.id, manifest.runtime_version}:
                    raise CorpusSeedError(f"Source {source.source_id} runtime metadata mismatch")
            expected = source.expected or {}
            for key in EXPECTED_COUNT_KEYS:
                if actual[source.source_id][key] != expected[key]:
                    raise CorpusSeedError(
                        f"Source {source.source_id} {key} mismatch: expected {expected[key]}, got {actual[source.source_id][key]}"
                    )
        totals = {key: sum(counts[key] for counts in actual.values()) for key in EXPECTED_COUNT_KEYS}
        for key in EXPECTED_COUNT_KEYS:
            if manifest.expected_totals is not None and totals[key] != manifest.expected_totals[key]:
                raise CorpusSeedError(f"Corpus total {key} mismatch: expected {manifest.expected_totals[key]}, got {totals[key]}")
        return actual

    def _runtime_version(self, version: str) -> RuntimeVersion | None:
        return self.db.scalars(
            select(RuntimeVersion).where(
                (RuntimeVersion.id == version) | (RuntimeVersion.label_slug == version) | (RuntimeVersion.display_label == version)
            )
        ).first()

    def _ensure_runtime_version(self, version: str, *, archive_bytes: bytes) -> RuntimeVersion:
        existing = self._runtime_version(version)
        if existing is not None:
            return existing
        lifecycle = VersionLifecycleService(db=self.db, settings=self.settings)
        runtime = lifecycle.create_version_namespaces(label=version, archive_bytes=archive_bytes, original_filename=f"{version}.zip").version
        runtime.status = "ready"
        self.db.flush()
        return runtime

    def _refuse_active_version_id(self, version: str) -> None:
        runtime = self._runtime_version(version)
        if runtime is not None:
            self._refuse_active_runtime(runtime)

    def _refuse_active_runtime(self, runtime: RuntimeVersion) -> None:
        pointer = self.db.get(ActiveVersionPointer, DEFAULT_ACTIVE_POINTER_NAME)
        if pointer is not None and pointer.runtime_version_id == runtime.id:
            raise CorpusSeedError("Active runtime version cannot be seeded")

    def _classify_seed_sources(
        self, manifest: CorpusManifest, runtime: RuntimeVersion | None
    ) -> tuple[list[CorpusSource], list[CorpusSource]]:
        reusable: list[CorpusSource] = []
        enqueue: list[CorpusSource] = []
        for source in manifest.sources:
            if runtime is not None and self._source_matches_lock(source, runtime):
                reusable.append(source)
            else:
                self._delete_source_runtime_rows(source.source_id)
                enqueue.append(source)
        self.db.flush()
        return reusable, enqueue

    def _source_matches_lock(self, source: CorpusSource, runtime: RuntimeVersion) -> bool:
        row = self.db.get(Source, source.source_id)
        if row is None or row.title != source.title or row.filename != source.filename:
            return False
        upload = self.db.get(Upload, row.upload_id)
        if upload is None or upload.sha256 != source.sha256:
            return False
        job = self.db.scalars(select(IngestionJob).where(IngestionJob.upload_id == upload.id)).first()
        if job is None or job.status != "completed":
            return False
        metadata = _loads_json(job.metadata_json)
        if metadata.get("runtime_version") not in {runtime.label_slug, runtime.id, DEFAULT_RUNTIME_VERSION}:
            return False
        expected = source.expected or {}
        actual = self._actual_counts_for_source(source.source_id, runtime)
        return all(actual[key] == expected[key] for key in EXPECTED_COUNT_KEYS)

    def _enqueue_sources(
        self,
        *,
        manifest: CorpusManifest,
        archive_root: Path,
        runtime: RuntimeVersion,
        sources: Sequence[CorpusSource],
    ):
        upload_dir = Path(self.settings.upload_dir)
        upload_dir.mkdir(parents=True, exist_ok=True)
        items = [
            _UploadBatchInput(filename=source.filename, content=(archive_root / source.filename).read_bytes(), content_type="application/zip")
            for source in sources
        ]
        queued = _queue_batch_uploads(db=self.db, settings=self.settings, upload_dir=upload_dir, items=items, now=utcnow())
        batch = self.db.get(UploadBatch, queued.batch_id)
        if batch is not None:
            batch.metadata_json = _to_json(
                {
                    "runtime_version": runtime.label_slug,
                    "runtime_version_id": runtime.id,
                    "corpus_version": manifest.runtime_version,
                    "source_ids": [source.source_id for source in sources],
                    "lock_sha256": {source.source_id: source.sha256 for source in manifest.sources},
                }
            )
        for index, source in enumerate(sources):
            upload = self.db.scalars(select(Upload).where(Upload.batch_id == queued.batch_id, Upload.batch_position == index)).one()
            job = self.db.scalars(select(IngestionJob).where(IngestionJob.upload_id == upload.id)).one()
            metadata = _loads_json(job.metadata_json)
            metadata.update(
                {
                    "source_id": source.source_id,
                    "source_type": "archived_webpage",
                    "runtime_version": runtime.label_slug,
                    "runtime_version_id": runtime.id,
                    "corpus_version": manifest.runtime_version,
                    "corpus_source_id": source.source_id,
                    "expected_sha256": source.sha256,
                    "qdrant_collection": runtime.qdrant_collection,
                }
            )
            job.metadata_json = _to_json(metadata)
        self.db.commit()
        return queued

    def _process_seed_jobs(self, runtime: RuntimeVersion) -> None:
        indexer = self.qdrant_indexer_factory(runtime.qdrant_collection) if self.qdrant_indexer_factory is not None else None
        while True:
            processed = process_next_job(self.db, embedding_client=self.embedding_client, qdrant_indexer=indexer, settings=self.settings)
            if processed is None:
                break
            if processed.status == "failed":
                raise CorpusSeedError(f"Seed ingestion job failed: {processed.error_summary or processed.id}")

    def _normalize_seed_sources(self, manifest: CorpusManifest, runtime: RuntimeVersion) -> None:
        for source in manifest.sources:
            row = self.db.get(Source, source.source_id)
            if row is None:
                continue
            row.title = source.title
            row.filename = source.filename
            metadata = _loads_json(row.metadata_json)
            metadata.update(
                {
                    "runtime_version": runtime.label_slug,
                    "runtime_version_id": runtime.id,
                    "corpus_version": manifest.runtime_version,
                    "corpus_source_id": source.source_id,
                    "expected_sha256": source.sha256,
                    "qdrant_collection": runtime.qdrant_collection,
                }
            )
            row.metadata_json = _to_json(metadata)
        self.db.commit()

    def _refresh_batch_status(self, batch_id: str) -> None:
        rows = self.db.scalars(select(IngestionJob).where(IngestionJob.batch_id == batch_id)).all()
        batch = self.db.get(UploadBatch, batch_id)
        if batch is None:
            return
        statuses = [job.status for job in rows]
        if statuses and all(status == "completed" for status in statuses):
            batch.status = "completed"
        elif any(status == "failed" for status in statuses) and any(status == "completed" for status in statuses):
            batch.status = "partial_failed"
        elif statuses and all(status == "failed" for status in statuses):
            batch.status = "failed"
        else:
            batch.status = "running"
        batch.updated_at = utcnow()
        self.db.commit()
        if batch.status == "partial_failed":
            raise CorpusSeedError("Seed batch finished partial_failed")

    def _actual_counts_by_source(self, runtime: RuntimeVersion) -> dict[str, dict[str, int]]:
        counts: dict[str, dict[str, int]] = {}
        for source_id in [row.id for row in self.db.scalars(select(Source)).all()]:
            source = self.db.get(Source, source_id)
            if source is None:
                continue
            metadata = _loads_json(source.metadata_json)
            if metadata.get("runtime_version") not in {runtime.label_slug, runtime.id, DEFAULT_RUNTIME_VERSION}:
                continue
            counts[source_id] = self._actual_counts_for_source(source_id, runtime)
        return counts

    def _actual_counts_for_source(self, source_id: str, runtime: RuntimeVersion) -> dict[str, int]:
        source = self.db.get(Source, source_id)
        if source is None:
            return _zero_counts()
        documents = self.db.scalars(select(Document).where(Document.source_id == source_id)).all()
        document_ids = [document.id for document in documents]
        sections = self.db.scalars(select(Section).where(Section.document_id.in_(document_ids))).all() if document_ids else []
        chunks = self.db.scalars(select(DocumentChunk).where(DocumentChunk.source_id == source_id)).all()
        chunk_ids = [chunk.id for chunk in chunks]
        indexed = (
            self.db.scalars(
                select(IndexedChunk).where(
                    IndexedChunk.document_chunk_id.in_(chunk_ids),
                    IndexedChunk.qdrant_collection == runtime.qdrant_collection,
                )
            ).all()
            if chunk_ids
            else []
        )
        jobs = self.db.scalars(select(IngestionJob).where(IngestionJob.upload_id == source.upload_id)).all()
        uploads = [self.db.get(Upload, source.upload_id)] if source.upload_id else []
        return {
            "uploads": len([upload for upload in uploads if upload is not None]),
            "jobs": len(jobs),
            "sources": 1,
            "documents": len(documents),
            "sections": len(sections),
            "chunks": len(chunks),
            "indexed_chunks": len(indexed),
        }

    def _delete_runtime_rows(self, runtime: RuntimeVersion) -> None:
        for source_id in list(self._actual_counts_by_source(runtime)):
            self._delete_source_runtime_rows(source_id)
        self.db.delete(runtime)
        self.db.flush()
        for prefix in (runtime.upload_prefix, runtime.static_prefix, runtime.runtime_prefix):
            path = Path(self.settings.upload_dir) / prefix
            if path.exists():
                shutil.rmtree(path, ignore_errors=True)

    def _delete_source_runtime_rows(self, source_id: str) -> None:
        source = self.db.get(Source, source_id)
        if source is None:
            return
        documents = self.db.scalars(select(Document).where(Document.source_id == source_id)).all()
        chunks = self.db.scalars(select(DocumentChunk).where(DocumentChunk.source_id == source_id)).all()
        jobs = self.db.scalars(select(IngestionJob).where(IngestionJob.upload_id == source.upload_id)).all()
        for chunk in chunks:
            for indexed in self.db.scalars(select(IndexedChunk).where(IndexedChunk.document_chunk_id == chunk.id)).all():
                self.db.delete(indexed)
            self.db.delete(chunk)
        for document in documents:
            for section in self.db.scalars(select(Section).where(Section.document_id == document.id)).all():
                self.db.delete(section)
            self.db.delete(document)
        self.db.delete(source)
        for job in jobs:
            self.db.delete(job)
        upload = self.db.get(Upload, source.upload_id)
        if upload is not None:
            batch_id = upload.batch_id
            self.db.delete(upload)
            if batch_id is not None:
                remaining = self.db.scalars(select(Upload).where(Upload.batch_id == batch_id)).first()
                batch = self.db.get(UploadBatch, batch_id)
                if remaining is None and batch is not None:
                    self.db.delete(batch)


def _lock_manifest_from_identity(manifest: CorpusManifest, archive_root: Path, actual: dict[str, dict[str, int]]) -> dict[str, object]:
    sources: list[dict[str, object]] = []
    for source in manifest.sources:
        archive_path = archive_root / source.filename
        expected = actual.get(source.source_id)
        if expected is None:
            raise CorpusSeedError(f"Lock generation missing counts for {source.source_id}")
        sources.append(
            {
                "source_id": source.source_id,
                "title": source.title,
                "filename": source.filename,
                "parser": source.parser,
                "sha256": hashlib.sha256(archive_path.read_bytes()).hexdigest(),
                "expected": dict(expected),
            }
        )
    totals: dict[str, int] = {}
    for key in EXPECTED_COUNT_KEYS:
        totals[key] = sum(int(source["expected"][key]) for source in sources if isinstance(source["expected"], dict))
    return {
        "schema_version": manifest.schema_version,
        "runtime_version": manifest.runtime_version,
        "sources": sources,
        "expected_totals": totals,
    }


def _zero_counts() -> dict[str, int]:
    return {key: 0 for key in EXPECTED_COUNT_KEYS}


def _loads_json(value: str) -> dict[str, object]:
    try:
        payload = json.loads(value or "{}")
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def _to_json(value: dict[str, object]) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def result_to_jsonable(value: object) -> object:
    if isinstance(value, CorpusSeedPlan | CorpusSeedResult | CorpusLockResult):
        return asdict(value)
    if isinstance(value, CorpusManifest):
        return {
            "schema_version": value.schema_version,
            "runtime_version": value.runtime_version,
            "sources": [asdict(source) for source in value.sources],
            "expected_totals": value.expected_totals,
        }
    if isinstance(value, CorpusManifestError):
        return str(value)
    return value
