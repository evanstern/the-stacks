import hashlib
import json
import os
from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

from app.config import Settings
from app.database import Base
from app.models import ActiveVersionPointer, ImmutableSourceArchive, RuntimeVersion, TeardownStep, VersionLifecycleEvent, utcnow
from app.version_lifecycle import TEARDOWN_STEP_ORDER, VersionLifecycleService, VersionTeardownBackend, derive_version_namespaces


READY_STATUSES_REFUSED = ["draft", "building", "failed", "retiring", "torn_down", "teardown_failed"]


class RecordingTeardownBackend(VersionTeardownBackend):
    def __init__(self, *, fail_on: str | None = None) -> None:
        self.calls: list[str] = []
        self.fail_on = fail_on

    def _record(self, step_type: str) -> None:
        self.calls.append(step_type)
        if self.fail_on == step_type:
            raise RuntimeError(f"failed {step_type}")

    def unpublish(self, version: RuntimeVersion, manifest) -> None:  # type: ignore[no-untyped-def]
        self._record("unpublish")

    def purge_cache(self, version: RuntimeVersion, manifest) -> None:  # type: ignore[no-untyped-def]
        self._record("purge_cache")

    def cleanup_uploads(self, version: RuntimeVersion, manifest) -> None:  # type: ignore[no-untyped-def]
        self._record("cleanup_uploads")

    def cleanup_static(self, version: RuntimeVersion, manifest) -> None:  # type: ignore[no-untyped-def]
        self._record("cleanup_static")

    def cleanup_runtime(self, version: RuntimeVersion, manifest) -> None:  # type: ignore[no-untyped-def]
        self._record("cleanup_runtime")

    def delete_qdrant_collection(self, version: RuntimeVersion, manifest) -> None:  # type: ignore[no-untyped-def]
        self._record("delete_qdrant_collection")

    def drop_version_database(self, version: RuntimeVersion, manifest) -> None:  # type: ignore[no-untyped-def]
        self._record("drop_version_database")


class MissingResourceTeardownBackend(VersionTeardownBackend):
    def __init__(self, *, missing: set[str]) -> None:
        self.calls: list[str] = []
        self.missing = missing

    def _record(self, step_type: str) -> None:
        self.calls.append(step_type)

    def unpublish(self, version: RuntimeVersion, manifest) -> None:  # type: ignore[no-untyped-def]
        self._record("unpublish")

    def purge_cache(self, version: RuntimeVersion, manifest) -> None:  # type: ignore[no-untyped-def]
        self._record("purge_cache")

    def cleanup_uploads(self, version: RuntimeVersion, manifest) -> None:  # type: ignore[no-untyped-def]
        self._record("cleanup_uploads")

    def cleanup_static(self, version: RuntimeVersion, manifest) -> None:  # type: ignore[no-untyped-def]
        self._record("cleanup_static")

    def cleanup_runtime(self, version: RuntimeVersion, manifest) -> None:  # type: ignore[no-untyped-def]
        self._record("cleanup_runtime")

    def delete_qdrant_collection(self, version: RuntimeVersion, manifest) -> None:  # type: ignore[no-untyped-def]
        self._record("delete_qdrant_collection")
        assert version.qdrant_collection in self.missing

    def drop_version_database(self, version: RuntimeVersion, manifest) -> None:  # type: ignore[no-untyped-def]
        self._record("drop_version_database")
        assert version.database_name in self.missing


