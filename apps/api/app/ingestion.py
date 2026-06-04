import html
import json
import re
import io
import traceback
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from typing import override, cast
from uuid import NAMESPACE_URL, uuid5
import zipfile

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.ddb_import import DDB_PARSER, is_ddb_saved_html, parse_ddb_saved_html
from app.embeddings import EmbeddingClient, get_embedding_client
from app.etl.contracts import (
    ArchiveLocator,
    NormalizedDocument,
    NormalizedSection,
    PluginMetadata,
    PluginResult,
    SourcePlugin,
    TransformerPlugin,
    normalize_metadata,
)
from app.etl.load_services import DdbArtifactLoadService, PostgresLoadService, QdrantLoadService
from app.etl.runner import DirectSequentialEtlRunner, EtlEmptyOutputError, EtlPluginFailure, EtlPluginUnexpectedError
from app.models import DocumentChunk, IngestionEvent, IngestionJob, Upload, utcnow
from app.qdrant_index import QdrantIndexer, QdrantIndexError, QdrantPoint, get_qdrant_indexer


MAX_CHUNK_CHARS = 1200
CHUNK_OVERLAP_CHARS = 160
SUPPORTED_PARSE_EXTENSIONS = {".md", ".markdown", ".txt", ".html", ".htm", ".epub"}
FAILURE_METADATA_KEY = "failure"
FAILURE_CATEGORIES = {
    "invalid_zip",
    "unsupported_source_type",
    "ddb_parse_error",
    "missing_required_file",
    "duplicate_source",
    "storage_error",
    "database_error",
    "qdrant_index_error",
    "plugin_error",
    "worker_timeout",
    "unknown_error",
}


class ParserError(ValueError):
    pass


class DdbParserError(ParserError):
    pass


class StorageParserError(ParserError):
    pass


class PluginRunnerError(ParserError):
    pass


class PluginOutputError(ParserError):
    pass


class UnexpectedPluginError(ParserError):
    pass


@dataclass(frozen=True)
class ParsedSection:
    heading: str | None
    text: str
    start_char: int
    end_char: int
    metadata: dict[str, object] = field(default_factory=dict)


@dataclass(frozen=True)
class ParsedDocument:
    parser: str
    title: str | None
    sections: list[ParsedSection]
    warnings: list[str] = field(default_factory=list)
    metadata: dict[str, object] = field(default_factory=dict)


@dataclass(frozen=True)
class Chunk:
    content: str
    metadata: dict[str, object]


class _HTMLTextParser(HTMLParser):
    _IGNORED_TAGS: set[str] = {"script", "style", "noscript", "template", "nav", "header", "footer", "aside"}

    def __init__(self) -> None:
        super().__init__()
        self.blocks: list[tuple[str | None, str, dict[str, object]]] = []
        self._tag_stack: list[str] = []
        self._buffer: list[str] = []
        self._heading_stack: list[dict[str, object]] = []
        self._current_heading: str | None = None
        self._current_semantic_section: dict[str, object] = _semantic_section_root()
        self._heading_ids: set[str] = set()
        self._heading_attrs: list[dict[str, str | None]] = []
        self.title: str | None = None
        self.warnings: list[str] = []
        self._ignored_depth: int = 0
        self._ignored_tags_seen: set[str] = set()
        self._suppress_blocks_until_heading: bool = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag in self._IGNORED_TAGS:
            self._ignored_depth += 1
            if tag not in self._ignored_tags_seen:
                self._ignored_tags_seen.add(tag)
                self.warnings.append(f"Skipped boilerplate <{tag}> content")
            return

        if self._ignored_depth:
            return

        if tag in {"title", "h1", "h2", "h3", "h4", "h5", "h6", "p", "li"}:
            self._flush_buffer()
            self._tag_stack.append(tag)
            if tag.startswith("h") and tag[1:].isdigit():
                self._heading_attrs.append(dict(attrs))

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in self._IGNORED_TAGS:
            if self._ignored_depth:
                self._ignored_depth -= 1
            return

        if self._ignored_depth:
            return

        if tag in {"title", "h1", "h2", "h3", "h4", "h5", "h6", "p", "li"}:
            text = _normalize_whitespace(" ".join(self._buffer))
            self._buffer.clear()
            if text:
                if tag == "title":
                    self.title = text
                elif tag.startswith("h") and tag[1:].isdigit():
                    heading_attrs = self._heading_attrs.pop() if self._heading_attrs else {}
                    self._set_current_heading(tag, text, heading_attrs.get("id"))
                elif not self._suppress_blocks_until_heading:
                    self.blocks.append((self._current_heading, text, self._current_semantic_section))
            elif tag.startswith("h") and tag[1:].isdigit() and self._heading_attrs:
                _ = self._heading_attrs.pop()
                level = int(tag[1:])
                while self._heading_stack and cast(int, self._heading_stack[-1]["level"]) >= level:
                    _ = self._heading_stack.pop()
                self._suppress_blocks_until_heading = True
            if self._tag_stack and self._tag_stack[-1] == tag:
                self._tag_stack.pop()

    def handle_data(self, data: str) -> None:
        if self._tag_stack and not self._ignored_depth:
            self._buffer.append(data)

    def _flush_buffer(self) -> None:
        if self._buffer and not self._tag_stack:
            self._buffer.clear()

    def _set_current_heading(self, tag: str, text: str, dom_id: str | None) -> None:
        level = int(tag[1:])
        while self._heading_stack and cast(int, self._heading_stack[-1]["level"]) > level:
            _ = self._heading_stack.pop()
        heading_id = _semantic_heading_id(text, self._heading_ids, dom_id)
        semantic_section = _semantic_section_heading_from_stack(text, level, heading_id, self._heading_stack)
        heading = semantic_section["heading"]
        if isinstance(heading, dict):
            self._heading_stack.append(cast(dict[str, object], heading))
        self._current_heading = text
        self._current_semantic_section = semantic_section
        self._suppress_blocks_until_heading = False


