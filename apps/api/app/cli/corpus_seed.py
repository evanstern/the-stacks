from __future__ import annotations

import argparse
import json
import inspect
import os
import sys
import tempfile
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

from fastapi.routing import APIRoute
from sqlalchemy import create_engine, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from ..config import Settings, get_settings
from ..corpus_manifest import DEFAULT_RUNTIME_VERSION, CorpusManifestError
from ..corpus_reset import CorpusResetError, CorpusResetService
from ..corpus_seed import CorpusSeedError, CorpusSeedService, result_to_jsonable
from ..database import Base, SessionLocal
from ..version_lifecycle import VersionLifecycleService

PREREQUISITE_PLAN = ".omo/plans/multi-zip-dndbeyond-upload-queue.md"
DEFAULT_DOCKER_DATABASE_URL = "postgresql+psycopg://thestacks:thestacks@postgres:5432/thestacks"
LOCAL_DRY_RUN_VERSION_ID = "44444444-4444-4444-8444-444444444444"
DEFAULT_IDENTITY_MANIFEST = Path("apps/api/corpus/default-dndbeyond-corpus.json")
DEFAULT_LOCK_MANIFEST = Path("../.omo/corpus/default-dndbeyond-corpus.lock.json")


@dataclass(frozen=True)
class PreflightResult:
    name: str
    detail: str


@dataclass(frozen=True)
class PreflightFailure:
    name: str
    error: str


class PreflightError(RuntimeError):
    def __init__(self, failures: Sequence[PreflightFailure]) -> None:
        self.failures: list[PreflightFailure] = list(failures)
        missing = "; ".join(f"{failure.name}: {failure.error}" for failure in self.failures)
        super().__init__(f"Corpus seed prerequisites missing ({PREREQUISITE_PLAN}): {missing}")


@dataclass(frozen=True)
class PreflightCheck:
    name: str
    run: Callable[[], str]


@dataclass(frozen=True)
class ResetCommandSession:
    db: Any
    settings: Settings
    temp_dir: TemporaryDirectory[str] | None = None

    def close(self) -> None:
        self.db.close()
        if self.temp_dir is not None:
            self.temp_dir.cleanup()


def _check_upload_batches() -> str:
    from ..models import IngestionJob, Upload, UploadBatch
    from ..routes_uploads import create_upload, read_upload_batch, router
    from ..schemas import UploadBatchQueued, UploadBatchStatusRead, UploadBatchStatusSummary

    upload_columns = Upload.__table__.columns
    job_columns = IngestionJob.__table__.columns
    batch_columns = UploadBatch.__table__.columns
    for column_name in ("id", "status", "file_count", "metadata_json"):
        if column_name not in batch_columns:
            raise RuntimeError(f"UploadBatch.{column_name} is not mapped")
    for column_name in ("batch_id", "batch_position"):
        if column_name not in upload_columns:
            raise RuntimeError(f"Upload.{column_name} is not mapped")
    if "batch_id" not in job_columns:
        raise RuntimeError("IngestionJob.batch_id is not mapped")

    create_signature = inspect.signature(create_upload)
    file_parameter = create_signature.parameters.get("file")
    file_annotation_source: object = "" if file_parameter is None else file_parameter.annotation
    file_annotation = str(file_annotation_source)
    if file_parameter is None or "list" not in file_annotation:
        raise RuntimeError("create_upload does not accept repeated multipart file fields")

    route_paths = {
        (route.path, tuple(sorted(route.methods or set())))
        for route in router.routes
        if isinstance(route, APIRoute)
    }
    if not any(path.endswith("/batches/{batch_id}") and "GET" in methods for path, methods in route_paths):
        raise RuntimeError("GET /uploads/batches/{batch_id} route is missing")
    if inspect.signature(read_upload_batch).parameters.get("batch_id") is None:
        raise RuntimeError("read_upload_batch cannot address a batch_id")

    _ = UploadBatchQueued(batch_id="batch", status="queued", items=[], queued=True, upload_status_url="/upload?batch_id=batch")
    _ = UploadBatchStatusRead(
        batch_id="batch",
        status="queued",
        file_count=0,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        items=[],
        summary=UploadBatchStatusSummary(queued=0, running=0, completed=0, partial_failed=0, failed=0, total=0),
        upload_status_url="/upload?batch_id=batch",
    )
    return "upload batches, repeated file upload, and batch status route are importable"