def _db_session() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_create_version_namespaces_derives_destructive_keys_from_internal_version_id(tmp_path: Path) -> None:
    db = next(_db_session())
    settings = Settings(
        DATABASE_URL="postgresql+psycopg://thestacks:thestacks@postgres:5432/thestacks",
        UPLOAD_DIR=str(tmp_path / "uploads"),
        QDRANT_COLLECTION="thestacks_chunks",
    )
    unsafe_label = "Prod DB; DROP DATABASE thestacks -- ../dndbeyond.zip"
    unsafe_filename = "../../prod database.zip"
    version_id = "9cf8d31a-1c2b-4fdc-9c42-0123456789ab"

    service = VersionLifecycleService(db=db, settings=settings)
    result = service.create_version_namespaces(
        version_id=version_id,
        label=unsafe_label,
        archive_bytes=b"source archive bytes",
        original_filename=unsafe_filename,
    )

    namespaces = result.namespaces
    expected = derive_version_namespaces(version_id=version_id, settings=settings)
    assert namespaces == expected
    assert namespaces.database_name.startswith("tsv_9cf8d31a1c2b4fdc9c420123_")
    assert namespaces.database_url.endswith(f"/{namespaces.database_name}")
    assert namespaces.qdrant_collection == f"thestacks_chunks_{namespaces.database_name.removeprefix('tsv_')}"
    assert namespaces.upload_prefix == f"versions/{namespaces.database_name.removeprefix('tsv_')}/uploads"
    assert namespaces.static_prefix == f"versions/{namespaces.database_name.removeprefix('tsv_')}/static"
    assert namespaces.runtime_prefix == f"versions/{namespaces.database_name.removeprefix('tsv_')}/runtime"
    destructive_values = [
        namespaces.database_name,
        namespaces.database_url,
        namespaces.qdrant_collection,
        namespaces.upload_prefix,
        namespaces.static_prefix,
        namespaces.runtime_prefix,
    ]
    assert all("drop" not in value.lower() for value in destructive_values)
    assert all("dndbeyond" not in value.lower() for value in destructive_values)
    assert all(".." not in value for value in destructive_values)

    version = db.get(RuntimeVersion, version_id)
    assert version is not None
    assert version.display_label == unsafe_label
    assert version.label_slug == "prod-db-drop-database-thestacks-dndbeyond-zip"
    metadata = json.loads(version.metadata_json)
    assert metadata["label_slug"] == version.label_slug
    assert metadata["namespaces"]["database_name"] == namespaces.database_name
    event = db.scalars(select(VersionLifecycleEvent).where(VersionLifecycleEvent.runtime_version_id == version_id)).one()
    assert event.event_type == "created"


def test_shared_archive_immutable_reuses_content_hash_without_rewriting_bytes(tmp_path: Path) -> None:
    db = next(_db_session())
    settings = Settings(UPLOAD_DIR=str(tmp_path / "uploads"))
    service = VersionLifecycleService(db=db, settings=settings)
    content = b"same immutable source archive"
    digest = hashlib.sha256(content).hexdigest()

    first = service.create_version_namespaces(
        version_id="11111111-1111-4111-8111-111111111111",
        label="First Runtime",
        archive_bytes=content,
        original_filename="first.zip",
    )
    archive_path = Path(first.archive.storage_path)
    assert archive_path.read_bytes() == content
    first_mtime = archive_path.stat().st_mtime_ns

    second = service.create_version_namespaces(
        version_id="22222222-2222-4222-8222-222222222222",
        label="Second Runtime",
        archive_bytes=content,
        original_filename="second.zip",
    )

    assert first.archive.content_hash == digest
    assert second.archive.content_hash == digest
    assert second.archive.reused is True
    assert Path(second.archive.storage_path) == archive_path
    assert archive_path.read_bytes() == content
    assert archive_path.stat().st_mtime_ns == first_mtime
    archives = db.scalars(select(ImmutableSourceArchive)).all()
    assert len(archives) == 1
    assert archives[0].content_hash == digest
    versions = db.scalars(select(RuntimeVersion).order_by(RuntimeVersion.id)).all()
    assert [version.source_archive_hash for version in versions] == [digest, digest]
    assert first.namespaces.qdrant_collection != second.namespaces.qdrant_collection
    assert first.namespaces.database_name != second.namespaces.database_name


def test_namespace_derivation_avoids_collisions_for_similar_labels_and_ids(tmp_path: Path) -> None:
    db = next(_db_session())
    settings = Settings(UPLOAD_DIR=str(tmp_path / "uploads"), QDRANT_COLLECTION="collision_chunks")
    service = VersionLifecycleService(db=db, settings=settings)

    first = service.create_version_namespaces(
        version_id="abababab-abab-4aba-8aba-abababababab",
        label="Same Display Name",
        archive_bytes=b"first collision archive",
    )
    second = service.create_version_namespaces(
        version_id="abababab-abab-4aba-8aba-abababababac",
        label="Same Display Name",
        archive_bytes=b"second collision archive",
    )

    assert first.version.label_slug == second.version.label_slug == "same-display-name"
    assert first.namespaces.database_name != second.namespaces.database_name
    assert first.namespaces.database_url != second.namespaces.database_url
    assert first.namespaces.qdrant_collection != second.namespaces.qdrant_collection
    assert first.namespaces.upload_prefix != second.namespaces.upload_prefix
    assert first.namespaces.static_prefix != second.namespaces.static_prefix
    assert first.namespaces.runtime_prefix != second.namespaces.runtime_prefix