ARCHIVE_LOCATOR_METADATA_KEYS = (
    "archive_source_id",
    "archive_entry_path",
    "archive_manifest_path",
    "archive_served_entry_path",
    "target_chunk_id",
    "target_selector",
    "viewer_fragment",
    "quote",
    "semantic_section",
    "source_url",
)


def _semantic_section_root() -> dict[str, object]:
    return {
        "kind": "root",
        "heading": None,
        "parent": None,
        "path": [],
        "path_text": [],
        "depth": 0,
    }


def _normalize_semantic_heading_text(text: str) -> str:
    return _normalize_whitespace(html.unescape(text))


def _semantic_heading_slug(text: str) -> str:
    normalized = _normalize_semantic_heading_text(text).lower()
    slug = re.sub(r"[^0-9a-z]+", "-", normalized).strip("-")
    return slug or "section"


def _semantic_heading_id(heading_text: str, existing_ids: set[str], dom_id: str | None = None) -> str:
    candidate = (dom_id or "").strip()
    if candidate:
        candidate_key = _semantic_heading_slug(candidate)
        if candidate_key not in existing_ids:
            existing_ids.add(candidate_key)
            return candidate

    base_source = candidate or heading_text
    base = _semantic_heading_slug(base_source)
    identifier = base
    suffix = 1
    while _semantic_heading_slug(identifier) in existing_ids:
        suffix += 1
        identifier = f"{base}-{suffix}"
    existing_ids.add(_semantic_heading_slug(identifier))
    return identifier


def _semantic_heading_node(heading_text: str, heading_level: int, heading_id: str) -> dict[str, object]:
    normalized_text = _normalize_semantic_heading_text(heading_text)
    return {
        "text": normalized_text,
        "level": heading_level,
        "id": heading_id,
        "slug": _semantic_heading_slug(normalized_text),
    }


def _semantic_section_heading_from_stack(
    heading_text: str,
    heading_level: int,
    heading_id: str,
    heading_stack: list[dict[str, object]],
) -> dict[str, object]:
    heading = _semantic_heading_node(heading_text, heading_level, heading_id)
    path = [*heading_stack, heading]
    return {
        "kind": "heading",
        "heading": heading,
        "parent": heading_stack[-1] if heading_stack else None,
        "path": path,
        "path_text": [str(item["text"]) for item in path],
        "depth": len(path),
    }


def _semantic_section_for_chunk(section: ParsedSection, existing_ids: set[str]) -> dict[str, object]:
    semantic_section = section.metadata.get("semantic_section")
    if isinstance(semantic_section, dict):
        return semantic_section
    heading_text = _normalize_semantic_heading_text(section.heading or "")
    if not heading_text:
        return _semantic_section_root()
    heading_id = _semantic_heading_id(heading_text, existing_ids)
    return _semantic_section_heading_from_stack(heading_text, 1, heading_id, [])


def parse_document(
    path: Path,
    extension: str,
    metadata: dict[str, object] | None = None,
    artifact_load_service: DdbArtifactLoadService | None = None,
) -> ParsedDocument:
    extension = extension.lower()
    if extension not in SUPPORTED_PARSE_EXTENSIONS:
        raise ParserError(f"No parser is available for {extension or 'unknown'} files yet")

    if extension == ".epub":
        return _parse_epub(path)

    try:
        raw_bytes = path.read_bytes()
        raw_text = raw_bytes.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ParserError("Uploaded file is not valid UTF-8 text") from exc
    except OSError as exc:
        raise StorageParserError(f"Could not read uploaded file: {exc}") from exc

    if extension in {".md", ".markdown"}:
        return _parse_markdown(raw_text)
    if extension in {".html", ".htm"}:
        if (metadata or {}).get("source_type") == "archived_webpage":
            return _parse_archived_webpage_html(raw_text, metadata or {})
        if is_ddb_saved_html(raw_text):
            return _parse_ddb_html(path, raw_text, raw_bytes, artifact_load_service or DdbArtifactLoadService())
        return _parse_html(raw_text)
    return _parse_text(raw_text)


def chunk_document(document: ParsedDocument, upload: Upload, job: IngestionJob) -> list[Chunk]:
    chunks: list[Chunk] = []
    semantic_heading_ids: set[str] = set()
    for section in document.sections:
        text = _normalize_whitespace(section.text)
        if not text:
            continue
        for start, end, content in _split_text(text):
            metadata: dict[str, object] = {
                "upload_id": upload.id,
                "job_id": job.id,
                "source_filename": upload.original_filename,
                "source_sha256": upload.sha256,
                "source_extension": upload.extension,
                "parser": document.parser,
                "title": document.title,
                "section_heading": section.heading,
                "start_char": section.start_char + start,
                "end_char": section.start_char + end,
                "token_count_estimate": len(content.split()),
            }
            metadata["semantic_section"] = _semantic_section_for_chunk(section, semantic_heading_ids)
            _merge_chunk_metadata(metadata, document.metadata)
            _merge_chunk_metadata(metadata, section.metadata)
            chunks.append(Chunk(content=content, metadata=metadata))
    return chunks


