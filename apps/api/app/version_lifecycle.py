import hashlib
import json
import os
import re
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import ActiveVersionPointer, ImmutableSourceArchive, RuntimeVersion, TeardownStep, VersionLifecycleEvent, utcnow


VERSION_STATUS_DRAFT = "draft"
VERSION_STATUS_READY = "ready"
VERSION_EVENT_CREATED = "created"
VERSION_EVENT_ACTIVATED = "activated"
VERSION_EVENT_TEARDOWN_COMPLETED = "teardown_completed"
VERSION_EVENT_TEARDOWN_DRY_RUN = "teardown_dry_run"
VERSION_EVENT_TEARDOWN_FAILED = "teardown_failed"
VERSION_EVENT_TEARDOWN_STARTED = "teardown_started"
VERSION_EVENT_TEARDOWN_STEP_COMPLETED = "teardown_step_completed"
VERSION_EVENT_TEARDOWN_STEP_STARTED = "teardown_step_started"
VERSION_NAMESPACE_PREFIX = "tsv"
ARCHIVE_ROOT_NAME = "source-archives"
DEFAULT_ACTIVE_POINTER_NAME = "default"
TEARDOWN_LOCKED_STATUSES = frozenset({"pending", "running"})
VERSION_STATUS_TEARDOWN_FAILED = "teardown_failed"
VERSION_STATUS_TORN_DOWN = "torn_down"


TEARDOWN_STEP_ORDER = (
    "unpublish",
    "purge_cache",
    "cleanup_uploads",
    "cleanup_static",
    "cleanup_runtime",
    "delete_qdrant_collection",
    "drop_version_database",
    "finalize_state",
)


@dataclass(frozen=True)
class VersionNamespaces:
    version_id: str
    database_name: str
    database_url: str
    qdrant_collection: str
    upload_prefix: str
    static_prefix: str
    runtime_prefix: str
    storage_prefix: str


@dataclass(frozen=True)
class ImmutableArchiveReference:
    content_hash: str
    storage_path: str
    size_bytes: int
    original_filename: str | None
    reused: bool


@dataclass(frozen=True)
class RuntimeVersionBuild:
    version: RuntimeVersion
    namespaces: VersionNamespaces
    archive: ImmutableArchiveReference


@dataclass(frozen=True)
class RuntimeVersionContext:
    version_id: str
    database_url: str
    qdrant_collection: str
    upload_prefix: str
    static_prefix: str
    runtime_prefix: str


@dataclass(frozen=True)
class TeardownManifest:
    version_id: str
    database_name: str
    database_url: str
    qdrant_collection: str
    derived_paths: dict[str, str]
    cache_actions: list[str]
    unpublish_actions: list[str]
    retained_archive: dict[str, str | int | None]
    steps: list[str]
    dry_run: bool


@dataclass(frozen=True)
class TeardownResult:
    version: RuntimeVersion
    manifest: TeardownManifest
    completed_steps: list[str]
    skipped_steps: list[str]


class VersionTeardownBackend:
    def unpublish(self, version: RuntimeVersion, manifest: TeardownManifest) -> None:
        _ = (version, manifest)

    def purge_cache(self, version: RuntimeVersion, manifest: TeardownManifest) -> None:
        _ = (version, manifest)

    def cleanup_uploads(self, version: RuntimeVersion, manifest: TeardownManifest) -> None:
        _ = (version, manifest)

    def cleanup_static(self, version: RuntimeVersion, manifest: TeardownManifest) -> None:
        _ = (version, manifest)

    def cleanup_runtime(self, version: RuntimeVersion, manifest: TeardownManifest) -> None:
        _ = (version, manifest)

    def delete_qdrant_collection(self, version: RuntimeVersion, manifest: TeardownManifest) -> None:
        _ = (version, manifest)

    def drop_version_database(self, version: RuntimeVersion, manifest: TeardownManifest) -> None:
        _ = (version, manifest)


