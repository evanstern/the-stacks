import hashlib
import importlib
import json
import os
from collections.abc import Generator, Sequence
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

corpus_seed_cli = importlib.import_module("app.cli.corpus_seed")
corpus_reset_module = importlib.import_module("app.corpus_reset")
config_module = importlib.import_module("app.config")
database_module = importlib.import_module("app.database")
models_module = importlib.import_module("app.models")
version_lifecycle_module = importlib.import_module("app.version_lifecycle")

Settings = config_module.Settings
CorpusResetError = corpus_reset_module.CorpusResetError
CorpusResetService = corpus_reset_module.CorpusResetService
Base = database_module.Base
ActiveVersionPointer = models_module.ActiveVersionPointer
Document = models_module.Document
DocumentChunk = models_module.DocumentChunk
ImmutableSourceArchive = models_module.ImmutableSourceArchive
IndexedChunk = models_module.IndexedChunk
IngestionEvent = models_module.IngestionEvent
IngestionJob = models_module.IngestionJob
RuntimeVersion = models_module.RuntimeVersion
Section = models_module.Section
Source = models_module.Source
Upload = models_module.Upload
UploadBatch = models_module.UploadBatch
VersionLifecycleEvent = models_module.VersionLifecycleEvent
utcnow = models_module.utcnow
VersionLifecycleService = version_lifecycle_module.VersionLifecycleService