class _LegacyParserPlugin(SourcePlugin):
    metadata: PluginMetadata = PluginMetadata(
        name="legacy_ingestion_parser",
        version="1.0.0",
        source_types=("legacy",),
        description="Host-owned adapter around the existing ingestion parsers.",
    )

    def __init__(self, *, extension: str, artifact_load_service: DdbArtifactLoadService | None = None) -> None:
        self.extension = extension
        self.artifact_load_service = artifact_load_service

    @override
    def extract(self, source_path: Path, source_metadata: Mapping[str, object] | None = None) -> PluginResult:
        parsed = parse_document(source_path, self.extension, dict(source_metadata or {}), self.artifact_load_service)
        source_type = str((source_metadata or {}).get("source_type") or parsed.metadata.get("source_type") or parsed.parser)
        document = _normalized_document_from_parsed(parsed, source_type=source_type)
        return PluginResult(document=document, warnings=tuple(parsed.warnings))


def _sequential_runner(
    upload: Upload,
    job_metadata: dict[str, object],
    artifact_load_service: DdbArtifactLoadService | None,
    postgres_load_service: PostgresLoadService | None,
    source_plugin: SourcePlugin | None,
    transformers: Sequence[TransformerPlugin],
) -> DirectSequentialEtlRunner[ParsedDocument, Chunk]:
    del job_metadata
    passthrough_exception_types: tuple[type[BaseException], ...] = ()
    if source_plugin is None:
        passthrough_exception_types = (ParserError, OSError, SQLAlchemyError)
    extractor = source_plugin or _LegacyParserPlugin(extension=upload.extension, artifact_load_service=artifact_load_service)
    return DirectSequentialEtlRunner(
        extractor=extractor,
        transformers=transformers,
        document_adapter=_parsed_document_from_normalized,
        chunker=chunk_document,
        postgres_load_service=postgres_load_service,
        passthrough_exception_types=passthrough_exception_types,
    )


def _normalized_document_from_parsed(parsed: ParsedDocument, *, source_type: str | None = None) -> NormalizedDocument:
    metadata = normalize_metadata(parsed.metadata)
    normalized_source_type = source_type or str(metadata.get("source_type") or parsed.parser)
    return NormalizedDocument(
        source_type=normalized_source_type,
        parser=parsed.parser,
        title=parsed.title,
        sections=tuple(_normalized_section_from_parsed(section) for section in parsed.sections),
        warnings=tuple(parsed.warnings),
        metadata=metadata,
    )


def _parsed_document_from_normalized(document: NormalizedDocument) -> ParsedDocument:
    metadata: dict[str, object] = dict(normalize_metadata(document.metadata))
    return ParsedDocument(
        parser=document.parser,
        title=document.title,
        sections=[_parsed_section_from_normalized(section) for section in document.sections],
        warnings=list(document.warnings),
        metadata=metadata,
    )


def _normalized_section_from_parsed(section: ParsedSection) -> NormalizedSection:
    metadata = normalize_metadata(section.metadata)
    return NormalizedSection(
        heading=section.heading,
        text=section.text,
        start_char=section.start_char,
        end_char=section.end_char,
        metadata=metadata,
        archive_locator=_archive_locator_from_metadata(metadata),
    )


def _parsed_section_from_normalized(section: NormalizedSection) -> ParsedSection:
    metadata: dict[str, object] = dict(normalize_metadata(section.metadata))
    if section.archive_locator is not None:
        metadata = {**metadata, **section.archive_locator.metadata()}
    return ParsedSection(
        heading=section.heading,
        text=section.text,
        start_char=section.start_char,
        end_char=int(section.end_char or section.start_char + len(section.text)),
        metadata=metadata,
    )


def _archive_locator_from_metadata(metadata: Mapping[str, object]) -> ArchiveLocator | None:
    if metadata.get("source_type") != "archived_webpage":
        return None
    archive_source_id = str(metadata.get("archive_source_id") or "")
    archive_entry_path = str(metadata.get("archive_entry_path") or "")
    if not archive_source_id or not archive_entry_path:
        return None
    semantic_section = metadata.get("semantic_section")
    semantic_section_metadata = normalize_metadata(cast(Mapping[str, object], semantic_section)) if isinstance(semantic_section, Mapping) else {}
    return ArchiveLocator(
        archive_source_id=archive_source_id,
        archive_entry_path=archive_entry_path,
        archive_served_entry_path=_optional_str(metadata.get("archive_served_entry_path")),
        archive_manifest_path=_optional_str(metadata.get("archive_manifest_path")),
        target_chunk_id=_optional_str(metadata.get("target_chunk_id")),
        target_selector=_optional_str(metadata.get("target_selector")),
        viewer_fragment=_optional_str(metadata.get("viewer_fragment")),
        quote=_optional_str(metadata.get("quote")),
        source_url=_optional_str(metadata.get("source_url")),
        semantic_section=semantic_section_metadata,
    )


def _optional_str(value: object) -> str | None:
    if value in (None, ""):
        return None
    return str(value)


