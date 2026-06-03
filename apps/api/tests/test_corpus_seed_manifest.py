import copy
import importlib
import json
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

corpus_manifest = importlib.import_module("app.corpus_manifest")
ddb_import = importlib.import_module("app.ddb_import")

DEFAULT_RUNTIME_VERSION = corpus_manifest.DEFAULT_RUNTIME_VERSION
EXPECTED_COUNT_KEYS = corpus_manifest.EXPECTED_COUNT_KEYS
CorpusManifestError = corpus_manifest.CorpusManifestError
load_corpus_manifest = corpus_manifest.load_corpus_manifest
validate_corpus_manifest = corpus_manifest.validate_corpus_manifest
DDB_PARSER = ddb_import.DDB_PARSER


TEST_DIR = Path(__file__).resolve().parent
MAIN_DIR = TEST_DIR.parents[2]
DEFAULT_MANIFEST_PATH = MAIN_DIR / "apps" / "api" / "corpus" / "default-dndbeyond-corpus.json"
FIXTURE_CORPUS_DIR = TEST_DIR / "fixtures" / "corpus"
FIXTURE_ARCHIVE_ROOT = TEST_DIR / "fixtures" / "ddb_archives"
FIXTURE_IDENTITY_PATH = FIXTURE_CORPUS_DIR / "default-corpus.fixture.identity.json"
FIXTURE_LOCK_PATH = FIXTURE_CORPUS_DIR / "default-corpus.fixture.lock.json"
FIXTURE_ARCHIVE_FILENAMES = ("phb-2014.zip", "dmg-2014.zip", "mm-2014.zip")
EXPECTED_SOURCES = (
    ("phb-2014", "Player's Handbook", "phb-2014.zip"),
    ("dmg-2014", "Dungeon Master's Guide", "dmg-2014.zip"),
    ("mm-2014", "Monster Manual", "mm-2014.zip"),
)


def test_default_identity_manifest_validates_core_trio() -> None:
    manifest = load_corpus_manifest(DEFAULT_MANIFEST_PATH)

    assert manifest.schema_version == 1
    assert manifest.runtime_version == DEFAULT_RUNTIME_VERSION
    assert [(source.source_id, source.title, source.filename) for source in manifest.sources] == list(EXPECTED_SOURCES)
    assert all(source.parser == DDB_PARSER for source in manifest.sources)
    assert all(Path(source.filename).name == source.filename for source in manifest.sources)
    assert not manifest.is_lock_manifest


def test_fixture_identity_manifest_validates_without_archive_bytes() -> None:
    manifest = load_corpus_manifest(FIXTURE_IDENTITY_PATH)

    assert manifest.source_ids == tuple(source_id for source_id, _title, _filename in EXPECTED_SOURCES)
    assert manifest.expected_totals is None


def test_fixture_lock_manifest_validates_counts_and_archives(tmp_path: Path) -> None:
    write_fixture_archives(tmp_path)

    manifest = load_corpus_manifest(FIXTURE_LOCK_PATH, archive_root=tmp_path, require_lock=True)

    assert manifest.is_lock_manifest
    assert manifest.expected_totals == {
        "uploads": 3,
        "jobs": 3,
        "sources": 3,
        "documents": 3,
        "sections": 7,
        "chunks": 7,
        "indexed_chunks": 7,
    }
    assert {key for source in manifest.sources for key in source.expected or {}} == set(EXPECTED_COUNT_KEYS)


@pytest.mark.parametrize(
    ("mutator", "message"),
    [
        (lambda manifest: manifest.pop("runtime_version"), "missing required string field runtime_version"),
        (lambda manifest: manifest["sources"][0].pop("source_id"), "missing required string field source_id"),
        (lambda manifest: manifest["sources"][0].pop("title"), "missing required string field title"),
        (lambda manifest: manifest["sources"][0].pop("filename"), "missing required string field filename"),
        (lambda manifest: manifest["sources"][0].pop("parser"), "missing required string field parser"),
    ],
)
def test_manifest_rejects_missing_fields(mutator: Callable[[dict[str, Any]], object], message: str) -> None:
    raw_manifest = read_json(DEFAULT_MANIFEST_PATH)
    mutator(raw_manifest)

    with pytest.raises(CorpusManifestError, match=message):
        validate_corpus_manifest(raw_manifest)