def test_activation_pointer_atomic_switches_default_pointer_and_runtime_context(tmp_path: Path) -> None:
    db = next(_db_session())
    settings = Settings(UPLOAD_DIR=str(tmp_path / "uploads"), QDRANT_COLLECTION="control_default_chunks")
    service = VersionLifecycleService(db=db, settings=settings)
    first = service.create_version_namespaces(
        version_id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        label="First ready runtime",
        archive_bytes=b"first",
    )
    second = service.create_version_namespaces(
        version_id="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        label="Second ready runtime",
        archive_bytes=b"second",
    )
    first.version.status = "ready"
    second.version.status = "ready"
    db.flush()

    context = service.activate_runtime_version(first.version.id)

    pointer = db.get(ActiveVersionPointer, "default")
    assert pointer is not None
    assert pointer.runtime_version_id == first.version.id
    assert context.version_id == first.version.id
    assert context.database_url == first.namespaces.database_url
    assert context.qdrant_collection == first.namespaces.qdrant_collection
    assert context.qdrant_collection != settings.qdrant_collection
    assert context.upload_prefix == first.namespaces.upload_prefix
    assert context.static_prefix == first.namespaces.static_prefix
    assert context.runtime_prefix == first.namespaces.runtime_prefix
    events = db.scalars(
        select(VersionLifecycleEvent).where(
            VersionLifecycleEvent.runtime_version_id == first.version.id,
            VersionLifecycleEvent.event_type == "activated",
        )
    ).all()
    assert len(events) == 1

    rollback_context = service.activate_runtime_version(second.version.id)
    rollback_pointer = db.get(ActiveVersionPointer, "default")
    assert rollback_pointer is not None
    assert rollback_pointer.runtime_version_id == second.version.id
    assert rollback_context.version_id == second.version.id

    previous_context = service.activate_runtime_version(first.version.id)
    previous_pointer = db.get(ActiveVersionPointer, "default")
    assert previous_pointer is not None
    assert previous_pointer.runtime_version_id == first.version.id
    assert previous_context.version_id == first.version.id
    resolved = service.resolve_runtime_context()
    assert resolved == previous_context


def test_activate_not_ready_refuses_every_non_ready_status_without_pointer_or_event(tmp_path: Path) -> None:
    db = next(_db_session())
    settings = Settings(UPLOAD_DIR=str(tmp_path / "uploads"))
    service = VersionLifecycleService(db=db, settings=settings)

    for index, status in enumerate(READY_STATUSES_REFUSED):
        build = service.create_version_namespaces(
            version_id=f"00000000-0000-4000-8000-{index:012d}",
            label=f"{status} runtime",
            archive_bytes=status.encode("utf-8"),
        )
        build.version.status = status
        db.flush()
        try:
            service.activate_runtime_version(build.version.id)
        except ValueError as exc:
            assert "ready" in str(exc)
        else:
            raise AssertionError(f"activated {status} runtime")

    assert db.get(ActiveVersionPointer, "default") is None
    activated_events = db.scalars(select(VersionLifecycleEvent).where(VersionLifecycleEvent.event_type == "activated")).all()
    assert activated_events == []


def test_activate_teardown_locked_refuses_ready_version_without_pointer_or_event(tmp_path: Path) -> None:
    db = next(_db_session())
    settings = Settings(UPLOAD_DIR=str(tmp_path / "uploads"))
    service = VersionLifecycleService(db=db, settings=settings)
    build = service.create_version_namespaces(
        version_id="cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        label="Locked ready runtime",
        archive_bytes=b"locked",
    )
    build.version.status = "ready"
    for index, locked_status in enumerate(["pending", "running"]):
        db.add(
            TeardownStep(
                runtime_version_id=build.version.id,
                step_type=f"locked_{locked_status}",
                status=locked_status,
                ordinal=index + 1,
                metadata_json="{}",
                created_at=utcnow(),
                updated_at=utcnow(),
            )
        )
        db.flush()

        try:
            service.activate_runtime_version(build.version.id)
        except ValueError as exc:
            assert "teardown-locked" in str(exc)
        else:
            raise AssertionError(f"activated {locked_status} teardown-locked runtime")

        assert db.get(ActiveVersionPointer, "default") is None
        activated_events = db.scalars(select(VersionLifecycleEvent).where(VersionLifecycleEvent.event_type == "activated")).all()
        assert activated_events == []