def claim_next_job(db: Session) -> IngestionJob | None:
    statement = (
        select(IngestionJob)
        .where(IngestionJob.status == "queued")
        .order_by(IngestionJob.created_at, IngestionJob.id)
        .with_for_update(skip_locked=True)
        .limit(1)
    )
    job = db.scalars(statement).first()
    if job is None:
        return None

    now = utcnow()
    job.status = "processing"
    job.error_summary = None
    job.updated_at = now
    add_event(db, job, "processing", "Worker claimed queued job", {"status": "processing"})
    db.commit()
    db.refresh(job)
    return job


def process_next_queued_job(db: Session) -> IngestionJob | None:
    job = claim_next_job(db)
    if job is None:
        return None
    return process_claimed_job(db, job.id, continue_to_index=False)


def process_next_job(
    db: Session,
    embedding_client: EmbeddingClient | None = None,
    qdrant_indexer: QdrantIndexer | None = None,
    settings: Settings | None = None,
    source_plugin: SourcePlugin | None = None,
    transformers: Sequence[TransformerPlugin] = (),
) -> IngestionJob | None:
    job = claim_next_job(db)
    if job is not None:
        return process_claimed_job(
            db,
            job.id,
            embedding_client,
            qdrant_indexer,
            settings,
            source_plugin=source_plugin,
            transformers=transformers,
        )

    embedding_job = claim_next_awaiting_embedding_job(db)
    if embedding_job is None:
        return None
    return process_awaiting_embedding_job(db, embedding_job.id, embedding_client, qdrant_indexer, settings)


def claim_next_awaiting_embedding_job(db: Session) -> IngestionJob | None:
    statement = (
        select(IngestionJob)
        .where(IngestionJob.status == "awaiting_embedding")
        .order_by(IngestionJob.updated_at, IngestionJob.created_at, IngestionJob.id)
        .with_for_update(skip_locked=True)
        .limit(1)
    )
    job = db.scalars(statement).first()
    if job is None:
        return None
    return job


def process_claimed_job(
    db: Session,
    job_id: str,
    embedding_client: EmbeddingClient | None = None,
    qdrant_indexer: QdrantIndexer | None = None,
    settings: Settings | None = None,
    continue_to_index: bool = True,
    postgres_load_service: PostgresLoadService | None = None,
    artifact_load_service: DdbArtifactLoadService | None = None,
    source_plugin: SourcePlugin | None = None,
    transformers: Sequence[TransformerPlugin] = (),
) -> IngestionJob:
    job = db.get(IngestionJob, job_id)
    if job is None:
        raise ParserError(f"Claimed job {job_id} disappeared")

    upload = db.get(Upload, job.upload_id)
    if upload is None:
        _fail_job(db, job, "Upload row is missing for ingestion job")
        return job

    try:
        job_metadata = _loads_json(job.metadata_json)
        add_event(db, job, "parsing_started", "Parsing uploaded source", {"extension": upload.extension})
        runner = _sequential_runner(upload, job_metadata, artifact_load_service, postgres_load_service, source_plugin, transformers)
        try:
            runner_state = runner.run(
                db,
                job=job,
                upload=upload,
                source_path=Path(upload.stored_path),
                source_metadata=job_metadata,
            )
        except EtlPluginFailure as exc:
            raise PluginRunnerError(exc.failure.message) from exc
        except EtlPluginUnexpectedError as exc:
            raise UnexpectedPluginError(str(exc)) from exc
        except EtlEmptyOutputError as exc:
            raise PluginOutputError(str(exc)) from exc

        document = runner_state.parsed_document
        if document is None:
            raise PluginOutputError("ETL runner produced no parsed document")
        chunks = list(runner_state.chunks)
        if not chunks:
            raise PluginOutputError("ETL runner produced no chunks")
        add_event(
            db,
            job,
            "parsing_completed",
            "Parsed uploaded source",
            {
                "parser": document.parser,
                "section_count": len(document.sections),
                "title": document.title,
                "warnings": document.warnings,
            },
        )
        if document.warnings:
            add_event(db, job, "parsing_warnings", "Parser reported non-fatal warnings", {"warnings": document.warnings})

        job.status = "chunking"
        job.updated_at = utcnow()
        add_event(db, job, "chunking_started", "Chunking parsed content", {"status": "chunking"})
        db.flush()

        job.status = "awaiting_embedding"
        job.metadata_json = _to_json(
            _merged_metadata(
                _merged_metadata(document.metadata, **job_metadata),
                parser=document.parser,
                title=document.title,
                section_count=len(document.sections),
                chunk_count=len(chunks),
                parser_warnings=document.warnings,
            )
        )
        job.updated_at = utcnow()
        add_event(db, job, "chunking_completed", "Chunks are ready for embedding", {"chunk_count": len(chunks)})
        add_event(db, job, "awaiting_embedding", "Job is awaiting embedding", {"status": "awaiting_embedding"})
        db.commit()

        if continue_to_index:
            _embed_and_index_job(db, job.id, embedding_client, qdrant_indexer, settings)
    except Exception as exc:
        db.rollback()
        job = db.get(IngestionJob, job_id)
        if job is None:
            raise
        _fail_job(db, job, str(exc), exc, upload)
    db.refresh(job)
    return job


def process_awaiting_embedding_job(
    db: Session,
    job_id: str,
    embedding_client: EmbeddingClient | None = None,
    qdrant_indexer: QdrantIndexer | None = None,
    settings: Settings | None = None,
) -> IngestionJob:
    return _embed_and_index_job(db, job_id, embedding_client, qdrant_indexer, settings)


