import hashlib
import importlib
import os
from collections.abc import Generator, Sequence
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

corpus_seed_cli = importlib.import_module("app.cli.corpus_seed")
corpus_reset_module = importlib.import_module("app.corpus_reset")
corpus_seed_module = importlib.import_module("app.corpus_seed")
config_module = importlib.import_module("app.config")
database_module = importlib.import_module("app.database")
models_module = importlib.import_module("app.models")
qdrant_index_module = importlib.import_module("app.qdrant_index")
version_lifecycle_module = importlib.import_module("app.version_lifecycle")
from tests.fakes import FakeEmbeddingClient, FakeQdrantIndexer

Settings = config_module.Settings
Base = database_module.Base
CorpusResetService = corpus_reset_module.CorpusResetService
CorpusSeedService = corpus_seed_module.CorpusSeedService
ActiveVersionPointer = models_module.ActiveVersionPointer
Document = models_module.Document
DocumentChunk = models_module.DocumentChunk
ImmutableSourceArchive = models_module.ImmutableSourceArchive
IndexedChunk = models_module.IndexedChunk
IngestionJob = models_module.IngestionJob
RuntimeVersion = models_module.RuntimeVersion
Section = models_module.Section
Source = models_module.Source
Upload = models_module.Upload
QdrantIndexer = qdrant_index_module.QdrantIndexer
VersionLifecycleService = version_lifecycle_module.VersionLifecycleService

TEST_DIR = Path(__file__).resolve().parent
FIXTURE_LOCK = TEST_DIR / "fixtures" / "corpus" / "default-corpus.fixture.lock.json"
ARCHIVE_ROOT = TEST_DIR / "fixtures" / "ddb_archives"
DEFAULT_SOURCE_IDS = ["dmg-2014", "mm-2014", "phb-2014"]
EXPECTED_TOTALS = {
    "uploads": 3,
    "jobs": 3,
    "sources": 3,
    "documents": 3,
    "sections": 7,
    "chunks": 7,
    "indexed_chunks": 7,
}


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


@pytest.fixture()
def settings(tmp_path: Path) -> Settings:
    return Settings(DATABASE_URL="sqlite+pysqlite:///:memory:", UPLOAD_DIR=str(tmp_path / "uploads"), QDRANT_COLLECTION="test_chunks")


def test_fixture_reset_seed_verify_repeatable(db_session: Session, settings: Settings) -> None:
    active_version_id = _create_active_runtime(db_session, settings)
    seed_service = _seed_service(db_session, settings)
    reset_backend = RecordingResetBackend()
    reset_service = CorpusResetService(db=db_session, settings=settings, backend=reset_backend)

    first = _run_seed_verify_cycle(seed_service, db_session)
    target = _runtime(db_session)
    archive_hash = target.source_archive_hash
    archive_path = _runtime_archive_path(db_session, archive_hash)
    archive_sha_before_reset = _sha256(archive_path)
    active_pointer_before = _active_pointer_id(db_session)
    retained_archive_paths = _source_archive_paths(settings)
    assert retained_archive_paths

    reset = reset_service.reset(version="default-corpus", confirm_version="default-corpus")
    assert reset.archive_sha_before == archive_sha_before_reset
    assert reset.archive_sha_after == archive_sha_before_reset == archive_hash
    assert _sha256(archive_path) == archive_sha_before_reset
    assert _active_pointer_id(db_session) == active_pointer_before == active_version_id
    assert all(path.exists() for path in retained_archive_paths)

    second = _run_seed_verify_cycle(seed_service, db_session)

    assert second == first
    assert second["source_ids"] == DEFAULT_SOURCE_IDS
    assert second["totals"] == EXPECTED_TOTALS
    assert _active_pointer_id(db_session) == active_pointer_before
    assert _runtime(db_session).source_archive_hash == archive_hash
    assert _sha256(archive_path) == archive_sha_before_reset
    assert all(path.exists() for path in retained_archive_paths)
    assert _duplicate_source_ids(db_session) == []
    assert _target_row_counts(db_session) == EXPECTED_TOTALS