def derive_version_namespaces(
    *,
    version_id: str,
    settings: Settings,
    database_url: str | None = None,
) -> VersionNamespaces:
    token = _namespace_token(version_id)
    database_name = f"{VERSION_NAMESPACE_PREFIX}_{token}"[:63]
    base_database_url = database_url or settings.database_url
    return VersionNamespaces(
        version_id=version_id,
        database_name=database_name,
        database_url=_replace_database_name(base_database_url, database_name),
        qdrant_collection=f"{settings.qdrant_collection}_{token}",
        upload_prefix=f"versions/{token}/uploads",
        static_prefix=f"versions/{token}/static",
        runtime_prefix=f"versions/{token}/runtime",
        storage_prefix=f"versions/{token}",
    )


def namespace_for_version(version_id: str, settings: Settings) -> VersionNamespaces:
    return derive_version_namespaces(version_id=version_id, settings=settings)


def store_immutable_source_archive(
    *,
    db: Session | None = None,
    settings: Settings,
    content: bytes,
    original_filename: str | None = None,
) -> ImmutableArchiveReference:
    content_hash = hashlib.sha256(content).hexdigest()
    archive_root = _archive_root(settings, content_hash)
    archive_path = archive_root / "source.zip"
    reused = archive_path.exists()

    if not reused:
        archive_root.mkdir(parents=True, exist_ok=True)
        fd, temp_name = tempfile.mkstemp(prefix="source-", suffix=".zip", dir=archive_root)
        try:
            with os.fdopen(fd, "wb") as temp_file:
                _ = temp_file.write(content)
            _ = os.replace(temp_name, archive_path)
        except Exception:
            try:
                os.unlink(temp_name)
            except FileNotFoundError:
                pass
            raise

    reference = ImmutableArchiveReference(
        content_hash=content_hash,
        storage_path=str(archive_path),
        size_bytes=len(content),
        original_filename=original_filename,
        reused=reused,
    )
    if db is not None:
        existing = db.get(ImmutableSourceArchive, content_hash)
        if existing is None:
            db.add(
                ImmutableSourceArchive(
                    content_hash=content_hash,
                    storage_path=str(archive_path),
                    original_filename=original_filename,
                    size_bytes=len(content),
                    metadata_json=json.dumps({"archive_root": str(archive_root)}, sort_keys=True, separators=(",", ":")),
                    created_at=utcnow(),
                )
            )
            db.flush()
    return reference


def create_version_namespaces(
    *,
    db: Session | None = None,
    settings: Settings,
    label: str | None = None,
    display_label: str | None = None,
    source_archive_bytes: bytes | None = None,
    archive_bytes: bytes | None = None,
    original_filename: str | None = None,
    version_id: str | None = None,
) -> RuntimeVersionBuild:
    internal_version_id = version_id or str(uuid4())
    namespaces = derive_version_namespaces(version_id=internal_version_id, settings=settings)
    archive_content = source_archive_bytes if source_archive_bytes is not None else archive_bytes
    if archive_content is None:
        archive_content = b""
    archive = store_immutable_source_archive(
        db=db,
        settings=settings,
        content=archive_content,
        original_filename=original_filename,
    )

    version_label = display_label if display_label is not None else label
    version = RuntimeVersion(
        id=internal_version_id,
        display_label=version_label,
        label_slug=_slug_label(version_label),
        status=VERSION_STATUS_DRAFT,
        database_name=namespaces.database_name,
        database_url=namespaces.database_url,
        qdrant_collection=namespaces.qdrant_collection,
        upload_prefix=namespaces.upload_prefix,
        static_prefix=namespaces.static_prefix,
        runtime_prefix=namespaces.runtime_prefix,
        source_archive_hash=archive.content_hash,
        metadata_json=json.dumps(
            {
                "label_slug": _slug_label(version_label),
                "namespaces": asdict(namespaces),
                "source_archive_hash": archive.content_hash,
            },
            sort_keys=True,
            separators=(",", ":"),
        ),
        created_at=utcnow(),
        updated_at=utcnow(),
    )
    if db is not None:
        db.add(version)
        db.add(
            VersionLifecycleEvent(
                runtime_version_id=internal_version_id,
                event_type=VERSION_EVENT_CREATED,
                message="Runtime version namespaces created",
                metadata_json=json.dumps({"namespaces": asdict(namespaces)}, sort_keys=True, separators=(",", ":")),
                created_at=utcnow(),
            )
        )
        db.flush()
    return RuntimeVersionBuild(version=version, namespaces=namespaces, archive=archive)