def add_event(
    db: Session,
    job: IngestionJob,
    event_type: str,
    message: str | None = None,
    metadata: dict[str, object] | None = None,
) -> None:
    db.add(
        IngestionEvent(
            ingestion_job_id=job.id,
            upload_id=job.upload_id,
            event_type=event_type,
            message=message,
            metadata_json=_to_json(metadata or {}),
            created_at=utcnow(),
        )
    )


def _fail_job(db: Session, job: IngestionJob, error_summary: str, exc: BaseException | None = None, upload: Upload | None = None) -> None:
    failure = _normalize_job_failure(job, error_summary, exc, upload)
    job.status = "failed"
    job.error_summary = str(failure["message"])[:2000]
    job.updated_at = utcnow()
    job.metadata_json = _merge_json(job.metadata_json, {FAILURE_METADATA_KEY: failure})
    add_event(
        db,
        job,
        "job_failed",
        str(failure["message"])[:2000],
        {"status": "failed", "category": failure["category"], "filename": failure["filename"]},
    )
    db.commit()


def _normalize_job_failure(
    job: IngestionJob,
    error_summary: str,
    exc: BaseException | None = None,
    upload: Upload | None = None,
) -> dict[str, object]:
    category = _failure_category(error_summary, exc)
    message = _safe_failure_message(category, error_summary)
    filename = upload.original_filename if upload is not None else None
    if not filename:
        filename = str(_loads_json(job.metadata_json).get("filename") or job.upload_id or "unknown")
    return {
        "filename": filename,
        "category": category,
        "message": message,
        "diagnostics": _failure_diagnostics(error_summary, exc),
    }


def _failure_category(error_summary: str, exc: BaseException | None) -> str:
    lower_summary = error_summary.lower()
    chain = _exception_chain(exc)
    if any(isinstance(item, TimeoutError) for item in chain):
        return "worker_timeout"
    if any(isinstance(item, QdrantIndexError) for item in chain) or "qdrant" in lower_summary:
        return "qdrant_index_error"
    if any(isinstance(item, PluginRunnerError) for item in chain):
        return "plugin_error"
    if any(isinstance(item, PluginOutputError) for item in chain) or "etl runner produced no" in lower_summary or "produced no sections" in lower_summary:
        return "plugin_error"
    if any(isinstance(item, UnexpectedPluginError) for item in chain):
        return "unknown_error"
    if any(isinstance(item, DdbParserError) for item in chain) or "ddb saved html" in lower_summary or "d&d beyond" in lower_summary:
        return "ddb_parse_error"
    if any(isinstance(item, zipfile.BadZipFile) for item in chain) or "not a valid zip" in lower_summary or "valid epub archive" in lower_summary:
        return "invalid_zip"
    if any(isinstance(item, StorageParserError | OSError) for item in chain) or "could not read uploaded file" in lower_summary or "could not write" in lower_summary:
        return "storage_error"
    if any(isinstance(item, SQLAlchemyError) for item in chain):
        if "duplicate" in lower_summary or "unique" in lower_summary:
            return "duplicate_source"
        return "database_error"
    if "no parser is available" in lower_summary:
        return "unsupported_source_type"
    if "upload row is missing" in lower_summary:
        return "missing_required_file"
    if "duplicate" in lower_summary:
        return "duplicate_source"
    return "unknown_error"


def _safe_failure_message(category: str, error_summary: str) -> str:
    messages = {
        "invalid_zip": "Uploaded archive is not a valid ZIP file.",
        "unsupported_source_type": "Unsupported file type. Supported types: ZIP, EPUB, HTML, TXT, MD.",
        "ddb_parse_error": "D&D Beyond saved HTML could not be parsed. Review the saved page and try again.",
        "missing_required_file": "A required uploaded file was missing during import.",
        "duplicate_source": "This source has already been imported.",
        "storage_error": "Uploaded file storage could not be read or written. Try again later.",
        "database_error": "The import could not be saved. Try again later.",
        "qdrant_index_error": "Search indexing failed. Try again later.",
        "plugin_error": "Import plugin failed. Review the file and try again.",
        "worker_timeout": "The import worker timed out. Try again later.",
        "unknown_error": "Import failed. Review the file and try again.",
    }
    if category == "unknown_error":
        return _redact_failure_message(error_summary)[:500]
    return messages[category]


def _redact_failure_message(message: str) -> str:
    if _message_looks_unsafe(message):
        return "Import failed. Review the file and try again."
    return message or "Import failed. Review the file and try again."


def _message_looks_unsafe(message: str) -> bool:
    return bool(
        re.search(r"Traceback", message, re.IGNORECASE)
        or re.search(r"\bFile \"", message)
        or re.search(r"/(?:home|tmp|var|srv|data|app|mnt)/", message)
        or re.search(r"[A-Za-z]:\\\\", message)
        or re.search(r"<[^>]+Error[^>]*>", message)
    )


def _failure_diagnostics(error_summary: str, exc: BaseException | None) -> dict[str, object]:
    diagnostics: dict[str, object] = {"summary": error_summary[:2000]}
    if exc is None:
        return diagnostics
    diagnostics["exception_type"] = type(exc).__name__
    diagnostics["exception_module"] = type(exc).__module__
    diagnostics["traceback"] = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))[:8000]
    return diagnostics


def _exception_chain(exc: BaseException | None) -> list[BaseException]:
    chain: list[BaseException] = []
    current = exc
    while current is not None and current not in chain:
        chain.append(current)
        current = current.__cause__ or current.__context__
    return chain


