import json
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.archive_storage import ARCHIVE_ROOT_NAME, ARCHIVE_SOURCE_TYPE, ArchiveValidationError, archive_served_html_path
from app.config import Settings
from app.models import IngestionJob, Source, Upload, utcnow


def repair_archive_source(db: Session, source_id: str, settings: Settings) -> Source | None:
    source = db.get(Source, source_id)
    if source is not None and source.source_type != ARCHIVE_SOURCE_TYPE:
        return None

    manifest = _archive_manifest(source_id, settings)
    job, job_metadata = _archive_job(db, source_id)
    metadata = _repair_metadata(source, manifest, job_metadata)
    if metadata is None:
        return source

    served_html_path = metadata.get("archive_served_html_path") or metadata.get("archive_served_entry_path")
    if not isinstance(served_html_path, str) or not _served_html_exists(source_id, served_html_path, settings):
        return source

    now = utcnow()
    if source is None:
        if job is None:
            return None
        upload = db.get(Upload, job.upload_id)
        if upload is None:
            return None
        source = Source(
            id=source_id,
            upload_id=upload.id,
            title=_source_title(metadata, upload),
            source_type=ARCHIVE_SOURCE_TYPE,
            filename=upload.original_filename or str(metadata.get("original_filename") or "archive.zip"),
            metadata_json=_json_dumps(metadata),
            chunk_count=_metadata_int(metadata.get("chunk_count")),
            created_at=now,
            updated_at=now,
        )
        db.add(source)
    else:
        source.metadata_json = _json_dumps(metadata)
        source.updated_at = now
    db.commit()
    db.refresh(source)
    return source


def _archive_manifest(source_id: str, settings: Settings) -> dict[str, Any]:
    manifest_path = Path(settings.upload_dir) / ARCHIVE_ROOT_NAME / source_id / "manifest.json"
    if not manifest_path.exists() or not manifest_path.is_file():
        return {}
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    if not isinstance(manifest, dict):
        return {}
    manifest_source_id = manifest.get("source_id")
    if isinstance(manifest_source_id, str) and manifest_source_id and manifest_source_id != source_id:
        return {}
    return manifest


def _archive_job(db: Session, source_id: str) -> tuple[IngestionJob | None, dict[str, Any]]:
    for job in db.scalars(select(IngestionJob).order_by(IngestionJob.created_at.desc())):
        metadata = _json_loads(job.metadata_json)
        if metadata.get("source_id") == source_id and metadata.get("source_type") == ARCHIVE_SOURCE_TYPE:
            return job, metadata
    return None, {}


def _repair_metadata(source: Source | None, manifest: dict[str, Any], job_metadata: dict[str, Any]) -> dict[str, Any] | None:
    metadata = _json_loads(source.metadata_json) if source is not None else {}
    repaired = dict(metadata)

    if job_metadata:
        repaired = _merge_archive_metadata(repaired, job_metadata)
    if manifest:
        repaired = _merge_manifest_metadata(repaired, manifest)

    if source is None and repaired.get("source_type") != ARCHIVE_SOURCE_TYPE:
        return None
    return repaired


def _merge_archive_metadata(metadata: dict[str, Any], archive_metadata: dict[str, Any]) -> dict[str, Any]:
    repaired = dict(metadata)
    for key in (
        "source_id",
        "source_type",
        "source_url",
        "title",
        "chunk_count",
        "content_type",
        "sha256",
        "parser",
        "archive_entry_path",
        "archive_primary_html_path",
        "archive_served_entry_path",
        "archive_served_html_path",
        "archive_anchor_map_path",
        "archive_file_count",
        "archive_extracted_size_bytes",
    ):
        value = archive_metadata.get(key)
        if value is not None and value != "":
            repaired[key] = value
    return repaired


def _merge_manifest_metadata(metadata: dict[str, Any], manifest: dict[str, Any]) -> dict[str, Any]:
    repaired = dict(metadata)
    mapping = {
        "source_id": "source_id",
        "source_type": "source_type",
        "source_url": "source_url",
        "original_sha256": "sha256",
        "primary_html_path": "archive_primary_html_path",
        "served_html_path": "archive_served_html_path",
        "anchor_map_path": "archive_anchor_map_path",
        "file_count": "archive_file_count",
        "extracted_size_bytes": "archive_extracted_size_bytes",
    }
    for manifest_key, metadata_key in mapping.items():
        value = manifest.get(manifest_key)
        if value is not None and value != "":
            repaired[metadata_key] = value

    primary_path = manifest.get("primary_html_path")
    if isinstance(primary_path, str) and primary_path:
        repaired["archive_entry_path"] = primary_path
    served_path = manifest.get("served_html_path")
    if isinstance(served_path, str) and served_path:
        repaired["archive_served_entry_path"] = served_path
    repaired["source_type"] = ARCHIVE_SOURCE_TYPE
    return repaired


def _served_html_exists(source_id: str, served_html_path: str, settings: Settings) -> bool:
    try:
        archive_served_html_path(source_id=source_id, served_html_path=served_html_path, settings=settings)
    except (ArchiveValidationError, FileNotFoundError):
        return False
    return True


def _json_loads(value: str | None) -> dict[str, Any]:
    try:
        loaded = json.loads(value or "{}")
    except json.JSONDecodeError:
        return {}
    return loaded if isinstance(loaded, dict) else {}


def _json_dumps(metadata: dict[str, Any]) -> str:
    return json.dumps(metadata, sort_keys=True, separators=(",", ":"))


def _metadata_int(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _source_title(metadata: dict[str, Any], upload: Upload) -> str:
    title = metadata.get("title") or metadata.get("source_url") or upload.original_filename
    return str(title)[:255]