def activate_runtime_version(
    *,
    db: Session,
    runtime_version_id: str,
    pointer_name: str = DEFAULT_ACTIVE_POINTER_NAME,
) -> RuntimeVersionContext:
    version = db.get(RuntimeVersion, runtime_version_id)
    if version is None:
        raise ValueError("Runtime version does not exist")
    if version.status != VERSION_STATUS_READY:
        raise ValueError("Only ready runtime versions can be activated")
    if _is_teardown_locked(db, runtime_version_id):
        raise ValueError("Runtime version is teardown-locked and cannot be activated")

    pointer = db.get(ActiveVersionPointer, pointer_name)
    previous_runtime_version_id = pointer.runtime_version_id if pointer is not None else None
    now = utcnow()
    metadata = {
        "previous_runtime_version_id": previous_runtime_version_id,
        "runtime_version_id": runtime_version_id,
    }
    if pointer is None:
        pointer = ActiveVersionPointer(
            name=pointer_name,
            runtime_version_id=runtime_version_id,
            metadata_json=json.dumps(metadata, sort_keys=True, separators=(",", ":")),
            updated_at=now,
        )
        db.add(pointer)
    else:
        pointer.runtime_version_id = runtime_version_id
        pointer.metadata_json = json.dumps(metadata, sort_keys=True, separators=(",", ":"))
        pointer.updated_at = now
    db.add(
        VersionLifecycleEvent(
            runtime_version_id=runtime_version_id,
            event_type=VERSION_EVENT_ACTIVATED,
            message="Runtime version activated",
            metadata_json=json.dumps({"pointer_name": pointer_name, **metadata}, sort_keys=True, separators=(",", ":")),
            created_at=now,
        )
    )
    db.flush()
    return _context_from_version(version)


def resolve_runtime_context(
    *,
    db: Session,
    pointer_name: str = DEFAULT_ACTIVE_POINTER_NAME,
    runtime_version_id: str | None = None,
) -> RuntimeVersionContext:
    if runtime_version_id is None:
        pointer = db.get(ActiveVersionPointer, pointer_name)
        if pointer is None:
            raise ValueError("Active runtime version pointer is not configured")
        runtime_version_id = pointer.runtime_version_id
    version = db.get(RuntimeVersion, runtime_version_id)
    if version is None:
        raise ValueError("Runtime version does not exist")
    return _context_from_version(version)


create_runtime_version = create_version_namespaces
ensure_immutable_source_archive = store_immutable_source_archive