def _embed_and_index_job(
    db: Session,
    job_id: str,
    embedding_client: EmbeddingClient | None,
    qdrant_indexer: QdrantIndexer | None,
    settings: Settings | None,
) -> IngestionJob:
    settings = settings or get_settings()
    embedding_client = embedding_client or get_embedding_client(settings)
    qdrant_indexer = qdrant_indexer or get_qdrant_indexer(settings)

    job = db.get(IngestionJob, job_id)
    if job is None:
        raise ParserError(f"Embedding job {job_id} disappeared")
    if job.status != "awaiting_embedding":
        return job

    try:
        job.status = "embedding"
        job.updated_at = utcnow()
        add_event(
            db,
            job,
            "embedding_started",
            "Embedding chunks",
            {
                "status": "embedding",
                "embedding_model": embedding_client.model,
                "embedding_dimensions": embedding_client.dimensions,
            },
        )
        db.commit()

        chunks = _job_chunks(db, job.id)
        if not chunks:
            raise ParserError("Job has no chunks to embed")
        embeddings = embedding_client.embed_texts([chunk.content for chunk in chunks])
        if len(embeddings.vectors) != len(chunks):
            raise ParserError("Embedding client returned a vector count that did not match chunk count")

        job = db.get(IngestionJob, job_id)
        if job is None:
            raise ParserError(f"Embedding job {job_id} disappeared")
        job.status = "indexing"
        job.updated_at = utcnow()
        add_event(
            db,
            job,
            "embedding_completed",
            "Embedded chunks",
            {
                "chunk_count": len(chunks),
                "embedding_model": embeddings.model,
                "embedding_dimensions": embeddings.dimensions,
            },
        )
        add_event(db, job, "indexing_started", "Indexing chunks in Qdrant", {"status": "indexing"})
        db.commit()

        points = _qdrant_points(chunks, embeddings.vectors, embeddings.model, embeddings.dimensions)

        job = db.get(IngestionJob, job_id)
        if job is None:
            raise ParserError(f"Embedding job {job_id} disappeared")
        QdrantLoadService().persist_index(
            db,
            job=job,
            chunks=chunks,
            points=points,
            indexer=qdrant_indexer,
            embedding_dimensions=embeddings.dimensions,
            embedding_model=embeddings.model,
        )
        job.status = "completed"
        job.updated_at = utcnow()
        job.metadata_json = _merge_json(
            job.metadata_json,
            {
                "indexed_chunk_count": len(chunks),
                "embedding_model": embeddings.model,
                "embedding_dimensions": embeddings.dimensions,
                "qdrant_collection": qdrant_indexer.collection,
            },
        )
        add_event(
            db,
            job,
            "indexing_completed",
            "Indexed chunks in Qdrant",
            {"indexed_chunk_count": len(chunks), "qdrant_collection": qdrant_indexer.collection},
        )
        add_event(db, job, "job_completed", "Ingestion job completed", {"status": "completed"})
        db.commit()
    except Exception as exc:
        db.rollback()
        job = db.get(IngestionJob, job_id)
        if job is None:
            raise
        upload = db.get(Upload, job.upload_id)
        _fail_job(db, job, str(exc), exc, upload)
    db.refresh(job)
    return job


def _job_chunks(db: Session, job_id: str) -> list[DocumentChunk]:
    return list(
        db.scalars(
            select(DocumentChunk)
            .where(DocumentChunk.ingestion_job_id == job_id)
            .order_by(DocumentChunk.chunk_index)
        ).all()
    )


def _qdrant_points(
    chunks: Sequence[DocumentChunk],
    vectors: Sequence[list[float]],
    embedding_model: str,
    embedding_dimensions: int,
) -> list[QdrantPoint]:
    points: list[QdrantPoint] = []
    for chunk, vector in zip(chunks, vectors, strict=True):
        if len(vector) != embedding_dimensions:
            raise ParserError("Embedding vector dimensions did not match configured dimensions")
        metadata = json.loads(chunk.metadata_json)
        point_id = deterministic_point_id(chunk)
        payload: dict[str, object] = {
            "source_id": chunk.upload_id,
            "chunk_id": chunk.id,
            "filename": metadata.get("source_filename"),
            "section": metadata.get("section_heading"),
            "embedding_model": embedding_model,
            "embedding_dimensions": embedding_dimensions,
            "chunk_index": chunk.chunk_index,
            "ingestion_job_id": chunk.ingestion_job_id,
        }
        payload.update(_archive_locator_metadata(metadata))
        points.append(QdrantPoint(id=point_id, vector=vector, payload=payload))
    return points


def deterministic_point_id(chunk: DocumentChunk) -> str:
    return str(uuid5(NAMESPACE_URL, f"thestacks:{chunk.upload_id}:{chunk.ingestion_job_id}:{chunk.id}"))


def _archive_locator_metadata(metadata: dict[str, object]) -> dict[str, object]:
    if metadata.get("source_type") != "archived_webpage":
        return {}
    return {
        key: metadata[key]
        for key in ARCHIVE_LOCATOR_METADATA_KEYS
        if key in metadata and metadata[key] not in (None, "", [])
    }


def _merge_json(existing: str, updates: dict[str, object]) -> str:
    payload = _loads_json(existing)
    payload.update(updates)
    return _to_json(payload)


def _loads_json(existing: str) -> dict[str, object]:
    try:
        payload = json.loads(existing or "{}")
    except json.JSONDecodeError:
        return {}
    if isinstance(payload, dict):
        return payload
    return {}


