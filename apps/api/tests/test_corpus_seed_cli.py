import importlib
import json
import os
from collections.abc import Generator
from pathlib import Path

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

corpus_seed_cli = importlib.import_module("app.cli.corpus_seed")
corpus_seed = importlib.import_module("app.corpus_seed")
config_module = importlib.import_module("app.config")
database_module = importlib.import_module("app.database")
models_module = importlib.import_module("app.models")

from tests.fakes import FakeEmbeddingClient, FakeQdrantIndexer
from tests.rag_support import create_indexed_chunk

Settings = config_module.Settings
Base = database_module.Base
CorpusSeedError = corpus_seed.CorpusSeedError
CorpusSeedService = corpus_seed.CorpusSeedService
ActiveVersionPointer = models_module.ActiveVersionPointer
Document = models_module.Document
DocumentChunk = models_module.DocumentChunk
IndexedChunk = models_module.IndexedChunk
IngestionJob = models_module.IngestionJob
RuntimeVersion = models_module.RuntimeVersion
Source = models_module.Source
Upload = models_module.Upload
UploadBatch = models_module.UploadBatch

TEST_DIR = Path(__file__).resolve().parent
FIXTURE_LOCK = TEST_DIR / "fixtures" / "corpus" / "default-corpus.fixture.lock.json"
FIXTURE_IDENTITY = TEST_DIR / "fixtures" / "corpus" / "default-corpus.fixture.identity.json"
ARCHIVE_ROOT = TEST_DIR / "fixtures" / "ddb_archives"


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


@pytest.fixture()
def settings(tmp_path: Path) -> Settings:
    return Settings(DATABASE_URL="sqlite+pysqlite:///:memory:", UPLOAD_DIR=str(tmp_path / "uploads"), QDRANT_COLLECTION="test_chunks")


def test_help_lists_task5_commands(capsys: pytest.CaptureFixture[str]) -> None:
    with pytest.raises(SystemExit) as exc_info:
        corpus_seed_cli.main(["--help"])

    assert exc_info.value.code == 0
    output = capsys.readouterr().out
    for command in ("preflight", "lock", "seed", "reset", "verify", "doctor"):
        assert command in output