class VersionLifecycleService:
    def __init__(self, *, db: Session | None = None, settings: Settings, teardown_backend: VersionTeardownBackend | None = None) -> None:
        self.db = db
        self.settings = settings
        self.teardown_backend = teardown_backend or VersionTeardownBackend()

    def derive_namespaces(self, version_id: str) -> VersionNamespaces:
        return derive_version_namespaces(version_id=version_id, settings=self.settings)

    def store_immutable_source_archive(self, content: bytes, original_filename: str | None = None) -> ImmutableArchiveReference:
        return store_immutable_source_archive(
            db=self.db,
            settings=self.settings,
            content=content,
            original_filename=original_filename,
        )

    def create_version_namespaces(
        self,
        *,
        label: str | None = None,
        display_label: str | None = None,
        source_archive_bytes: bytes | None = None,
        archive_bytes: bytes | None = None,
        original_filename: str | None = None,
        version_id: str | None = None,
    ) -> RuntimeVersionBuild:
        return create_version_namespaces(
            db=self.db,
            settings=self.settings,
            label=label,
            display_label=display_label,
            source_archive_bytes=source_archive_bytes,
            archive_bytes=archive_bytes,
            original_filename=original_filename,
            version_id=version_id,
        )

    def activate_runtime_version(
        self,
        runtime_version_id: str,
        pointer_name: str = DEFAULT_ACTIVE_POINTER_NAME,
    ) -> RuntimeVersionContext:
        if self.db is None:
            raise ValueError("Database session is required to activate a runtime version")
        return activate_runtime_version(db=self.db, runtime_version_id=runtime_version_id, pointer_name=pointer_name)

    def resolve_runtime_context(
        self,
        pointer_name: str = DEFAULT_ACTIVE_POINTER_NAME,
        runtime_version_id: str | None = None,
    ) -> RuntimeVersionContext:
        if self.db is None:
            raise ValueError("Database session is required to resolve runtime context")
        return resolve_runtime_context(db=self.db, pointer_name=pointer_name, runtime_version_id=runtime_version_id)

    def plan_teardown(self, runtime_version_id: str) -> TeardownManifest:
        if self.db is None:
            raise ValueError("Database session is required to plan teardown")
        version = _get_runtime_version(self.db, runtime_version_id)
        _refuse_active_version(self.db, runtime_version_id)
        manifest = _teardown_manifest(db=self.db, version=version)
        _ = _ensure_teardown_steps(db=self.db, version=version, manifest=manifest)
        _record_lifecycle_event(
            db=self.db,
            runtime_version_id=runtime_version_id,
            event_type=VERSION_EVENT_TEARDOWN_DRY_RUN,
            message="Runtime version teardown dry-run manifest generated",
            metadata={"manifest": asdict(manifest)},
        )
        self.db.flush()
        return manifest

    def teardown_runtime_version(self, runtime_version_id: str, *, confirm: bool = False) -> TeardownResult:
        if self.db is None:
            raise ValueError("Database session is required to teardown a runtime version")
        version = _get_runtime_version(self.db, runtime_version_id)
        _refuse_active_version(self.db, runtime_version_id)
        if version.status == VERSION_STATUS_TORN_DOWN:
            manifest = _teardown_manifest(db=self.db, version=version, dry_run=not confirm)
            existing_completed_steps = [
                step.step_type
                for step in self.db.scalars(
                    select(TeardownStep)
                    .where(TeardownStep.runtime_version_id == version.id, TeardownStep.status == "completed")
                    .order_by(TeardownStep.ordinal, TeardownStep.created_at, TeardownStep.id)
                ).all()
            ]
            return TeardownResult(version=version, manifest=manifest, completed_steps=[], skipped_steps=existing_completed_steps)
        manifest = _teardown_manifest(db=self.db, version=version, dry_run=not confirm)
        steps = _ensure_teardown_steps(db=self.db, version=version, manifest=manifest)
        if not confirm:
            _record_lifecycle_event(
                db=self.db,
                runtime_version_id=runtime_version_id,
                event_type=VERSION_EVENT_TEARDOWN_DRY_RUN,
                message="Runtime version teardown dry-run manifest generated",
                metadata={"manifest": asdict(manifest), "confirmation_required": True},
            )
            self.db.flush()
            return TeardownResult(version=version, manifest=manifest, completed_steps=[], skipped_steps=[])

        _record_lifecycle_event(
            db=self.db,
            runtime_version_id=runtime_version_id,
            event_type=VERSION_EVENT_TEARDOWN_STARTED,
            message="Runtime version teardown started",
            metadata={"manifest": asdict(manifest)},
        )
        self.db.flush()

        completed_steps: list[str] = []
        skipped_steps: list[str] = []
        try:
            for step in steps:
                if step.status == "completed":
                    skipped_steps.append(step.step_type)
                    continue
                _run_teardown_step(
                    db=self.db,
                    backend=self.teardown_backend,
                    version=version,
                    manifest=manifest,
                    step=step,
                )
                completed_steps.append(step.step_type)
        except Exception as exc:
            version.status = VERSION_STATUS_TEARDOWN_FAILED
            version.updated_at = utcnow()
            _record_lifecycle_event(
                db=self.db,
                runtime_version_id=runtime_version_id,
                event_type=VERSION_EVENT_TEARDOWN_FAILED,
                message="Runtime version teardown failed",
                metadata={"error": str(exc)},
            )
            self.db.flush()
            raise

        version.status = VERSION_STATUS_TORN_DOWN
        version.updated_at = utcnow()
        _record_lifecycle_event(
            db=self.db,
            runtime_version_id=runtime_version_id,
            event_type=VERSION_EVENT_TEARDOWN_COMPLETED,
            message="Runtime version teardown completed",
            metadata={"completed_steps": completed_steps, "skipped_steps": skipped_steps},
        )
        self.db.flush()
        return TeardownResult(version=version, manifest=manifest, completed_steps=completed_steps, skipped_steps=skipped_steps)


