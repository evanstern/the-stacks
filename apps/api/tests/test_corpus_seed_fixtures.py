import hashlib
import importlib
import io
import json
import zipfile
from dataclasses import dataclass
from collections.abc import Iterable
from pathlib import Path
from typing import Callable, Literal, Protocol, TypedDict, cast

import pytest


CountKey = Literal["uploads", "jobs", "sources", "documents", "sections", "chunks", "indexed_chunks"]


class ExpectedCounts(TypedDict):
    uploads: int
    jobs: int
    sources: int
    documents: int
    sections: int
    chunks: int
    indexed_chunks: int


class FixtureLockSource(TypedDict):
    source_id: str
    title: str
    filename: str
    parser: str
    sha256: str
    expected: ExpectedCounts


class FixtureLockManifest(TypedDict):
    schema_version: int
    runtime_version: str
    sources: list[FixtureLockSource]
    expected_totals: ExpectedCounts


class DdbImportResult(Protocol):
    title: str | None
    sections: list[object]
    chunks: list[object]


ddb_import_module = importlib.import_module("app.ddb_import")
DDB_PARSER = cast(str, getattr(ddb_import_module, "DDB_PARSER"))
parse_ddb_saved_html = cast(Callable[[bytes], DdbImportResult], getattr(ddb_import_module, "parse_ddb_saved_html"))


FIXTURE_ROOT = Path(__file__).resolve().parent / "fixtures"
CORPUS_FIXTURE_ROOT = FIXTURE_ROOT / "corpus"
ARCHIVE_FIXTURE_ROOT = FIXTURE_ROOT / "ddb_archives"
COUNT_KEYS: tuple[CountKey, ...] = ("uploads", "jobs", "sources", "documents", "sections", "chunks", "indexed_chunks")
ZIP_TIMESTAMP = (2024, 1, 1, 0, 0, 0)


@dataclass(frozen=True)
class SyntheticSource:
    source_id: str
    title: str
    filename: str
    html_filename: str


@dataclass(frozen=True)
class VerificationMismatch:
    source_id: str
    count_key: str
    expected: int
    actual: int


class FixtureCountMismatchError(AssertionError):
    def __init__(self, mismatches: list[VerificationMismatch]) -> None:
        self.mismatches: list[VerificationMismatch] = mismatches
        details = ", ".join(
            f"{mismatch.source_id}.{mismatch.count_key}: expected {mismatch.expected}, got {mismatch.actual}"
            for mismatch in mismatches
        )
        super().__init__(f"fixture count mismatch: {details}")


SYNTHETIC_SOURCES = (
    SyntheticSource("phb-2014", "Player's Handbook", "phb-2014.zip", "phb-2014-ddb.html"),
    SyntheticSource("dmg-2014", "Dungeon Master's Guide", "dmg-2014.zip", "dmg-2014-ddb.html"),
    SyntheticSource("mm-2014", "Monster Manual", "mm-2014.zip", "mm-2014-ddb.html"),
)

EXPECTED_FIXTURE_LOCK: FixtureLockManifest = {
    "schema_version": 1,
    "runtime_version": "default-corpus",
    "sources": [
        {
            "source_id": "phb-2014",
            "title": "Player's Handbook",
            "filename": "phb-2014.zip",
            "parser": "ddb_saved_html",
            "sha256": "91b3ca9bf9d14c794e7358f8181fdcffa22170d6fe5c7f9f972b306b5c04e1bd",
            "expected": {
                "uploads": 1,
                "jobs": 1,
                "sources": 1,
                "documents": 1,
                "sections": 2,
                "chunks": 2,
                "indexed_chunks": 2,
            },
        },
        {
            "source_id": "dmg-2014",
            "title": "Dungeon Master's Guide",
            "filename": "dmg-2014.zip",
            "parser": "ddb_saved_html",
            "sha256": "35ef4b99f2d3bf38a27aa6f88f0a0b606ac40784ded7ace4a1d31a707d064af8",
            "expected": {
                "uploads": 1,
                "jobs": 1,
                "sources": 1,
                "documents": 1,
                "sections": 3,
                "chunks": 3,
                "indexed_chunks": 3,
            },
        },
        {
            "source_id": "mm-2014",
            "title": "Monster Manual",
            "filename": "mm-2014.zip",
            "parser": "ddb_saved_html",
            "sha256": "3cb76d7fa68ea4e609721cc4d9c05d0f50736e5434e63effce0f4ff4ec098a9d",
            "expected": {
                "uploads": 1,
                "jobs": 1,
                "sources": 1,
                "documents": 1,
                "sections": 2,
                "chunks": 2,
                "indexed_chunks": 2,
            },
        },
    ],
    "expected_totals": {
        "uploads": 3,
        "jobs": 3,
        "sources": 3,
        "documents": 3,
        "sections": 7,
        "chunks": 7,
        "indexed_chunks": 7,
    },
}


def test_fixture_archives_match_lock_manifest() -> None:
    generated_lock = generate_fixture_lock_manifest(write_archives=True)

    assert generated_lock == EXPECTED_FIXTURE_LOCK


def test_fixture_archives_extract_parser_and_titles() -> None:
    generated_lock = generate_fixture_lock_manifest(write_archives=True)

    assert [source["source_id"] for source in generated_lock["sources"]] == ["phb-2014", "dmg-2014", "mm-2014"]
    assert [source["title"] for source in generated_lock["sources"]] == [
        "Player's Handbook",
        "Dungeon Master's Guide",
        "Monster Manual",
    ]
    assert {source["parser"] for source in generated_lock["sources"]} == {DDB_PARSER}