def _check_ingestion_status_primitives() -> str:
    from ..ingestion import FAILURE_CATEGORIES, FAILURE_METADATA_KEY
    from ..models import IngestionEvent
    from ..routes_uploads import _aggregate_batch_status, _status_summary
    from ..schemas import UploadBatchChildError

    if "invalid_zip" not in FAILURE_CATEGORIES or "ddb_parse_error" not in FAILURE_CATEGORIES:
        raise RuntimeError("per-file ingestion failure categories are incomplete")
    if FAILURE_METADATA_KEY != "failure":
        raise RuntimeError("structured failure metadata key changed")
    if _aggregate_batch_status(["completed", "failed"]) != "partial_failed":
        raise RuntimeError("batch aggregate status does not preserve partial failure")
    summary = _status_summary(["queued", "processing", "completed", "failed"])
    if summary.total != 4 or summary.partial_failed != 1:
        raise RuntimeError("batch status summary is not file-scoped")
    _ = UploadBatchChildError(filename="bad.zip", category="invalid_zip", message="Invalid archive")
    if IngestionEvent.__table__.columns.get("batch_id") is None:
        raise RuntimeError("ingestion events are not batch-aware")
    return "per-file ingestion status and safe failure reporting are importable"


def _check_archive_storage_primitives() -> str:
    from ..archive_storage import ARCHIVE_SOURCE_TYPE, StoredArchive, archive_served_html_path, store_source_archive
    from ..models import ImmutableSourceArchive, RuntimeVersion
    from ..version_lifecycle import ensure_immutable_source_archive, store_immutable_source_archive

    if ARCHIVE_SOURCE_TYPE != "archived_webpage":
        raise RuntimeError("archive source type changed")
    if not callable(store_source_archive) or not callable(archive_served_html_path):
        raise RuntimeError("source archive storage helpers are not callable")
    for attribute_name in ("original_zip_path", "manifest_path", "served_html_path", "anchor_map_path"):
        if attribute_name not in StoredArchive.__dataclass_fields__:
            raise RuntimeError(f"StoredArchive.{attribute_name} is missing")
    if ImmutableSourceArchive.__table__.columns.get("content_hash") is None:
        raise RuntimeError("ImmutableSourceArchive content hash primary key is missing")
    if RuntimeVersion.__table__.columns.get("source_archive_hash") is None:
        raise RuntimeError("RuntimeVersion is not linked to immutable archives")
    if ensure_immutable_source_archive is not store_immutable_source_archive:
        raise RuntimeError("immutable archive compatibility alias is missing")
    return "immutable archive storage and metadata primitives are importable"