def test_real_corpus_command_shape_reports_missing_archives_without_traceback(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    parsed = corpus_seed_cli.build_parser().parse_args(["verify", "--archive-root", "/data/uploads/sourcebooks", "--lock-only"])
    assert parsed.manifest == corpus_seed_cli.DEFAULT_LOCK_MANIFEST
    assert parsed.archive_root == Path("/data/uploads/sourcebooks")

    missing_archive_root = tmp_path / "sourcebooks"
    missing_archive_root.mkdir()
    lock_manifest = tmp_path / "default-dndbeyond-corpus.lock.json"
    _ = lock_manifest.write_text(FIXTURE_LOCK.read_text(encoding="utf-8"), encoding="utf-8")
    monkeypatch.setattr(corpus_seed_cli, "get_settings", lambda: Settings(DATABASE_URL="sqlite+pysqlite:///:memory:"))

    exit_code = corpus_seed_cli.main(
        [
            "verify",
            "--lock-only",
            "--manifest",
            str(lock_manifest),
            "--archive-root",
            str(missing_archive_root),
        ]
    )

    captured = capsys.readouterr()
    assert exit_code != 0
    assert "Archive for source phb-2014 is missing: phb-2014.zip" in captured.err
    assert "Traceback" not in captured.err
    assert captured.out == ""


def _seed_service(db: Session, settings: Any) -> Any:
    def qdrant_indexer(collection: str) -> Any:
        return FakeQdrantIndexer(collection=collection)

    return CorpusSeedService(
        db=db,
        settings=settings,
        embedding_client=FakeEmbeddingClient(dimensions=3),
        qdrant_indexer_factory=qdrant_indexer,
    )


def _create_active_runtime(db: Session, settings: Any) -> str:
    lifecycle = VersionLifecycleService(db=db, settings=settings)
    active = lifecycle.create_version_namespaces(
        version_id="33333333-3333-4333-8333-333333333333",
        label="active-runtime",
        archive_bytes=b"active runtime archive",
        original_filename="active-runtime.zip",
    ).version
    active.status = "ready"
    db.flush()
    _ = lifecycle.activate_runtime_version(active.id)
    return active.id


def _run_seed_verify_cycle(seed_service: Any, db: Session) -> dict[str, object]:
    result = seed_service.seed(manifest_path=FIXTURE_LOCK, archive_root=ARCHIVE_ROOT, version="default-corpus")
    assert result.verification is not None
    verified = seed_service.verify(manifest_path=FIXTURE_LOCK, archive_root=ARCHIVE_ROOT, version="default-corpus")
    assert verified == result.verification
    return {
        "source_ids": sorted(verified),
        "per_source": {source_id: dict(verified[source_id]) for source_id in sorted(verified)},
        "totals": _target_row_counts(db),
    }


def _runtime(db: Session) -> Any:
    runtime = db.scalars(select(RuntimeVersion).where(RuntimeVersion.label_slug == "default-corpus")).one()
    assert runtime.status == "ready"
    return runtime


def _runtime_archive_path(db: Session, archive_hash: str) -> Path:
    archive = db.get(ImmutableSourceArchive, archive_hash)
    assert archive is not None
    return Path(archive.storage_path)


def _active_pointer_id(db: Session) -> str:
    pointer = db.get(ActiveVersionPointer, "default")
    assert pointer is not None
    return pointer.runtime_version_id


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _source_archive_paths(settings: Any) -> list[Path]:
    root = Path(settings.upload_dir) / "source-archives"
    return sorted(path for path in root.iterdir() if path.is_dir()) if root.exists() else []


def _duplicate_source_ids(db: Session) -> list[str]:
    rows = db.execute(select(Source.id).group_by(Source.id).having(func.count(Source.id) > 1)).all()
    return [row[0] for row in rows]


def _target_row_counts(db: Session) -> dict[str, int]:
    return {
        "uploads": len(db.scalars(select(Upload)).all()),
        "jobs": len(db.scalars(select(IngestionJob)).all()),
        "sources": len(db.scalars(select(Source)).all()),
        "documents": len(db.scalars(select(Document)).all()),
        "sections": len(db.scalars(select(Section)).all()),
        "chunks": len(db.scalars(select(DocumentChunk)).all()),
        "indexed_chunks": len(db.scalars(select(IndexedChunk)).all()),
    }