def test_verify_accepts_exact_fixture_counts() -> None:
    actual_counts = fixture_count_snapshot(EXPECTED_FIXTURE_LOCK)

    verify_fixture_counts(EXPECTED_FIXTURE_LOCK, actual_counts)


def test_verify_fails_on_count_mismatch() -> None:
    actual_counts = fixture_count_snapshot(EXPECTED_FIXTURE_LOCK)
    actual_counts["dmg-2014"] = {**actual_counts["dmg-2014"], "chunks": 4, "indexed_chunks": 4}

    with pytest.raises(FixtureCountMismatchError) as exc_info:
        verify_fixture_counts(EXPECTED_FIXTURE_LOCK, actual_counts)

    assert [(mismatch.source_id, mismatch.count_key, mismatch.expected, mismatch.actual) for mismatch in exc_info.value.mismatches] == [
        ("dmg-2014", "chunks", 3, 4),
        ("dmg-2014", "indexed_chunks", 3, 4),
    ]


def generate_fixture_lock_manifest(*, write_archives: bool) -> FixtureLockManifest:
    manifest_sources: list[FixtureLockSource] = []
    for source in SYNTHETIC_SOURCES:
        html_path = CORPUS_FIXTURE_ROOT / source.html_filename
        html_bytes = html_path.read_bytes()
        archive_bytes = build_deterministic_ddb_archive(source, html_bytes)
        archive_path = ARCHIVE_FIXTURE_ROOT / source.filename
        if write_archives:
            ARCHIVE_FIXTURE_ROOT.mkdir(parents=True, exist_ok=True)
            if not archive_path.exists() or archive_path.read_bytes() != archive_bytes:
                _ = archive_path.write_bytes(archive_bytes)

        archive_html = extract_primary_html(archive_bytes)
        ddb_import = parse_ddb_saved_html(archive_html)
        assert ddb_import.title == source.title
        counts: ExpectedCounts = {
            "uploads": 1,
            "jobs": 1,
            "sources": 1,
            "documents": 1,
            "sections": len(ddb_import.sections),
            "chunks": len(ddb_import.chunks),
            "indexed_chunks": len(ddb_import.chunks),
        }
        manifest_sources.append(
            {
                "source_id": source.source_id,
                "title": source.title,
                "filename": source.filename,
                "parser": DDB_PARSER,
                "sha256": hashlib.sha256(archive_bytes).hexdigest(),
                "expected": counts,
            }
        )

    return {
        "schema_version": 1,
        "runtime_version": "default-corpus",
        "sources": manifest_sources,
        "expected_totals": sum_expected_counts(source["expected"] for source in manifest_sources),
    }


def build_deterministic_ddb_archive(source: SyntheticSource, html_bytes: bytes) -> bytes:
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w") as zip_file:
        html_info = zipfile.ZipInfo(f"{source.source_id}/index.html", date_time=ZIP_TIMESTAMP)
        html_info.compress_type = zipfile.ZIP_STORED
        html_info.external_attr = 0o644 << 16
        zip_file.writestr(html_info, html_bytes)

        metadata_info = zipfile.ZipInfo(f"{source.source_id}/metadata.json", date_time=ZIP_TIMESTAMP)
        metadata_info.compress_type = zipfile.ZIP_STORED
        metadata_info.external_attr = 0o644 << 16
        metadata = json.dumps(
            {"source_id": source.source_id, "title": source.title, "parser": DDB_PARSER},
            ensure_ascii=False,
            sort_keys=True,
        ).encode("utf-8")
        zip_file.writestr(metadata_info, metadata)
    return archive.getvalue()


def extract_primary_html(archive_bytes: bytes) -> bytes:
    with zipfile.ZipFile(io.BytesIO(archive_bytes)) as zip_file:
        html_members = sorted(name for name in zip_file.namelist() if name.endswith(".html"))
        assert len(html_members) == 1
        return zip_file.read(html_members[0])


def sum_expected_counts(count_sets: Iterable[ExpectedCounts]) -> ExpectedCounts:
    totals: ExpectedCounts = {
        "uploads": 0,
        "jobs": 0,
        "sources": 0,
        "documents": 0,
        "sections": 0,
        "chunks": 0,
        "indexed_chunks": 0,
    }
    for counts in count_sets:
        for key in COUNT_KEYS:
            totals[key] += counts[key]
    return totals


def fixture_count_snapshot(lock_manifest: FixtureLockManifest) -> dict[str, ExpectedCounts]:
    return {source["source_id"]: copy_expected_counts(source["expected"]) for source in lock_manifest["sources"]}


def copy_expected_counts(counts: ExpectedCounts) -> ExpectedCounts:
    return {
        "uploads": counts["uploads"],
        "jobs": counts["jobs"],
        "sources": counts["sources"],
        "documents": counts["documents"],
        "sections": counts["sections"],
        "chunks": counts["chunks"],
        "indexed_chunks": counts["indexed_chunks"],
    }


def verify_fixture_counts(lock_manifest: FixtureLockManifest, actual_counts: dict[str, ExpectedCounts]) -> None:
    mismatches: list[VerificationMismatch] = []
    for source in lock_manifest["sources"]:
        source_id = source["source_id"]
        expected = source["expected"]
        actual = actual_counts[source_id]
        for key in COUNT_KEYS:
            if actual[key] != expected[key]:
                mismatches.append(VerificationMismatch(source_id, key, expected[key], actual[key]))
    if mismatches:
        raise FixtureCountMismatchError(mismatches)