def _check_runtime_lifecycle_primitives() -> str:
    from ..config import Settings
    from ..database import Base
    from ..models import ActiveVersionPointer, RuntimeVersion, TeardownStep, VersionLifecycleEvent
    from ..version_lifecycle import DEFAULT_ACTIVE_POINTER_NAME, TEARDOWN_STEP_ORDER, VersionLifecycleService

    required_steps = {
        "cleanup_uploads",
        "cleanup_static",
        "cleanup_runtime",
        "delete_qdrant_collection",
        "drop_version_database",
        "finalize_state",
    }
    if not required_steps.issubset(set(TEARDOWN_STEP_ORDER)):
        raise RuntimeError("teardown order lacks version-scoped reset steps")

    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    Base.metadata.create_all(bind=engine)
    with tempfile.TemporaryDirectory() as temp_dir:
        settings = Settings(
            DATABASE_URL="postgresql+psycopg://thestacks:thestacks@postgres:5432/thestacks",
            UPLOAD_DIR=str(Path(temp_dir) / "uploads"),
            QDRANT_COLLECTION="preflight_chunks",
        )
        db = SessionLocal()
        try:
            service = VersionLifecycleService(db=db, settings=settings)
            inactive = service.create_version_namespaces(
                version_id="10000000-0000-4000-8000-000000000001",
                label="Preflight inactive runtime",
                archive_bytes=b"inactive preflight archive",
                original_filename="inactive.zip",
            )
            active = service.create_version_namespaces(
                version_id="20000000-0000-4000-8000-000000000002",
                label="Preflight active runtime",
                archive_bytes=b"active preflight archive",
                original_filename="active.zip",
            )
            inactive.version.status = "ready"
            active.version.status = "ready"
            db.flush()

            manifest = service.plan_teardown(inactive.version.id)
            if manifest.dry_run is not True or not manifest.retained_archive.get("content_hash"):
                raise RuntimeError("dry-run teardown manifest does not retain immutable archive")
            steps = db.scalars(select(TeardownStep).where(TeardownStep.runtime_version_id == inactive.version.id)).all()
            if [step.step_type for step in steps] != list(TEARDOWN_STEP_ORDER):
                raise RuntimeError("dry-run teardown did not persist resumable steps")

            context = service.activate_runtime_version(active.version.id)
            pointer = db.get(ActiveVersionPointer, DEFAULT_ACTIVE_POINTER_NAME)
            if pointer is None or pointer.runtime_version_id != active.version.id:
                raise RuntimeError("active runtime pointer was not persisted")
            if context.qdrant_collection == settings.qdrant_collection:
                raise RuntimeError("active runtime context did not switch to a version-scoped Qdrant collection")
            try:
                _ = service.teardown_runtime_version(active.version.id, confirm=True)
            except ValueError as exc:
                if "Active runtime version" not in str(exc):
                    raise RuntimeError("active-version refusal returned an unclear error") from exc
            else:
                raise RuntimeError("active runtime version teardown was not refused")

            if db.get(RuntimeVersion, active.version.id) is None:
                raise RuntimeError("RuntimeVersion row disappeared during preflight")
            lifecycle_events = db.scalars(select(VersionLifecycleEvent)).all()
            if not lifecycle_events:
                raise RuntimeError("runtime lifecycle events were not recorded")
        finally:
            db.close()
    return "runtime versions, active pointer, dry-run teardown, and active refusal are usable"


def _check_version_scoped_indexing_primitives() -> str:
    from ..config import Settings
    from ..models import IndexedChunk
    from ..qdrant_index import HttpQdrantIndexer, QdrantIndexer, QdrantPoint, get_qdrant_indexer
    from ..version_lifecycle import derive_version_namespaces

    settings = Settings(QDRANT_COLLECTION="preflight_chunks")
    namespaces = derive_version_namespaces(version_id="30000000-0000-4000-8000-000000000003", settings=settings)
    if namespaces.qdrant_collection == settings.qdrant_collection:
        raise RuntimeError("derive_version_namespaces does not create a version-scoped Qdrant collection")
    for prefix in (namespaces.upload_prefix, namespaces.static_prefix, namespaces.runtime_prefix):
        if not prefix.startswith("versions/"):
            raise RuntimeError("derived reset namespace is not version-scoped")
    if IndexedChunk.__table__.columns.get("qdrant_collection") is None:
        raise RuntimeError("IndexedChunk does not record Qdrant collection context")
    if not hasattr(QdrantIndexer, "ensure_collection") or not hasattr(QdrantIndexer, "upsert_points"):
        raise RuntimeError("Qdrant indexer interface is incomplete")
    indexer = get_qdrant_indexer(settings)
    if not isinstance(indexer, HttpQdrantIndexer) or indexer.collection != settings.qdrant_collection:
        raise RuntimeError("Qdrant indexer cannot be bound to an explicit collection")
    _ = QdrantPoint(id="point", vector=[0.0], payload={"runtime_version_id": namespaces.version_id})
    return "version-scoped namespaces and indexed chunk collection context are usable"