def test_teardown_dry_run_manifest_persists_lock_and_retains_archive(tmp_path: Path) -> None:
    db = next(_db_session())
    settings = Settings(UPLOAD_DIR=str(tmp_path / "uploads"), QDRANT_COLLECTION="dry_run_chunks")
    backend = RecordingTeardownBackend()
    service = VersionLifecycleService(db=db, settings=settings, teardown_backend=backend)
    build = service.create_version_namespaces(
        version_id="dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        label="Dry run runtime",
        archive_bytes=b"retained source archive",
        original_filename="source.zip",
    )

    result = service.teardown_runtime_version(build.version.id)

    assert result.manifest.dry_run is True
    assert result.manifest.database_name == build.namespaces.database_name
    assert result.manifest.database_url == build.namespaces.database_url
    assert result.manifest.qdrant_collection == build.namespaces.qdrant_collection
    assert result.manifest.derived_paths == {
        "upload_prefix": build.namespaces.upload_prefix,
        "static_prefix": build.namespaces.static_prefix,
        "runtime_prefix": build.namespaces.runtime_prefix,
    }
    assert result.manifest.cache_actions == [f"purge runtime caches for {build.version.id}"]
    assert result.manifest.unpublish_actions == [f"remove active/default pointer if it references {build.version.id}"]
    assert result.manifest.retained_archive["content_hash"] == build.archive.content_hash
    assert result.manifest.retained_archive["storage_path"] == build.archive.storage_path
    assert Path(build.archive.storage_path).read_bytes() == b"retained source archive"
    assert backend.calls == []
    steps = db.scalars(select(TeardownStep).where(TeardownStep.runtime_version_id == build.version.id).order_by(TeardownStep.ordinal)).all()
    assert [step.step_type for step in steps] == list(TEARDOWN_STEP_ORDER)
    assert [step.status for step in steps] == ["pending"] * len(TEARDOWN_STEP_ORDER)
    events = db.scalars(select(VersionLifecycleEvent).where(VersionLifecycleEvent.runtime_version_id == build.version.id)).all()
    assert [event.event_type for event in events] == ["created", "teardown_dry_run"]


def test_teardown_refuses_active_version_before_manifest_steps_or_backend_calls(tmp_path: Path) -> None:
    db = next(_db_session())
    settings = Settings(UPLOAD_DIR=str(tmp_path / "uploads"))
    backend = RecordingTeardownBackend()
    service = VersionLifecycleService(db=db, settings=settings, teardown_backend=backend)
    build = service.create_version_namespaces(
        version_id="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        label="Active runtime",
        archive_bytes=b"active",
    )
    build.version.status = "ready"
    service.activate_runtime_version(build.version.id)

    try:
        service.teardown_runtime_version(build.version.id, confirm=True)
    except ValueError as exc:
        assert "Active runtime version" in str(exc)
    else:
        raise AssertionError("tore down active runtime")

    assert backend.calls == []
    assert db.scalars(select(TeardownStep).where(TeardownStep.runtime_version_id == build.version.id)).all() == []
    event_types = [
        event.event_type
        for event in db.scalars(select(VersionLifecycleEvent).where(VersionLifecycleEvent.runtime_version_id == build.version.id)).all()
    ]
    assert event_types == ["created", "activated"]
    assert Path(build.archive.storage_path).exists()


def test_teardown_order_requires_confirmation_and_audits_steps(tmp_path: Path) -> None:
    db = next(_db_session())
    settings = Settings(UPLOAD_DIR=str(tmp_path / "uploads"))
    backend = RecordingTeardownBackend()
    service = VersionLifecycleService(db=db, settings=settings, teardown_backend=backend)
    build = service.create_version_namespaces(
        version_id="ffffffff-ffff-4fff-8fff-ffffffffffff",
        label="Ordered runtime",
        archive_bytes=b"ordered",
    )

    dry_run = service.teardown_runtime_version(build.version.id, confirm=False)
    assert dry_run.completed_steps == []
    assert backend.calls == []
    assert [step.status for step in db.scalars(select(TeardownStep).where(TeardownStep.runtime_version_id == build.version.id)).all()] == [
        "pending"
    ] * len(TEARDOWN_STEP_ORDER)

    result = service.teardown_runtime_version(build.version.id, confirm=True)

    assert backend.calls == list(TEARDOWN_STEP_ORDER[:-1])
    assert result.completed_steps == list(TEARDOWN_STEP_ORDER)
    assert result.manifest.dry_run is False
    assert result.skipped_steps == []
    assert build.version.status == "torn_down"
    assert Path(build.archive.storage_path).read_bytes() == b"ordered"
    steps = db.scalars(select(TeardownStep).where(TeardownStep.runtime_version_id == build.version.id).order_by(TeardownStep.ordinal)).all()
    assert [step.step_type for step in steps] == list(TEARDOWN_STEP_ORDER)
    assert [step.status for step in steps] == ["completed"] * len(TEARDOWN_STEP_ORDER)
    event_types = [
        event.event_type
        for event in db.scalars(select(VersionLifecycleEvent).where(VersionLifecycleEvent.runtime_version_id == build.version.id)).all()
    ]
    assert event_types.count("teardown_step_started") == len(TEARDOWN_STEP_ORDER)
    assert event_types.count("teardown_step_completed") == len(TEARDOWN_STEP_ORDER)
    assert event_types[-1] == "teardown_completed"