def _parse_markdown(text: str) -> ParsedDocument:
    sections: list[ParsedSection] = []
    current_heading: str | None = None
    current_lines: list[str] = []
    section_start = 0
    title: str | None = None
    cursor = 0

    for line in text.splitlines(keepends=True):
        match = re.match(r"^(#{1,6})\s+(.+?)\s*$", line.strip())
        if match:
            _append_section(sections, current_heading, current_lines, section_start, cursor)
            current_heading = match.group(2)
            title = title or current_heading
            current_lines = []
            section_start = cursor + len(line)
        else:
            current_lines.append(line)
        cursor += len(line)
    _append_section(sections, current_heading, current_lines, section_start, len(text))
    return ParsedDocument(parser="markdown", title=title, sections=_non_empty_sections(sections))


def _parse_text(text: str) -> ParsedDocument:
    normalized = text.strip()
    section = ParsedSection(heading=None, text=normalized, start_char=0, end_char=len(text))
    return ParsedDocument(parser="text", title=None, sections=_non_empty_sections([section]))


def _parse_html(text: str) -> ParsedDocument:
    parser = _HTMLTextParser()
    parser.feed(text)
    sections: list[ParsedSection] = []
    cursor = 0
    for heading, block, semantic_section in parser.blocks:
        start = text.find(block, cursor)
        if start == -1:
            start = cursor
        end = start + len(block)
        sections.append(
            ParsedSection(
                heading=heading,
                text=block,
                start_char=start,
                end_char=end,
                metadata={"semantic_section": semantic_section},
            )
        )
        cursor = end
    sections = _non_empty_sections(sections)
    title = parser.title
    if title is None and sections:
        title = sections[0].heading or sections[0].text.split("\n", 1)[0][:120]
        parser.warnings.append("HTML title missing; using the first heading as title")
    if not sections:
        raise ParserError("HTML document did not contain readable text")
    return ParsedDocument(parser="html", title=title, sections=sections, warnings=parser.warnings)


def _parse_archived_webpage_html(text: str, metadata: dict[str, object]) -> ParsedDocument:
    document = _parse_html(text)
    anchor_map = _load_archive_anchor_map(metadata)
    anchors = _archive_anchors(anchor_map)
    source_id = str(metadata.get("source_id") or anchor_map.get("source_id") or "")
    entry_path = str(metadata.get("archive_entry_path") or metadata.get("archive_primary_html_path") or anchor_map.get("source_path") or "")
    served_entry_path = str(metadata.get("archive_served_entry_path") or metadata.get("archive_served_html_path") or entry_path)
    manifest_path = str(metadata.get("archive_manifest_path") or "")
    base_metadata: dict[str, object] = {
        "source_type": "archived_webpage",
        "archive_source_id": source_id,
        "archive_entry_path": entry_path,
        "archive_manifest_path": manifest_path,
        "archive_served_entry_path": served_entry_path,
    }
    if metadata.get("source_url"):
        base_metadata["source_url"] = metadata["source_url"]

    warnings = list(document.warnings)
    if not anchors:
        warnings.append("Archive anchor map did not contain citation targets")

    sections: list[ParsedSection] = []
    for section in document.sections:
        locator = _match_archive_anchor(section, anchors)
        section_metadata = dict(section.metadata)
        _merge_chunk_metadata(section_metadata, base_metadata)
        _merge_chunk_metadata(section_metadata, locator)
        sections.append(
            ParsedSection(
                heading=section.heading,
                text=section.text,
                start_char=section.start_char,
                end_char=section.end_char,
                metadata=section_metadata,
            )
        )
    return ParsedDocument(
        parser="archived_webpage",
        title=document.title,
        sections=sections,
        warnings=warnings,
        metadata=base_metadata,
    )


def _load_archive_anchor_map(metadata: dict[str, object]) -> dict[str, object]:
    anchor_map_path = metadata.get("archive_anchor_map_path")
    manifest_path = metadata.get("archive_manifest_path")
    if not anchor_map_path or not manifest_path:
        return {}
    try:
        path = Path(str(manifest_path)).parent / str(anchor_map_path)
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return payload if isinstance(payload, dict) else {}


def _archive_anchors(anchor_map: dict[str, object]) -> list[dict[str, object]]:
    anchors = anchor_map.get("anchors")
    if not isinstance(anchors, list):
        return []
    return [anchor for anchor in anchors if isinstance(anchor, dict)]


def _match_archive_anchor(section: ParsedSection, anchors: list[dict[str, object]]) -> dict[str, object]:
    section_text = _normalize_whitespace(section.text)
    for anchor in anchors:
        quote = str(anchor.get("quote") or "")
        normalized_quote = _normalize_whitespace(quote)
        if normalized_quote and (normalized_quote in section_text or section_text in normalized_quote):
            return _archive_anchor_metadata(anchor)
    return {}


def _archive_anchor_metadata(anchor: dict[str, object]) -> dict[str, object]:
    heading_path = anchor.get("heading_path")
    semantic_section = _semantic_section_from_heading_path(heading_path if isinstance(heading_path, list) else [])
    metadata: dict[str, object] = {
        "target_chunk_id": anchor.get("chunk_id"),
        "target_selector": anchor.get("selector"),
        "viewer_fragment": anchor.get("viewer_fragment"),
        "quote": anchor.get("quote"),
        "semantic_section": semantic_section,
    }
    return {key: value for key, value in metadata.items() if value is not None}


