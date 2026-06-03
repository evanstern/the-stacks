import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import TypeAlias

from .ddb_import import DDB_PARSER


JsonObject: TypeAlias = dict[str, object]


SCHEMA_VERSION = 1
DEFAULT_RUNTIME_VERSION = "default-corpus"
EXPECTED_COUNT_KEYS = (
    "uploads",
    "jobs",
    "sources",
    "documents",
    "sections",
    "chunks",
    "indexed_chunks",
)
DEFAULT_SOURCE_IDENTITIES = {
    "phb-2014": {
        "title": "Player's Handbook",
        "filename": "phb-2014.zip",
    },
    "dmg-2014": {
        "title": "Dungeon Master's Guide",
        "filename": "dmg-2014.zip",
    },
    "mm-2014": {
        "title": "Monster Manual",
        "filename": "mm-2014.zip",
    },
}
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")


class CorpusManifestError(ValueError):
    pass


@dataclass(frozen=True)
class CorpusSource:
    source_id: str
    title: str
    filename: str
    parser: str
    sha256: str | None = None
    expected: dict[str, int] | None = None


@dataclass(frozen=True)
class CorpusManifest:
    schema_version: int
    runtime_version: str
    sources: tuple[CorpusSource, ...]
    expected_totals: dict[str, int] | None = None

    @property
    def source_ids(self) -> tuple[str, ...]:
        return tuple(source.source_id for source in self.sources)

    @property
    def is_lock_manifest(self) -> bool:
        return self.expected_totals is not None or any(source.sha256 is not None or source.expected is not None for source in self.sources)


def load_corpus_manifest(path: Path | str, *, archive_root: Path | str | None = None, require_lock: bool = False) -> CorpusManifest:
    manifest_path = Path(path)
    try:
        raw_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise CorpusManifestError(f"Invalid corpus manifest JSON: {exc.msg}") from exc
    return validate_corpus_manifest(raw_manifest, archive_root=archive_root, require_lock=require_lock)


def validate_corpus_manifest(
    raw_manifest: object,
    *,
    archive_root: Path | str | None = None,
    require_lock: bool = False,
) -> CorpusManifest:
    if not isinstance(raw_manifest, dict):
        raise CorpusManifestError("Corpus manifest must be a JSON object")
    raw_manifest_object = _json_object(raw_manifest, "Corpus manifest")
    schema_version = _required_int(raw_manifest_object, "schema_version")
    if schema_version != SCHEMA_VERSION:
        raise CorpusManifestError(f"Unsupported corpus manifest schema_version {schema_version}")
    runtime_version = _required_str(raw_manifest_object, "runtime_version")
    if runtime_version != DEFAULT_RUNTIME_VERSION:
        raise CorpusManifestError(f"Unsupported corpus runtime_version {runtime_version!r}")
    raw_sources = raw_manifest_object.get("sources")
    if not isinstance(raw_sources, list):
        raise CorpusManifestError("Corpus manifest sources must be a list")

    sources = tuple(_validate_source(raw_source) for raw_source in raw_sources)
    _validate_complete_source_set(sources)

    expected_totals = raw_manifest_object.get("expected_totals")
    is_lock_manifest = expected_totals is not None or any(source.sha256 is not None or source.expected is not None for source in sources)
    if require_lock and not is_lock_manifest:
        raise CorpusManifestError("Lock manifest requires sha256, per-source expected counts, and expected_totals")
    if is_lock_manifest:
        if expected_totals is None:
            raise CorpusManifestError("Lock manifest missing expected_totals")
        validated_totals = _validate_counts(expected_totals, "expected_totals")
        for source in sources:
            if source.sha256 is None:
                raise CorpusManifestError(f"Source {source.source_id} missing sha256")
            if source.expected is None:
                raise CorpusManifestError(f"Source {source.source_id} missing expected counts")
        _validate_expected_totals(sources, validated_totals)
    else:
        validated_totals = None

    manifest = CorpusManifest(
        schema_version=schema_version,
        runtime_version=runtime_version,
        sources=sources,
        expected_totals=validated_totals,
    )
    if archive_root is not None:
        validate_manifest_archives(manifest, Path(archive_root))
    return manifest


def validate_manifest_archives(manifest: CorpusManifest, archive_root: Path) -> None:
    for source in manifest.sources:
        archive_path = archive_root / source.filename
        if not archive_path.is_file():
            raise CorpusManifestError(f"Archive for source {source.source_id} is missing: {source.filename}")
        if source.sha256 is not None:
            actual_sha256 = hashlib.sha256(archive_path.read_bytes()).hexdigest()
            if actual_sha256 != source.sha256:
                raise CorpusManifestError(f"Archive hash mismatch for source {source.source_id}")