def test_teardown_partial_failure_resumable_skips_completed_steps(tmp_path: Path) -> None:
    db = next(_db_session())
    settings = Settings(UPLOAD_DIR=str(tmp_path / "uploads"))
    failing_backend = RecordingTeardownBackend(fail_on="cleanup_static")
    service = VersionLifecycleService(db=db, settings=settings, teardown_backend=failing_backend)
    build = service.create_version_namespaces(
        version_id="12345678-1234-4234-8234-123456789abc",
        label="Resumable runtime",
        archive_bytes=b"resumable",
    )

    try:
        service.teardown_runtime_version(build.version.id, confirm=True)
    except RuntimeError as exc:
        assert "cleanup_static" in str(exc)
    else:
        raise AssertionError("teardown failure did not bubble")

    assert failing_backend.calls == ["unpublish", "purge_cache", "cleanup_uploads", "cleanup_static"]
    assert build.version.status == "teardown_failed"
    failed_steps = db.scalars(select(TeardownStep).where(TeardownStep.runtime_version_id == build.version.id).order_by(TeardownStep.ordinal)).all()
    assert [step.status for step in failed_steps[:3]] == ["completed", "completed", "completed"]
    assert failed_steps[3].step_type == "cleanup_static"
    assert failed_steps[3].status == "failed"
    assert [step.status for step in failed_steps[4:]] == ["pending", "pending", "pending", "pending"]

    resume_backend = RecordingTeardownBackend()
    resume_service = VersionLifecycleService(db=db, settings=settings, teardown_backend=resume_backend)
    result = resume_service.teardown_runtime_version(build.version.id, confirm=True)

    assert resume_backend.calls == ["cleanup_static", "cleanup_runtime", "delete_qdrant_collection", "drop_version_database"]
    assert result.skipped_steps == ["unpublish", "purge_cache", "cleanup_uploads"]
    assert result.completed_steps == ["cleanup_static", "cleanup_runtime", "delete_qdrant_collection", "drop_version_database", "finalize_state"]
    assert build.version.status == "torn_down"
    assert Path(build.archive.storage_path).read_bytes() == b"resumable"
    resumed_steps = db.scalars(select(TeardownStep).where(TeardownStep.runtime_version_id == build.version.id).order_by(TeardownStep.ordinal)).all()
    assert [step.status for step in resumed_steps] == ["completed"] * len(TEARDOWN_STEP_ORDER)
    assert db.scalars(
        select(VersionLifecycleEvent).where(
            VersionLifecycleEvent.runtime_version_id == build.version.id,
            VersionLifecycleEvent.event_type == "teardown_failed",
        )
    ).one()


def test_teardown_idempotent_for_already_torn_down_version_without_backend_calls(tmp_path: Path) -> None:
    db = next(_db_session())
    settings = Settings(UPLOAD_DIR=str(tmp_path / "uploads"))
    first_backend = RecordingTeardownBackend()
    service = VersionLifecycleService(db=db, settings=settings, teardown_backend=first_backend)
    build = service.create_version_namespaces(
        version_id="23456789-2345-4234-8234-23456789abcd",
        label="Idempotent runtime",
        archive_bytes=b"idempotent",
    )
    first = service.teardown_runtime_version(build.version.id, confirm=True)
    assert first.completed_steps == list(TEARDOWN_STEP_ORDER)

    second_backend = RecordingTeardownBackend()
    second_service = VersionLifecycleService(db=db, settings=settings, teardown_backend=second_backend)
    second = second_service.teardown_runtime_version(build.version.id, confirm=True)

    assert second.version.status == "torn_down"
    assert second.completed_steps == []
    assert second.skipped_steps == list(TEARDOWN_STEP_ORDER)
    assert second.manifest.dry_run is False
    assert second_backend.calls == []
    assert Path(build.archive.storage_path).read_bytes() == b"idempotent"
    steps = db.scalars(select(TeardownStep).where(TeardownStep.runtime_version_id == build.version.id)).all()
    assert len(steps) == len(TEARDOWN_STEP_ORDER)