def test_verify_lock_only_fixture_manifest_exits_zero(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    monkeypatch.setattr(corpus_seed_cli, "get_settings", lambda: Settings(DATABASE_URL="sqlite+pysqlite:///:memory:"))

    exit_code = corpus_seed_cli.main(["verify", "--lock-only", "--manifest", str(FIXTURE_LOCK), "--archive-root", str(ARCHIVE_ROOT)])

    assert exit_code == 0
    output = json.loads(capsys.readouterr().out)
    assert output["runtime_version"] == "default-corpus"
    assert [source["source_id"] for source in output["sources"]] == ["phb-2014", "dmg-2014", "mm-2014"]


def test_seed_cli_dry_run_uses_local_schema_fallback(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setattr(corpus_seed_cli, "get_settings", lambda: Settings(DATABASE_URL=corpus_seed_cli.DEFAULT_DOCKER_DATABASE_URL))

    exit_code = corpus_seed_cli.main(
        [
            "seed",
            "--dry-run",
            "--manifest",
            str(FIXTURE_LOCK),
            "--archive-root",
            str(ARCHIVE_ROOT),
            "--version",
            "default-corpus",
        ]
    )

    assert exit_code == 0
    output = json.loads(capsys.readouterr().out)
    assert output["dry_run"] is True
    assert output["enqueue_source_ids"] == ["phb-2014", "dmg-2014", "mm-2014"]


def test_seed_dry_run_no_mutation(db_session: Session, settings: Settings) -> None:
    service = _service(db_session, settings)
    before = _counts(db_session)

    plan = service.seed(manifest_path=FIXTURE_LOCK, archive_root=ARCHIVE_ROOT, version="default-corpus", dry_run=True)

    assert plan.dry_run is True
    assert plan.enqueue_source_ids == ["phb-2014", "dmg-2014", "mm-2014"]
    assert _counts(db_session) == before


def test_seed_validates_archive_hashes_before_enqueue(db_session: Session, settings: Settings, tmp_path: Path) -> None:
    archive_root = tmp_path / "archives"
    archive_root.mkdir()
    for archive in ARCHIVE_ROOT.glob("*.zip"):
        (archive_root / archive.name).write_bytes(archive.read_bytes())
    (archive_root / "mm-2014.zip").write_bytes(b"changed")
    service = _service(db_session, settings)

    with pytest.raises(Exception, match="Archive hash mismatch"):
        service.seed(manifest_path=FIXTURE_LOCK, archive_root=archive_root, version="default-corpus", dry_run=False)

    assert _counts(db_session)["batches"] == 0
    assert _counts(db_session)["jobs"] == 0


def test_seed_waits_for_batch_completion(db_session: Session, settings: Settings) -> None:
    service = _service(db_session, settings)

    result = service.seed(manifest_path=FIXTURE_LOCK, archive_root=ARCHIVE_ROOT, version="default-corpus", dry_run=False)

    assert result.batch_id is not None
    assert result.enqueued_source_ids == ["phb-2014", "dmg-2014", "mm-2014"]
    assert result.verification is not None
    batch = db_session.get(UploadBatch, result.batch_id)
    assert batch is not None
    assert batch.status == "completed"
    assert {job.status for job in db_session.scalars(select(IngestionJob)).all()} == {"completed"}
    assert db_session.scalars(select(ActiveVersionPointer)).all() == []
    assert _source_ids(db_session) == ["dmg-2014", "mm-2014", "phb-2014"]


def test_verify_fixture_success_and_failure(db_session: Session, settings: Settings) -> None:
    service = _service(db_session, settings)
    _ = service.seed(manifest_path=FIXTURE_LOCK, archive_root=ARCHIVE_ROOT, version="default-corpus", dry_run=False)

    verified = service.verify(manifest_path=FIXTURE_LOCK, archive_root=ARCHIVE_ROOT, version="default-corpus")
    assert verified["phb-2014"]["chunks"] == 2

    source = db_session.get(Source, "phb-2014")
    assert source is not None
    source.title = "Wrong title"
    db_session.flush()
    with pytest.raises(CorpusSeedError, match="title mismatch"):
        service.verify(manifest_path=FIXTURE_LOCK, archive_root=ARCHIVE_ROOT, version="default-corpus")


def test_lock_uses_temporary_runtime_and_cleans_up(db_session: Session, settings: Settings, tmp_path: Path) -> None:
    service = _service(db_session, settings)
    output = tmp_path / "generated.lock.json"

    result = service.lock(
        identity_manifest_path=FIXTURE_IDENTITY,
        archive_root=ARCHIVE_ROOT,
        output_path=output,
        temp_version="default-corpus-lock-test",
    )

    assert result.manifest_path == str(output)
    generated = json.loads(output.read_text(encoding="utf-8"))
    fixture = json.loads(FIXTURE_LOCK.read_text(encoding="utf-8"))
    assert generated == fixture
    assert db_session.scalars(select(RuntimeVersion).where(RuntimeVersion.label_slug == "default-corpus-lock-test")).all() == []
    assert db_session.scalars(select(ActiveVersionPointer)).all() == []
    assert db_session.scalars(select(Source)).all() == []


def test_seed_resume_partial_previous_state(db_session: Session, settings: Settings) -> None:
    service = _service(db_session, settings)
    first = service.seed(manifest_path=FIXTURE_LOCK, archive_root=ARCHIVE_ROOT, version="default-corpus", dry_run=False)
    assert first.batch_id is not None
    failed_source = db_session.get(Source, "dmg-2014")
    assert failed_source is not None
    failed_job = db_session.scalars(select(IngestionJob).where(IngestionJob.upload_id == failed_source.upload_id)).one()
    failed_job.status = "failed"
    missing_source = db_session.get(Source, "mm-2014")
    assert missing_source is not None
    service._delete_source_runtime_rows("mm-2014")
    db_session.flush()

    second = service.seed(manifest_path=FIXTURE_LOCK, archive_root=ARCHIVE_ROOT, version="default-corpus", dry_run=False)

    assert second.reused_source_ids == ["phb-2014"]
    assert second.enqueued_source_ids == ["dmg-2014", "mm-2014"]
    assert service.verify(manifest_path=FIXTURE_LOCK, archive_root=ARCHIVE_ROOT, version="default-corpus")
    assert _source_ids(db_session) == ["dmg-2014", "mm-2014", "phb-2014"]
    assert len(db_session.scalars(select(Source).where(Source.id == "phb-2014")).all()) == 1


def test_doctor_reports_active_runtime_scope(db_session: Session, settings: Settings) -> None:
    service = _service(db_session, settings)
    _ = service.seed(manifest_path=FIXTURE_LOCK, archive_root=ARCHIVE_ROOT, version="default-corpus", dry_run=False)
    runtime = db_session.scalars(select(RuntimeVersion).where(RuntimeVersion.label_slug == "default-corpus")).one()
    db_session.add(ActiveVersionPointer(name="default", runtime_version_id=runtime.id))
    db_session.commit()

    report = corpus_seed_cli.build_doctor_report(db=db_session, settings=settings)

    assert report["status"] == "ok"
    assert report["scope_source"] == "active_runtime"
    assert report["selected_qdrant_collection"] == runtime.qdrant_collection
    assert report["selected_indexed_chunks"] == report["indexed_chunks_by_collection"][runtime.qdrant_collection]
    assert report["selected_indexed_chunks"] > 0
    assert report["active_runtime"]["status"] == "ready"


def test_doctor_warns_when_fallback_collection_has_no_indexed_chunks(db_session: Session, settings: Settings) -> None:
    report = corpus_seed_cli.build_doctor_report(db=db_session, settings=settings)

    assert report["status"] == "attention"
    assert report["scope_source"] == "settings_fallback"
    assert report["selected_qdrant_collection"] == settings.qdrant_collection
    assert report["selected_indexed_chunks"] == 0
    assert "No active runtime pointer is configured" in report["remediation"][0]


def test_doctor_warns_when_qdrant_collection_is_missing(monkeypatch: pytest.MonkeyPatch, db_session: Session, settings: Settings) -> None:
    chunk = create_indexed_chunk(db_session, "Indexed only in Postgres.", qdrant_collection="active_chunks")
    runtime = RuntimeVersion(
        id="99999999-9999-4999-8999-999999999999",
        label_slug="default-corpus",
        status="ready",
        database_name="tsv_doctor",
        database_url="postgresql+psycopg://test/test",
        qdrant_collection="active_chunks",
        upload_prefix="versions/doctor/uploads",
        static_prefix="versions/doctor/static",
        runtime_prefix="versions/doctor/runtime",
        source_archive_hash=_archive_hash(db_session),
    )
    db_session.add(runtime)
    db_session.add(ActiveVersionPointer(name="default", runtime_version_id=runtime.id))
    db_session.commit()
    assert chunk.id
    monkeypatch.setattr(
        corpus_seed_cli,
        "_inspect_qdrant_collection",
        lambda *, settings, collection: {"checked": True, "exists": False, "points": None, "error": "collection_not_found"},
    )

    report = corpus_seed_cli.build_doctor_report(db=db_session, settings=settings, check_qdrant=True)

    assert report["status"] == "attention"
    assert report["selected_indexed_chunks"] == 1
    assert report["qdrant"]["exists"] is False
    assert any("restore Qdrant storage" in item for item in report["remediation"])



def _service(db: Session, settings: Settings) -> CorpusSeedService:
    return CorpusSeedService(
        db=db,
        settings=settings,
        embedding_client=FakeEmbeddingClient(dimensions=3),
        qdrant_indexer_factory=lambda collection: FakeQdrantIndexer(collection=collection),
    )


def _archive_hash(db: Session) -> str:
    from app.version_lifecycle import store_immutable_source_archive

    return store_immutable_source_archive(
        db=db,
        settings=Settings(DATABASE_URL="sqlite+pysqlite:///:memory:"),
        content=b"doctor archive",
    ).content_hash


def _counts(db: Session) -> dict[str, int]:
    return {
        "runtime_versions": len(db.scalars(select(RuntimeVersion)).all()),
        "batches": len(db.scalars(select(UploadBatch)).all()),
        "uploads": len(db.scalars(select(Upload)).all()),
        "jobs": len(db.scalars(select(IngestionJob)).all()),
        "sources": len(db.scalars(select(Source)).all()),
        "documents": len(db.scalars(select(Document)).all()),
        "chunks": len(db.scalars(select(DocumentChunk)).all()),
        "indexed_chunks": len(db.scalars(select(IndexedChunk)).all()),
    }


def _source_ids(db: Session) -> list[str]:
    return sorted(source.id for source in db.scalars(select(Source)).all())