def _namespace_token(version_id: str) -> str:
    normalized = re.sub(r"[^0-9a-z]+", "", version_id.lower())
    digest = hashlib.sha256(version_id.encode("utf-8")).hexdigest()[:16]
    stem = normalized[:24] or "version"
    return f"{stem}_{digest}"


def _slug_label(label: str | None) -> str | None:
    if label is None:
        return None
    slug = re.sub(r"[^0-9a-z]+", "-", label.lower()).strip("-")
    return slug or "version"


def _archive_root(settings: Settings, content_hash: str) -> Path:
    return Path(settings.upload_dir) / ARCHIVE_ROOT_NAME / content_hash[:2] / content_hash


def _replace_database_name(database_url: str, database_name: str) -> str:
    if "/" not in database_url:
        return database_url
    prefix, _, tail = database_url.rpartition("/")
    if not prefix:
        return database_url
    query = ""
    if "?" in tail:
        _, _, query = tail.partition("?")
    return f"{prefix}/{database_name}{'?' + query if query else ''}"


def _is_teardown_locked(db: Session, runtime_version_id: str) -> bool:
    return db.scalars(
        select(TeardownStep).where(
            TeardownStep.runtime_version_id == runtime_version_id,
            TeardownStep.status.in_(TEARDOWN_LOCKED_STATUSES),
        )
    ).first() is not None


def _get_runtime_version(db: Session, runtime_version_id: str) -> RuntimeVersion:
    version = db.get(RuntimeVersion, runtime_version_id)
    if version is None:
        raise ValueError("Runtime version does not exist")
    return version


def _refuse_active_version(db: Session, runtime_version_id: str) -> None:
    pointer = db.get(ActiveVersionPointer, DEFAULT_ACTIVE_POINTER_NAME)
    if pointer is not None and pointer.runtime_version_id == runtime_version_id:
        raise ValueError("Active runtime version cannot be torn down")


def _teardown_manifest(*, db: Session, version: RuntimeVersion, dry_run: bool = True) -> TeardownManifest:
    archive = db.get(ImmutableSourceArchive, version.source_archive_hash)
    archive_storage_path = archive.storage_path if archive is not None else None
    archive_original_filename = archive.original_filename if archive is not None else None
    archive_size_bytes = archive.size_bytes if archive is not None else None
    return TeardownManifest(
        version_id=version.id,
        database_name=version.database_name,
        database_url=version.database_url,
        qdrant_collection=version.qdrant_collection,
        derived_paths={
            "upload_prefix": version.upload_prefix,
            "static_prefix": version.static_prefix,
            "runtime_prefix": version.runtime_prefix,
        },
        cache_actions=[f"purge runtime caches for {version.id}"],
        unpublish_actions=[f"remove active/default pointer if it references {version.id}"],
        retained_archive={
            "content_hash": version.source_archive_hash,
            "storage_path": archive_storage_path,
            "size_bytes": archive_size_bytes,
            "original_filename": archive_original_filename,
        },
        steps=list(TEARDOWN_STEP_ORDER),
        dry_run=dry_run,
    )