PREFLIGHT_CHECKS: tuple[PreflightCheck, ...] = (
    PreflightCheck("upload batches and repeated-file upload/status", _check_upload_batches),
    PreflightCheck("file-scoped ingestion lifecycle status", _check_ingestion_status_primitives),
    PreflightCheck("immutable archive storage", _check_archive_storage_primitives),
    PreflightCheck("runtime lifecycle dry-run and active-version safety", _check_runtime_lifecycle_primitives),
    PreflightCheck("version-scoped indexing/reset support", _check_version_scoped_indexing_primitives),
)


def run_preflight(checks: Sequence[PreflightCheck] = PREFLIGHT_CHECKS) -> list[PreflightResult]:
    results: list[PreflightResult] = []
    failures: list[PreflightFailure] = []
    for check in checks:
        try:
            results.append(PreflightResult(name=check.name, detail=check.run()))
        except Exception as exc:
            failures.append(PreflightFailure(name=check.name, error=str(exc)))
    if failures:
        raise PreflightError(failures)
    return results


def _run_preflight_command() -> int:
    try:
        results = run_preflight()
    except PreflightError as exc:
        print(str(exc), file=sys.stderr)
        for failure in exc.failures:
            print(f"ERROR {failure.name}: {failure.error}", file=sys.stderr)
        return 1
    for result in results:
        print(f"OK {result.name}: {result.detail}")
    return 0


def _run_reset_command(args: argparse.Namespace) -> int:
    if not args.dry_run and args.confirm_version is None:
        print(f"--confirm-version {args.version} required", file=sys.stderr)
        return 1
    settings = get_settings()
    reset_session = _open_reset_command_session(args=args, settings=settings)
    db = reset_session.db
    try:
        service = CorpusResetService(db=db, settings=reset_session.settings)
        result = service.reset(
            version=args.version,
            confirm_version=args.confirm_version,
            dry_run=args.dry_run,
        )
        if args.confirm_version is not None and not args.dry_run:
            db.commit()
        else:
            db.rollback()
    except CorpusResetError as exc:
        db.rollback()
        print(str(exc), file=sys.stderr)
        return 1
    except SQLAlchemyError as exc:
        db.rollback()
        print(f"Corpus reset database error: {exc}", file=sys.stderr)
        return 1
    finally:
        reset_session.close()
    print(
        json.dumps(
            {
                "archive_sha_before": result.archive_sha_before,
                "archive_sha_after": result.archive_sha_after,
                "deleted": result.deleted.__dict__,
                "manifest": result.manifest.__dict__
                | {
                    "counts": result.manifest.counts.__dict__,
                },
            },
            indent=2,
            sort_keys=True,
        )
    )
    return 0


def _run_lock_command(args: argparse.Namespace) -> int:
    settings = get_settings()
    db = SessionLocal()
    try:
        service = CorpusSeedService(db=db, settings=settings)
        result = service.lock(
            identity_manifest_path=args.identity_manifest,
            archive_root=args.archive_root,
            output_path=args.output,
            temp_version=args.temp_version,
        )
        db.commit()
    except (CorpusSeedError, CorpusManifestError, SQLAlchemyError) as exc:
        db.rollback()
        print(str(exc), file=sys.stderr)
        return 1
    finally:
        db.close()
    print(json.dumps(result_to_jsonable(result), indent=2, sort_keys=True))
    return 0