def test_teardown_missing_runtime_resources_are_noop_cleanup_and_retain_archive(tmp_path: Path) -> None:
    db = next(_db_session())
    settings = Settings(UPLOAD_DIR=str(tmp_path / "uploads"))
    service = VersionLifecycleService(db=db, settings=settings)
    build = service.create_version_namespaces(
        version_id="34567890-3456-4345-8345-34567890abcd",
        label="Missing resources runtime",
        archive_bytes=b"missing resources",
    )
    backend = MissingResourceTeardownBackend(missing={build.version.qdrant_collection, build.version.database_name})
    teardown_service = VersionLifecycleService(db=db, settings=settings, teardown_backend=backend)

    result = teardown_service.teardown_runtime_version(build.version.id, confirm=True)

    assert result.completed_steps == list(TEARDOWN_STEP_ORDER)
    assert backend.calls == list(TEARDOWN_STEP_ORDER[:-1])
    assert Path(build.archive.storage_path).read_bytes() == b"missing resources"
    assert "source-archives" not in result.manifest.derived_paths["upload_prefix"]
    assert "source-archives" not in result.manifest.derived_paths["static_prefix"]
    assert "source-archives" not in result.manifest.derived_paths["runtime_prefix"]
    assert result.manifest.retained_archive["storage_path"] == build.archive.storage_path


def test_teardown_cache_purge_failure_marks_step_failed_and_preserves_archive(tmp_path: Path) -> None:
    db = next(_db_session())
    settings = Settings(UPLOAD_DIR=str(tmp_path / "uploads"))
    backend = RecordingTeardownBackend(fail_on="purge_cache")
    service = VersionLifecycleService(db=db, settings=settings, teardown_backend=backend)
    build = service.create_version_namespaces(
        version_id="45678901-4567-4456-8456-45678901abcd",
        label="Cache failure runtime",
        archive_bytes=b"cache failure",
    )

    try:
        service.teardown_runtime_version(build.version.id, confirm=True)
    except RuntimeError as exc:
        assert "purge_cache" in str(exc)
    else:
        raise AssertionError("cache purge failure did not bubble")

    steps = db.scalars(select(TeardownStep).where(TeardownStep.runtime_version_id == build.version.id).order_by(TeardownStep.ordinal)).all()
    assert [step.status for step in steps[:2]] == ["completed", "failed"]
    assert [step.status for step in steps[2:]] == ["pending", "pending", "pending", "pending", "pending", "pending"]
    assert build.version.status == "teardown_failed"
    assert backend.calls == ["unpublish", "purge_cache"]
    assert Path(build.archive.storage_path).read_bytes() == b"cache failure"


def test_teardown_retains_shared_archive_when_one_referencing_version_is_removed(tmp_path: Path) -> None:
    db = next(_db_session())
    settings = Settings(UPLOAD_DIR=str(tmp_path / "uploads"))
    service = VersionLifecycleService(db=db, settings=settings, teardown_backend=RecordingTeardownBackend())
    shared_content = b"shared teardown archive"
    first = service.create_version_namespaces(
        version_id="56789012-5678-4567-8567-56789012abcd",
        label="Shared archive one",
        archive_bytes=shared_content,
    )
    second = service.create_version_namespaces(
        version_id="67890123-6789-4678-8678-67890123abcd",
        label="Shared archive two",
        archive_bytes=shared_content,
    )
    assert first.archive.storage_path == second.archive.storage_path

    result = service.teardown_runtime_version(first.version.id, confirm=True)

    assert result.manifest.retained_archive["content_hash"] == first.archive.content_hash
    assert result.manifest.retained_archive["storage_path"] == first.archive.storage_path
    assert Path(first.archive.storage_path).read_bytes() == shared_content
    assert second.version.status == "draft"
    archive_rows = db.scalars(select(ImmutableSourceArchive).where(ImmutableSourceArchive.content_hash == first.archive.content_hash)).all()
    assert len(archive_rows) == 1
