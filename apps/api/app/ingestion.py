import html
import json
import re
import io
import hashlib
from collections.abc import Sequence
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from typing import cast
from uuid import NAMESPACE_URL, uuid4, uuid5
import zipfile

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.ddb_import import DDB_PARSER, is_ddb_saved_html, parse_ddb_saved_html, write_ddb_artifacts
from app.embeddings import EmbeddingClient, get_embedding_client
from app.models import Document, DocumentChunk, IndexedChunk, IngestionEvent, IngestionJob, Section, Source, Upload, utcnow
from app.qdrant_index import QdrantIndexer, QdrantPoint, get_qdrant_indexer


MAX_CHUNK_CHARS = 1200
CHUNK_OVERLAP_CHARS = 160
SUPPORTED_PARSE_EXTENSIONS = {".md", ".markdown", ".txt", ".html", ".htm", ".epub"}


class ParserError(ValueError):
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


def parse_document(path: Path, extension: str, metadata: dict[str, object] | None = None) -> ParsedDocument:
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
        raise ParserError(f"Could not read uploaded file: {exc}") from exc

    if extension in {".md", ".markdown"}:
        return _parse_markdown(raw_text)
    if extension in {".html", ".htm"}:
        if (metadata or {}).get("source_type") == "archived_webpage":
            return _parse_archived_webpage_html(raw_text, metadata or {})
        if is_ddb_saved_html(raw_text):
            return _parse_ddb_html(path, raw_text, raw_bytes)
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
) -> IngestionJob | None:
    job = claim_next_job(db)
    if job is not None:
        return process_claimed_job(db, job.id, embedding_client, qdrant_indexer, settings)

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
        document = parse_document(Path(upload.stored_path), upload.extension, job_metadata)
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

        chunks = chunk_document(document, upload, job)
        if not chunks:
            raise ParserError("Parsed document did not contain chunkable text")

        source = Source(
            id=str(job_metadata.get("source_id") or uuid4()),
            upload_id=upload.id,
            title=document.title or upload.original_filename,
            source_type=str(job_metadata.get("source_type") or upload.extension.lstrip(".") or "unknown"),
            filename=upload.original_filename,
            metadata_json=_to_json(
                _merged_metadata(
                    _merged_metadata(document.metadata, **job_metadata),
                    content_type=upload.content_type,
                    sha256=upload.sha256,
                    parser=document.parser,
                    parser_warnings=document.warnings,
                )
            ),
            chunk_count=len(chunks),
            created_at=utcnow(),
            updated_at=utcnow(),
        )
        db.add(source)
        db.flush()

        canonical_document = Document(
            source_id=source.id,
            title=document.title or upload.original_filename,
            ordinal=0,
            metadata_json=_to_json(
                _merged_metadata(document.metadata, parser=document.parser, section_count=len(document.sections))
            ),
            created_at=utcnow(),
        )
        db.add(canonical_document)
        db.flush()

        section_ids_by_heading: dict[str | None, str] = {}
        for ordinal, section in enumerate(document.sections):
            heading_key = section.heading
            if heading_key in section_ids_by_heading:
                continue
            canonical_section = Section(
                document_id=canonical_document.id,
                heading_path=section.heading,
                ordinal=ordinal,
                metadata_json=_to_json(
                    _merged_metadata(section.metadata, start_char=section.start_char, end_char=section.end_char)
                ),
                created_at=utcnow(),
            )
            db.add(canonical_section)
            db.flush()
            section_ids_by_heading[heading_key] = canonical_section.id

        for index, chunk in enumerate(chunks):
            metadata = dict(chunk.metadata)
            metadata["chunk_index"] = index
            section_heading = metadata.get("section_heading")
            if not isinstance(section_heading, str):
                section_heading = None
            section_id = section_ids_by_heading.get(section_heading)
            if section_id is None:
                section_id = next(iter(section_ids_by_heading.values()))
            db.add(
                DocumentChunk(
                    upload_id=upload.id,
                    ingestion_job_id=job.id,
                    source_id=source.id,
                    document_id=canonical_document.id,
                    section_id=section_id,
                    chunk_index=index,
                    content=chunk.content,
                    content_hash=hashlib.sha256(chunk.content.encode()).hexdigest(),
                    token_count=_metadata_int(metadata.get("token_count_estimate"), len(chunk.content.split())),
                    metadata_json=_to_json(metadata),
                    created_at=utcnow(),
                )
            )

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
        _fail_job(db, job, str(exc))
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


def _fail_job(db: Session, job: IngestionJob, error_summary: str) -> None:
    job.status = "failed"
    job.error_summary = error_summary[:2000]
    job.updated_at = utcnow()
    add_event(db, job, "job_failed", error_summary[:2000], {"status": "failed"})
    db.commit()


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

        qdrant_indexer.ensure_collection(embeddings.dimensions)
        points = _qdrant_points(chunks, embeddings.vectors, embeddings.model, embeddings.dimensions)
        qdrant_indexer.upsert_points(points)

        job = db.get(IngestionJob, job_id)
        if job is None:
            raise ParserError(f"Embedding job {job_id} disappeared")
        _record_indexed_chunks(db, job, chunks, points, qdrant_indexer.collection, embeddings.model, embeddings.dimensions)
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
        _fail_job(db, job, str(exc))
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


def _record_indexed_chunks(
    db: Session,
    job: IngestionJob,
    chunks: Sequence[DocumentChunk],
    points: Sequence[QdrantPoint],
    collection: str,
    embedding_model: str,
    embedding_dimensions: int,
) -> None:
    for chunk, point in zip(chunks, points, strict=True):
        db.add(
            IndexedChunk(
                upload_id=chunk.upload_id,
                ingestion_job_id=job.id,
                document_chunk_id=chunk.id,
                qdrant_collection=collection,
                qdrant_point_id=point.id,
                embedding_model=embedding_model,
                embedding_dimensions=embedding_dimensions,
                created_at=utcnow(),
            )
        )


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


def _parse_ddb_html(path: Path, text: str, raw_bytes: bytes) -> ParsedDocument:
    try:
        document = parse_ddb_saved_html(text, raw_bytes)
        write_ddb_artifacts(document, Path(f"{path}.artifacts"))
    except ValueError as exc:
        raise ParserError(str(exc)) from exc
    except OSError as exc:
        raise ParserError(f"Could not write DDB import artifacts: {exc}") from exc
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
        raise ParserError(f"Could not read uploaded file: {exc}") from exc

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


def _metadata_int(value: object, default: int) -> int:
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        try:
            return int(value)
        except ValueError:
            return default
    return default


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