def _run_seed_command(args: argparse.Namespace) -> int:
    settings = get_settings()
    seed_session = _open_seed_command_session(args=args, settings=settings)
    db = seed_session.db
    try:
        service = CorpusSeedService(db=db, settings=seed_session.settings)
        result = service.seed(
            manifest_path=args.manifest,
            archive_root=args.archive_root,
            version=args.version,
            dry_run=args.dry_run,
            verify_after=not args.no_wait,
        )
        if args.dry_run:
            db.rollback()
        else:
            db.commit()
    except (CorpusSeedError, CorpusManifestError, SQLAlchemyError) as exc:
        db.rollback()
        print(str(exc), file=sys.stderr)
        return 1
    finally:
        seed_session.close()
    print(json.dumps(result_to_jsonable(result), indent=2, sort_keys=True))
    return 0


def _run_verify_command(args: argparse.Namespace) -> int:
    settings = get_settings()
    if args.lock_only:
        try:
            with _local_verify_session(settings) as reset_session:
                service = CorpusSeedService(db=reset_session.db, settings=reset_session.settings)
                result = service.verify_lock_only(manifest_path=args.manifest, archive_root=args.archive_root)
        except (CorpusSeedError, CorpusManifestError, SQLAlchemyError) as exc:
            print(str(exc), file=sys.stderr)
            return 1
        print(json.dumps(result_to_jsonable(result), indent=2, sort_keys=True))
        return 0

    db = SessionLocal()
    try:
        service = CorpusSeedService(db=db, settings=settings)
        result = service.verify(manifest_path=args.manifest, archive_root=args.archive_root, version=args.version)
        db.rollback()
    except (CorpusSeedError, CorpusManifestError, SQLAlchemyError) as exc:
        db.rollback()
        print(str(exc), file=sys.stderr)
        return 1
    finally:
        db.close()
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