def _validate_source(raw_source: object) -> CorpusSource:
    if not isinstance(raw_source, dict):
        raise CorpusManifestError("Corpus manifest source entries must be objects")
    raw_source_object = _json_object(raw_source, "Corpus manifest source")
    source_id = _required_str(raw_source_object, "source_id")
    expected_identity = DEFAULT_SOURCE_IDENTITIES.get(source_id)
    if expected_identity is None:
        raise CorpusManifestError(f"Unknown corpus source_id {source_id!r}")

    title = _required_str(raw_source_object, "title")
    if title != expected_identity["title"]:
        raise CorpusManifestError(f"Source {source_id} title must be {expected_identity['title']!r}")
    filename = _required_str(raw_source_object, "filename")
    _validate_safe_filename(filename, source_id)
    if filename != expected_identity["filename"]:
        raise CorpusManifestError(f"Source {source_id} filename must be {expected_identity['filename']!r}")
    parser = _required_str(raw_source_object, "parser")
    if parser != DDB_PARSER:
        raise CorpusManifestError(f"Source {source_id} parser must be {DDB_PARSER!r}")

    raw_sha256 = raw_source_object.get("sha256")
    sha256 = None
    if raw_sha256 is not None:
        if not isinstance(raw_sha256, str) or not SHA256_PATTERN.fullmatch(raw_sha256):
            raise CorpusManifestError(f"Source {source_id} sha256 must be a lowercase 64-character hex string")
        sha256 = raw_sha256

    raw_expected = raw_source_object.get("expected")
    expected = _validate_counts(raw_expected, f"Source {source_id} expected") if raw_expected is not None else None
    return CorpusSource(source_id=source_id, title=title, filename=filename, parser=parser, sha256=sha256, expected=expected)


def _validate_complete_source_set(sources: tuple[CorpusSource, ...]) -> None:
    seen: set[str] = set()
    duplicates: set[str] = set()
    for source in sources:
        if source.source_id in seen:
            duplicates.add(source.source_id)
        seen.add(source.source_id)
    if duplicates:
        raise CorpusManifestError(f"Duplicate corpus source_id values: {', '.join(sorted(duplicates))}")
    expected_ids = set(DEFAULT_SOURCE_IDENTITIES)
    actual_ids = {source.source_id for source in sources}
    missing = expected_ids - actual_ids
    extra = actual_ids - expected_ids
    if missing:
        raise CorpusManifestError(f"Corpus manifest missing required source IDs: {', '.join(sorted(missing))}")
    if extra:
        raise CorpusManifestError(f"Corpus manifest contains unknown source IDs: {', '.join(sorted(extra))}")


def _validate_safe_filename(filename: str, source_id: str) -> None:
    posix_path = PurePosixPath(filename)
    windows_path = PureWindowsPath(filename)
    if filename != posix_path.name or posix_path.is_absolute() or windows_path.is_absolute() or ".." in posix_path.parts:
        raise CorpusManifestError(f"Source {source_id} filename must be a relative archive filename without traversal")
    if filename != windows_path.name or ".." in windows_path.parts:
        raise CorpusManifestError(f"Source {source_id} filename must be a relative archive filename without traversal")
    if not filename.endswith(".zip"):
        raise CorpusManifestError(f"Source {source_id} filename must end with .zip")


def _validate_counts(raw_counts: object, label: str) -> dict[str, int]:
    if not isinstance(raw_counts, dict):
        raise CorpusManifestError(f"{label} must be an object")
    raw_counts_object = _json_object(raw_counts, label)
    counts: dict[str, int] = {}
    for key in EXPECTED_COUNT_KEYS:
        value = raw_counts_object.get(key)
        if not isinstance(value, int) or isinstance(value, bool) or value < 0:
            raise CorpusManifestError(f"{label}.{key} must be a non-negative integer")
        counts[key] = value
    extra_keys = set(raw_counts_object) - set(EXPECTED_COUNT_KEYS)
    if extra_keys:
        raise CorpusManifestError(f"{label} contains unknown count keys: {', '.join(sorted(extra_keys))}")
    return counts


def _validate_expected_totals(sources: tuple[CorpusSource, ...], expected_totals: dict[str, int]) -> None:
    for key in EXPECTED_COUNT_KEYS:
        total = sum(source.expected[key] for source in sources if source.expected is not None)
        if expected_totals[key] != total:
            raise CorpusManifestError(f"expected_totals.{key} must equal per-source total {total}")


def _required_str(raw_object: JsonObject, key: str) -> str:
    value = raw_object.get(key)
    if not isinstance(value, str) or not value:
        raise CorpusManifestError(f"Corpus manifest missing required string field {key}")
    return value


def _required_int(raw_object: JsonObject, key: str) -> int:
    value = raw_object.get(key)
    if not isinstance(value, int) or isinstance(value, bool):
        raise CorpusManifestError(f"Corpus manifest missing required integer field {key}")
    return value


def _json_object(value: object, label: str) -> JsonObject:
    if not isinstance(value, dict):
        raise CorpusManifestError(f"{label} must be an object")
    return value