class RecordingResetBackend:
    def __init__(self) -> None:
        self.deleted_points: list[tuple[str, list[str]]] = []

    def delete_indexed_points(self, *, collection: str, point_ids: Sequence[str]) -> None:
        self.deleted_points.append((collection, list(point_ids)))


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    engine = create_engine("sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_reset_dry_run_no_mutation(db_session: Session, tmp_path: Path) -> None:
    settings, backend, service, target, active = _seed_reset_state(db_session, tmp_path)
    before = _snapshot(db_session)
    events_before = [
        event.event_type
        for event in db_session.scalars(select(VersionLifecycleEvent).where(VersionLifecycleEvent.runtime_version_id == target.id)).all()
    ]

    result = service.reset(version="default-corpus", dry_run=True)

    assert result.manifest.dry_run is True
    assert result.manifest.counts.sources == 3
    assert result.manifest.counts.indexed_chunks == 3
    assert result.manifest.delete["qdrant_point_ids"] == ["point-dmg-2014", "point-mm-2014", "point-phb-2014"]
    assert result.manifest.preserve["runtime_version_id"] == target.id
    assert result.manifest.preserve["active_pointer"] == "default"
    assert result.archive_sha_before == result.archive_sha_after == target.source_archive_hash
    assert _snapshot(db_session) == before
    assert backend.deleted_points == []
    pointer = db_session.get(ActiveVersionPointer, "default")
    assert pointer is not None
    assert pointer.runtime_version_id == active.id
    assert (Path(settings.upload_dir) / target.upload_prefix).exists()
    events_after = [
        event.event_type
        for event in db_session.scalars(select(VersionLifecycleEvent).where(VersionLifecycleEvent.runtime_version_id == target.id)).all()
    ]
    assert events_after == events_before


def test_reset_refuses_active_version(db_session: Session, tmp_path: Path) -> None:
    _settings, _backend, service, target, _active = _seed_reset_state(db_session, tmp_path)
    pointer = db_session.get(ActiveVersionPointer, "default")
    assert pointer is not None
    pointer.runtime_version_id = target.id
    db_session.flush()

    with pytest.raises(CorpusResetError, match="Active runtime version cannot be reset"):
        service.reset(version="default-corpus", confirm_version="default-corpus")

    assert db_session.scalars(select(Source).where(Source.id == "phb-2014")).one()


def test_reset_requires_confirm_version_for_mutation(db_session: Session, tmp_path: Path) -> None:
    _settings, backend, service, _target, _active = _seed_reset_state(db_session, tmp_path)

    service.reset(version="default-corpus")

    assert db_session.scalars(select(Source).where(Source.id == "phb-2014")).one()
    assert backend.deleted_points == []

    with pytest.raises(CorpusResetError, match="--confirm-version default-corpus required"):
        service.reset(version="default-corpus", confirm_version="wrong-version")


def test_reset_preserves_archive_sha(db_session: Session, tmp_path: Path) -> None:
    _settings, _backend, service, target, _active = _seed_reset_state(db_session, tmp_path)
    archive = db_session.get(ImmutableSourceArchive, target.source_archive_hash)
    assert archive is not None
    before = hashlib.sha256(Path(archive.storage_path).read_bytes()).hexdigest()

    result = service.reset(version="default-corpus", confirm_version="default-corpus")

    after = hashlib.sha256(Path(archive.storage_path).read_bytes()).hexdigest()
    assert result.archive_sha_before == before
    assert result.archive_sha_after == after == target.source_archive_hash
    assert db_session.get(ImmutableSourceArchive, target.source_archive_hash) is not None
    assert Path(archive.storage_path).is_file()


@pytest.mark.parametrize(
    ("damage", "message"),
    [
        ("metadata", "Runtime version immutable archive metadata is missing"),
        ("bytes", "Runtime version immutable archive bytes are missing"),
        ("drift", "Runtime version immutable archive SHA does not match metadata"),
    ],
)
def test_reset_fails_closed_when_archive_cannot_be_verified(db_session: Session, tmp_path: Path, damage: str, message: str) -> None:
    _settings, backend, service, target, _active = _seed_reset_state(db_session, tmp_path)
    archive = db_session.get(ImmutableSourceArchive, target.source_archive_hash)
    assert archive is not None

    if damage == "metadata":
        db_session.delete(archive)
    elif damage == "bytes":
        Path(archive.storage_path).unlink()
    else:
        Path(archive.storage_path).write_bytes(b"mutated immutable archive")
    db_session.flush()

    before = _snapshot(db_session)
    with pytest.raises(CorpusResetError, match=message):
        service.reset(version="default-corpus", confirm_version="default-corpus")

    assert _snapshot(db_session) == before
    assert backend.deleted_points == []


def test_reset_deletes_only_target_runtime_rows_and_paths(db_session: Session, tmp_path: Path) -> None:
    settings, backend, service, target, active = _seed_reset_state(db_session, tmp_path)
    other_source_id = "xgte-2017"
    _add_source_tree(db_session, source_id=other_source_id, version=active, qdrant_collection=active.qdrant_collection)
    db_session.flush()
    active_upload_prefix = Path(settings.upload_dir) / active.upload_prefix
    active_upload_prefix.mkdir(parents=True)

    result = service.reset(version="default-corpus", confirm_version="default-corpus")

    assert result.deleted.sources == 3
    assert result.deleted.uploads == 3
    assert result.deleted.jobs == 3
    assert result.deleted.indexed_chunks == 3
    assert result.deleted.derived_paths == 3
    assert backend.deleted_points == [(target.qdrant_collection, ["point-phb-2014", "point-dmg-2014", "point-mm-2014"])]
    assert db_session.get(RuntimeVersion, target.id) is not None
    assert db_session.get(RuntimeVersion, active.id) is not None
    pointer = db_session.get(ActiveVersionPointer, "default")
    assert pointer is not None
    assert pointer.runtime_version_id == active.id
    assert db_session.get(Source, other_source_id) is not None
    assert db_session.scalars(select(Source).where(Source.id.in_(["phb-2014", "dmg-2014", "mm-2014"]))).all() == []
    assert db_session.scalars(select(IndexedChunk).where(IndexedChunk.qdrant_collection == active.qdrant_collection)).all()
    assert active_upload_prefix.exists()
    assert not (Path(settings.upload_dir) / target.upload_prefix).exists()
    event_types = [event.event_type for event in db_session.scalars(select(VersionLifecycleEvent).where(VersionLifecycleEvent.runtime_version_id == target.id)).all()]
    assert "corpus_reset_started" in event_types
    assert "corpus_reset_completed" in event_types


def test_reset_detects_running_jobs_for_target_version(db_session: Session, tmp_path: Path) -> None:
    _settings, _backend, service, _target, _active = _seed_reset_state(db_session, tmp_path, job_status="processing")

    with pytest.raises(CorpusResetError, match="Refusing reset while target jobs are running"):
        service.reset(version="default-corpus", confirm_version="default-corpus")

    assert db_session.get(Source, "phb-2014") is not None


def test_reset_cli_dry_run_exits_zero_and_reports_manifest(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    class FakeDb:
        def rollback(self) -> None:
            return None

        def close(self) -> None:
            return None

    class FakeService:
        def __init__(self, *, db: object, settings: Settings) -> None:
            self.db = db
            self.settings = settings

        def reset(self, *, version: str, confirm_version: str | None, dry_run: bool) -> object:
            assert version == "default-corpus"
            assert confirm_version is None
            assert dry_run is True
            return _fake_reset_result(dry_run=True)

    monkeypatch.setattr(corpus_seed_cli, "SessionLocal", lambda: FakeDb())
    monkeypatch.setattr(corpus_seed_cli, "get_settings", lambda: object())
    monkeypatch.setattr(corpus_seed_cli, "CorpusResetService", FakeService)

    exit_code = corpus_seed_cli.main(["reset", "--version", "default-corpus", "--dry-run"])

    assert exit_code == 0
    output = capsys.readouterr().out
    assert '"dry_run": true' in output
    assert '"preserve"' in output


def test_reset_cli_mutation_requires_confirm_flag(capsys: pytest.CaptureFixture[str]) -> None:
    exit_code = corpus_seed_cli.main(["reset", "--version", "default-corpus"])

    assert exit_code == 1
    assert "--confirm-version default-corpus required" in capsys.readouterr().err


def test_reset_cli_dry_run_uses_local_fallback_for_default_database(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    settings = Settings(
        DATABASE_URL="postgresql+psycopg://thestacks:thestacks@postgres:5432/thestacks",
        QDRANT_COLLECTION="cli_test_chunks",
    )
    monkeypatch.setattr(corpus_seed_cli, "get_settings", lambda: settings)

    exit_code = corpus_seed_cli.main(["reset", "--version", "default-corpus", "--dry-run"])

    assert exit_code == 0
    output = json.loads(capsys.readouterr().out)
    assert output["manifest"]["dry_run"] is True
    assert output["manifest"]["corpus_version"] == "default-corpus"
    assert output["manifest"]["delete"]["db_rows"]["sources"] == 0
    assert output["manifest"]["preserve"]["runtime_version_id"] == corpus_seed_cli.LOCAL_DRY_RUN_VERSION_ID


def test_reset_cli_dry_run_keeps_explicit_database_url(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeDb:
        def rollback(self) -> None:
            return None

        def close(self) -> None:
            return None

    class FakeService:
        def __init__(self, *, db: object, settings: object) -> None:
            self.db = db
            self.settings = settings

        def reset(self, *, version: str, confirm_version: str | None, dry_run: bool) -> object:
            assert version == "default-corpus"
            assert confirm_version is None
            assert dry_run is True
            assert getattr(self.settings, "database_url") == "sqlite+pysqlite:///explicit.db"
            return _fake_reset_result(dry_run=True)

    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///explicit.db")
    monkeypatch.setattr(corpus_seed_cli, "get_settings", lambda: Settings(DATABASE_URL="sqlite+pysqlite:///explicit.db"))
    monkeypatch.setattr(corpus_seed_cli, "SessionLocal", lambda: FakeDb())
    monkeypatch.setattr(corpus_seed_cli, "CorpusResetService", FakeService)

    assert corpus_seed_cli.main(["reset", "--version", "default-corpus", "--dry-run"]) == 0


def _seed_reset_state(
    db: Session,
    tmp_path: Path,
    *,
    job_status: str = "completed",
) -> tuple[Any, RecordingResetBackend, Any, Any, Any]:
    settings = Settings(UPLOAD_DIR=str(tmp_path / "uploads"), QDRANT_COLLECTION="test_chunks")
    lifecycle = VersionLifecycleService(db=db, settings=settings)
    target = lifecycle.create_version_namespaces(
        version_id="11111111-1111-4111-8111-111111111111",
        label="default-corpus",
        archive_bytes=b"default corpus immutable archive",
        original_filename="default-corpus.zip",
    ).version
    target.status = "ready"
    active = lifecycle.create_version_namespaces(
        version_id="22222222-2222-4222-8222-222222222222",
        label="active-runtime",
        archive_bytes=b"active immutable archive",
        original_filename="active.zip",
    ).version
    active.status = "ready"
    lifecycle.activate_runtime_version(active.id)
    for prefix in (target.upload_prefix, target.static_prefix, target.runtime_prefix):
        path = Path(settings.upload_dir) / prefix
        path.mkdir(parents=True)
        (path / "sentinel.txt").write_text("target runtime", encoding="utf-8")
    for source_id in ("phb-2014", "dmg-2014", "mm-2014"):
        _add_source_tree(db, source_id=source_id, version=target, qdrant_collection=target.qdrant_collection, job_status=job_status)
    db.flush()
    backend = RecordingResetBackend()
    return settings, backend, CorpusResetService(db=db, settings=settings, backend=backend), target, active


def _add_source_tree(
    db: Session,
    *,
    source_id: str,
    version: Any,
    qdrant_collection: str,
    job_status: str = "completed",
) -> None:
    now = utcnow()
    batch = UploadBatch(
        status="completed",
        file_count=1,
        metadata_json=json.dumps({"runtime_version": version.label_slug}),
        created_at=now,
        updated_at=now,
    )
    db.add(batch)
    db.flush()
    upload = Upload(
        original_filename=f"{source_id}.zip",
        stored_path=f"/tmp/{source_id}.html",
        content_type="application/zip",
        extension=".html",
        sha256=f"{source_id}-sha",
        size_bytes=1,
        batch_id=batch.id,
        batch_position=0,
        created_at=now,
    )
    db.add(upload)
    db.flush()
    job = IngestionJob(
        upload_id=upload.id,
        batch_id=batch.id,
        status=job_status,
        metadata_json=json.dumps({"runtime_version": version.label_slug, "source_id": source_id, "qdrant_collection": qdrant_collection}),
        created_at=now,
        updated_at=now,
    )
    db.add(job)
    db.flush()
    db.add(
        IngestionEvent(
            ingestion_job_id=job.id,
            upload_id=upload.id,
            batch_id=batch.id,
            event_type="queued",
            metadata_json="{}",
            created_at=now,
        )
    )
    source = Source(
        id=source_id,
        upload_id=upload.id,
        title=source_id,
        source_type="ddb_saved_html",
        filename=f"{source_id}.zip",
        metadata_json="{}",
        chunk_count=1,
        created_at=now,
        updated_at=now,
    )
    db.add(source)
    db.flush()
    document = Document(source_id=source.id, title=source_id, ordinal=0, metadata_json="{}", created_at=now)
    db.add(document)
    db.flush()
    section = Section(document_id=document.id, heading_path=source_id, ordinal=0, metadata_json="{}", created_at=now)
    db.add(section)
    db.flush()
    chunk = DocumentChunk(
        upload_id=upload.id,
        ingestion_job_id=job.id,
        source_id=source.id,
        document_id=document.id,
        section_id=section.id,
        chunk_index=0,
        content="chunk",
        content_hash=f"{source_id}-chunk",
        token_count=1,
        metadata_json="{}",
        created_at=now,
    )
    db.add(chunk)
    db.flush()
    db.add(
        IndexedChunk(
            upload_id=upload.id,
            ingestion_job_id=job.id,
            document_chunk_id=chunk.id,
            qdrant_collection=qdrant_collection,
            qdrant_point_id=f"point-{source_id}",
            embedding_model="test",
            embedding_dimensions=3,
            created_at=now,
        )
    )


def _fake_reset_result(*, dry_run: bool) -> object:
    CorpusResetCounts = corpus_reset_module.CorpusResetCounts
    CorpusResetManifest = corpus_reset_module.CorpusResetManifest
    CorpusResetResult = corpus_reset_module.CorpusResetResult

    counts = CorpusResetCounts(
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
    return CorpusResetResult(
        manifest=CorpusResetManifest(
            corpus_version="default-corpus",
            runtime_version_id="runtime-id",
            qdrant_collection="collection",
            dry_run=dry_run,
            delete={"db_rows": counts.__dict__},
            preserve={"active_pointer": "default"},
            counts=counts,
        ),
        deleted=counts,
        archive_sha_before="0" * 64,
        archive_sha_after="0" * 64,
    )


def _snapshot(db: Session) -> dict[str, int]:
    return {
        "runtime_versions": len(db.scalars(select(RuntimeVersion)).all()),
        "active_pointers": len(db.scalars(select(ActiveVersionPointer)).all()),
        "archives": len(db.scalars(select(ImmutableSourceArchive)).all()),
        "sources": len(db.scalars(select(Source)).all()),
        "documents": len(db.scalars(select(Document)).all()),
        "sections": len(db.scalars(select(Section)).all()),
        "chunks": len(db.scalars(select(DocumentChunk)).all()),
        "indexed_chunks": len(db.scalars(select(IndexedChunk)).all()),
        "jobs": len(db.scalars(select(IngestionJob)).all()),
        "uploads": len(db.scalars(select(Upload)).all()),
        "batches": len(db.scalars(select(UploadBatch)).all()),
    }