def _open_reset_command_session(*, args: argparse.Namespace, settings: Settings) -> ResetCommandSession:
    if _should_use_local_dry_run_database(args=args, settings=settings):
        temp_dir = TemporaryDirectory(prefix="corpus-reset-dry-run-")
        local_settings = Settings(
            DATABASE_URL="sqlite+pysqlite:///:memory:",
            UPLOAD_DIR=str(Path(temp_dir.name) / "uploads"),
            QDRANT_COLLECTION=settings.qdrant_collection,
        )
        engine = create_engine(
            local_settings.database_url,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        LocalSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
        Base.metadata.create_all(bind=engine)
        db = LocalSession()
        lifecycle = VersionLifecycleService(db=db, settings=local_settings)
        runtime = lifecycle.create_version_namespaces(
            version_id=LOCAL_DRY_RUN_VERSION_ID,
            label=args.version,
            archive_bytes=b"local corpus reset dry-run archive placeholder",
            original_filename=f"{args.version}-dry-run.zip",
        ).version
        runtime.status = "ready"
        db.flush()
        return ResetCommandSession(db=db, settings=local_settings, temp_dir=temp_dir)
    return ResetCommandSession(db=SessionLocal(), settings=settings)


def _open_seed_command_session(*, args: argparse.Namespace, settings: Settings) -> ResetCommandSession:
    if _should_use_local_seed_dry_run_database(args=args, settings=settings):
        temp_dir = TemporaryDirectory(prefix="corpus-seed-dry-run-")
        local_settings = Settings(
            DATABASE_URL="sqlite+pysqlite:///:memory:",
            UPLOAD_DIR=str(Path(temp_dir.name) / "uploads"),
            QDRANT_COLLECTION=settings.qdrant_collection,
        )
        engine = create_engine(
            local_settings.database_url,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        LocalSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
        Base.metadata.create_all(bind=engine)
        return ResetCommandSession(db=LocalSession(), settings=local_settings, temp_dir=temp_dir)
    return ResetCommandSession(db=SessionLocal(), settings=settings)


class _local_verify_session:
    def __init__(self, settings: Settings) -> None:
        self._temp_dir = TemporaryDirectory(prefix="corpus-verify-lock-")
        self.settings = Settings(
            DATABASE_URL="sqlite+pysqlite:///:memory:",
            UPLOAD_DIR=str(Path(self._temp_dir.name) / "uploads"),
            QDRANT_COLLECTION=settings.qdrant_collection,
        )
        self._engine = create_engine(
            self.settings.database_url,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        LocalSession = sessionmaker(bind=self._engine, autoflush=False, expire_on_commit=False)
        Base.metadata.create_all(bind=self._engine)
        self.db = LocalSession()

    def __enter__(self) -> _local_verify_session:
        return self

    def __exit__(self, exc_type: object, exc: object, traceback: object) -> None:
        self.db.close()
        self._temp_dir.cleanup()


def _should_use_local_dry_run_database(*, args: argparse.Namespace, settings: Settings) -> bool:
    return (
        args.dry_run
        and args.confirm_version is None
        and os.environ.get("DATABASE_URL") is None
        and settings.database_url == DEFAULT_DOCKER_DATABASE_URL
    )


def _should_use_local_seed_dry_run_database(*, args: argparse.Namespace, settings: Settings) -> bool:
    return args.dry_run and (
        (os.environ.get("DATABASE_URL") is None and settings.database_url == DEFAULT_DOCKER_DATABASE_URL)
        or settings.database_url == "sqlite+pysqlite:///:memory:"
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m app.cli.corpus_seed", description="Default DnDBeyond corpus seed maintenance CLI.")
    subcommands = parser.add_subparsers(dest="command", required=True)
    _ = subcommands.add_parser("preflight", help="validate upstream multi-ZIP/runtime lifecycle prerequisites")
    lock_parser = subcommands.add_parser("lock", help="generate a default corpus lock manifest from local archives")
    _ = lock_parser.add_argument("--identity-manifest", type=Path, default=DEFAULT_IDENTITY_MANIFEST)
    _ = lock_parser.add_argument("--archive-root", type=Path, required=True)
    _ = lock_parser.add_argument("--output", type=Path, default=DEFAULT_LOCK_MANIFEST)
    _ = lock_parser.add_argument("--temp-version", default=None)
    seed_parser = subcommands.add_parser("seed", help="seed default corpus runtime from a lock manifest")
    _ = seed_parser.add_argument("--manifest", type=Path, default=DEFAULT_LOCK_MANIFEST)
    _ = seed_parser.add_argument("--archive-root", type=Path, required=True)
    _ = seed_parser.add_argument("--version", default=DEFAULT_RUNTIME_VERSION)
    _ = seed_parser.add_argument("--dry-run", action="store_true")
    _ = seed_parser.add_argument("--no-wait", action="store_true", help="enqueue without waiting for worker completion")
    reset_parser = subcommands.add_parser("reset", help="dry-run or confirm runtime-only default corpus reset")
    _ = reset_parser.add_argument("--version", default=DEFAULT_RUNTIME_VERSION, help="corpus runtime version to reset")
    _ = reset_parser.add_argument("--dry-run", action="store_true", help="print reset manifest without mutation")
    _ = reset_parser.add_argument("--confirm-version", default=None, help="required exact version confirmation for mutation")
    verify_parser = subcommands.add_parser("verify", help="verify default corpus runtime or lock manifest")
    _ = verify_parser.add_argument("--manifest", type=Path, default=DEFAULT_LOCK_MANIFEST)
    _ = verify_parser.add_argument("--archive-root", type=Path, required=True)
    _ = verify_parser.add_argument("--version", default=DEFAULT_RUNTIME_VERSION)
    _ = verify_parser.add_argument("--lock-only", action="store_true", help="validate lock manifest and archive bytes without DB mutation")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.command == "preflight":
        return _run_preflight_command()
    if args.command == "lock":
        return _run_lock_command(args)
    if args.command == "seed":
        return _run_seed_command(args)
    if args.command == "reset":
        return _run_reset_command(args)
    if args.command == "verify":
        return _run_verify_command(args)
    parser.error(f"unknown command {args.command}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