def _ensure_teardown_steps(*, db: Session, version: RuntimeVersion, manifest: TeardownManifest) -> list[TeardownStep]:
    existing_steps = {
        step.step_type: step
        for step in db.scalars(
            select(TeardownStep)
            .where(TeardownStep.runtime_version_id == version.id)
            .order_by(TeardownStep.ordinal, TeardownStep.created_at, TeardownStep.id)
        ).all()
    }
    steps: list[TeardownStep] = []
    for ordinal, step_type in enumerate(TEARDOWN_STEP_ORDER, start=1):
        step = existing_steps.get(step_type)
        if step is None:
            now = utcnow()
            step = TeardownStep(
                runtime_version_id=version.id,
                step_type=step_type,
                status="pending",
                ordinal=ordinal,
                metadata_json=json.dumps({"manifest": asdict(manifest)}, sort_keys=True, separators=(",", ":")),
                created_at=now,
                updated_at=now,
            )
            db.add(step)
        steps.append(step)
    db.flush()
    return steps


def _run_teardown_step(
    *,
    db: Session,
    backend: VersionTeardownBackend,
    version: RuntimeVersion,
    manifest: TeardownManifest,
    step: TeardownStep,
) -> None:
    now = utcnow()
    step.status = "running"
    step.updated_at = now
    _record_lifecycle_event(
        db=db,
        runtime_version_id=version.id,
        event_type=VERSION_EVENT_TEARDOWN_STEP_STARTED,
        message=f"Teardown step {step.step_type} started",
        metadata={"step_type": step.step_type, "ordinal": step.ordinal},
    )
    db.flush()

    try:
        if step.step_type == "finalize_state":
            version.status = VERSION_STATUS_TORN_DOWN
            version.updated_at = utcnow()
        elif step.step_type == "unpublish":
            backend.unpublish(version, manifest)
        elif step.step_type == "purge_cache":
            backend.purge_cache(version, manifest)
        elif step.step_type == "cleanup_uploads":
            backend.cleanup_uploads(version, manifest)
        elif step.step_type == "cleanup_static":
            backend.cleanup_static(version, manifest)
        elif step.step_type == "cleanup_runtime":
            backend.cleanup_runtime(version, manifest)
        elif step.step_type == "delete_qdrant_collection":
            backend.delete_qdrant_collection(version, manifest)
        elif step.step_type == "drop_version_database":
            backend.drop_version_database(version, manifest)
        else:
            raise ValueError(f"Unknown teardown step {step.step_type}")
    except Exception:
        step.status = "failed"
        step.updated_at = utcnow()
        db.flush()
        raise

    step.status = "completed"
    step.updated_at = utcnow()
    _record_lifecycle_event(
        db=db,
        runtime_version_id=version.id,
        event_type=VERSION_EVENT_TEARDOWN_STEP_COMPLETED,
        message=f"Teardown step {step.step_type} completed",
        metadata={"step_type": step.step_type, "ordinal": step.ordinal},
    )
    db.flush()


def _record_lifecycle_event(
    *,
    db: Session,
    runtime_version_id: str,
    event_type: str,
    message: str,
    metadata: dict[str, object],
) -> None:
    db.add(
        VersionLifecycleEvent(
            runtime_version_id=runtime_version_id,
            event_type=event_type,
            message=message,
            metadata_json=json.dumps(metadata, sort_keys=True, separators=(",", ":")),
            created_at=utcnow(),
        )
    )


def _context_from_version(version: RuntimeVersion) -> RuntimeVersionContext:
    return RuntimeVersionContext(
        version_id=version.id,
        database_url=version.database_url,
        qdrant_collection=version.qdrant_collection,
        upload_prefix=version.upload_prefix,
        static_prefix=version.static_prefix,
        runtime_prefix=version.runtime_prefix,
    )