def test_manifest_rejects_duplicate_source_ids() -> None:
    raw_manifest = read_json(DEFAULT_MANIFEST_PATH)
    raw_manifest["sources"][1] = copy.deepcopy(raw_manifest["sources"][0])

    with pytest.raises(CorpusManifestError, match="Duplicate corpus source_id values: phb-2014"):
        validate_corpus_manifest(raw_manifest)


def test_manifest_rejects_unknown_source_ids() -> None:
    raw_manifest = read_json(DEFAULT_MANIFEST_PATH)
    raw_manifest["sources"][0]["source_id"] = "xgte-2017"

    with pytest.raises(CorpusManifestError, match="Unknown corpus source_id 'xgte-2017'"):
        validate_corpus_manifest(raw_manifest)


@pytest.mark.parametrize("filename", ("/tmp/phb-2014.zip", "../phb-2014.zip", "books/phb-2014.zip", r"..\\phb-2014.zip"))
def test_manifest_rejects_path_traversal_and_non_filename_archives(filename: str) -> None:
    raw_manifest = read_json(DEFAULT_MANIFEST_PATH)
    raw_manifest["sources"][0]["filename"] = filename

    with pytest.raises(CorpusManifestError, match="filename must be"):
        validate_corpus_manifest(raw_manifest)


def test_lock_manifest_rejects_invalid_counts() -> None:
    raw_manifest = read_json(FIXTURE_LOCK_PATH)
    raw_manifest["sources"][0]["expected"]["chunks"] = -1

    with pytest.raises(CorpusManifestError, match="Source phb-2014 expected.chunks must be a non-negative integer"):
        validate_corpus_manifest(raw_manifest, require_lock=True)


def test_lock_manifest_rejects_total_mismatch() -> None:
    raw_manifest = read_json(FIXTURE_LOCK_PATH)
    raw_manifest["expected_totals"]["chunks"] += 1

    with pytest.raises(CorpusManifestError, match="expected_totals.chunks must equal per-source total 7"):
        validate_corpus_manifest(raw_manifest, require_lock=True)


def test_lock_manifest_rejects_missing_archive(tmp_path: Path) -> None:
    write_fixture_archives(tmp_path, skip="dmg-2014.zip")

    with pytest.raises(CorpusManifestError, match="Archive for source dmg-2014 is missing"):
        load_corpus_manifest(FIXTURE_LOCK_PATH, archive_root=tmp_path, require_lock=True)


def test_lock_manifest_rejects_hash_mismatch(tmp_path: Path) -> None:
    write_fixture_archives(tmp_path)
    (tmp_path / "mm-2014.zip").write_bytes(b"changed fixture bytes\n")

    with pytest.raises(CorpusManifestError, match="Archive hash mismatch for source mm-2014"):
        load_corpus_manifest(FIXTURE_LOCK_PATH, archive_root=tmp_path, require_lock=True)


def test_manifest_rejects_title_mismatch() -> None:
    raw_manifest = read_json(DEFAULT_MANIFEST_PATH)
    raw_manifest["sources"][0]["title"] = "Players Handbook"

    with pytest.raises(CorpusManifestError, match="Source phb-2014 title must be"):
        validate_corpus_manifest(raw_manifest)


def test_require_lock_rejects_identity_manifest() -> None:
    raw_manifest = read_json(DEFAULT_MANIFEST_PATH)

    with pytest.raises(CorpusManifestError, match="Lock manifest requires sha256"):
        validate_corpus_manifest(raw_manifest, require_lock=True)


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_fixture_archives(path: Path, *, skip: str | None = None) -> None:
    for filename in FIXTURE_ARCHIVE_FILENAMES:
        if filename != skip:
            (path / filename).write_bytes((FIXTURE_ARCHIVE_ROOT / filename).read_bytes())