def _semantic_section_from_heading_path(heading_path: list[object]) -> dict[str, object]:
    heading_stack: list[dict[str, object]] = []
    heading_ids: set[str] = set()
    semantic_section = _semantic_section_root()
    for index, heading_text in enumerate(heading_path, start=1):
        normalized_heading = _normalize_semantic_heading_text(str(heading_text))
        if not normalized_heading:
            continue
        heading_id = _semantic_heading_id(normalized_heading, heading_ids)
        semantic_section = _semantic_section_heading_from_stack(normalized_heading, index, heading_id, heading_stack)
        heading = semantic_section["heading"]
        if isinstance(heading, dict):
            heading_stack.append(heading)
    return semantic_section


def _parse_ddb_html(path: Path, text: str, raw_bytes: bytes, artifact_load_service: DdbArtifactLoadService) -> ParsedDocument:
    try:
        document = parse_ddb_saved_html(text, raw_bytes)
        artifact_load_service.persist_artifacts(document, path)
    except ValueError as exc:
        raise DdbParserError(str(exc)) from exc
    except OSError as exc:
        raise StorageParserError(f"Could not write DDB import artifacts: {exc}") from exc
    return ParsedDocument(
        parser=DDB_PARSER,
        title=document.title,
        sections=[
            ParsedSection(
                heading=section.heading,
                text=section.text,
                start_char=section.start_char,
                end_char=section.end_char,
                metadata=section.metadata,
            )
            for section in document.sections
        ],
        warnings=document.warnings,
        metadata=document.metadata,
    )


def _parse_epub(path: Path) -> ParsedDocument:
    try:
        raw_bytes = path.read_bytes()
    except OSError as exc:
        raise StorageParserError(f"Could not read uploaded file: {exc}") from exc

    try:
        archive = zipfile.ZipFile(io.BytesIO(raw_bytes))
    except zipfile.BadZipFile as exc:
        raise ParserError("Uploaded EPUB file is not a valid EPUB archive") from exc

    sections: list[ParsedSection] = []
    warnings: list[str] = []
    title: str | None = None
    cursor = 0
    content_files = [
        name
        for name in archive.namelist()
        if name.lower().endswith((".xhtml", ".html", ".htm"))
        and not name.endswith("/")
        and "nav" not in Path(name).name.lower()
    ]
    if not content_files:
        raise ParserError("EPUB archive did not contain readable XHTML content")

    for name in sorted(content_files):
        try:
            raw_text = archive.read(name).decode("utf-8")
        except UnicodeDecodeError as exc:
            raise ParserError(f"EPUB content {name} is not valid UTF-8 text") from exc

        document = _parse_html(raw_text)
        warnings.extend([f"{name}: {warning}" for warning in document.warnings])
        if title is None and document.title:
            title = document.title

        for section in document.sections:
            sections.append(
                ParsedSection(
                    heading=section.heading,
                    text=section.text,
                    start_char=cursor + section.start_char,
                    end_char=cursor + section.end_char,
                )
            )
        cursor += len(raw_text)

    sections = _non_empty_sections(sections)
    if not sections:
        raise ParserError("EPUB archive did not contain readable text")
    if title is None:
        title = sections[0].heading or sections[0].text.split("\n", 1)[0][:120]
        warnings.append("EPUB title missing; using the first heading as title")

    return ParsedDocument(parser="epub", title=title, sections=sections, warnings=warnings)


def _append_section(
    sections: list[ParsedSection],
    heading: str | None,
    lines: list[str],
    start_char: int,
    end_char: int,
) -> None:
    text = "".join(lines).strip()
    if text:
        sections.append(ParsedSection(heading=heading, text=text, start_char=start_char, end_char=end_char))


def _non_empty_sections(sections: list[ParsedSection]) -> list[ParsedSection]:
    return [section for section in sections if _normalize_whitespace(section.text)]


def _merge_chunk_metadata(metadata: dict[str, object], extra: dict[str, object]) -> None:
    protected_keys = set(metadata)
    for key, value in extra.items():
        if key not in protected_keys and value is not None:
            metadata[key] = value


def _merged_metadata(base: dict[str, object], **protected: object) -> dict[str, object]:
    metadata = {key: value for key, value in base.items() if key not in protected and value is not None}
    metadata.update(protected)
    return metadata


def _split_text(text: str) -> list[tuple[int, int, str]]:
    if len(text) <= MAX_CHUNK_CHARS:
        return [(0, len(text), text)]

    chunks: list[tuple[int, int, str]] = []
    start = 0
    while start < len(text):
        hard_end = min(start + MAX_CHUNK_CHARS, len(text))
        end = hard_end
        if hard_end < len(text):
            paragraph_break = text.rfind("\n\n", start, hard_end)
            sentence_break = text.rfind(". ", start, hard_end)
            whitespace_break = text.rfind(" ", start, hard_end)
            end = max(paragraph_break, sentence_break + 1 if sentence_break != -1 else -1, whitespace_break)
            if end <= start:
                end = hard_end
        content = text[start:end].strip()
        if content:
            chunks.append((start, end, content))
        if end >= len(text):
            break
        start = max(end - CHUNK_OVERLAP_CHARS, start + 1)
    return chunks


def _normalize_whitespace(text: str) -> str:
    return re.sub(r"[ \t\r\f\v]+", " ", text).strip()


def _to_json(value: dict[str, object]) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"))
