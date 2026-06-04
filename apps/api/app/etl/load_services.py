import hashlib
import json
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol
from uuid import uuid4

from sqlalchemy.orm import Session

from app.ddb_import import DdbArtifacts, DdbImport, write_ddb_artifacts
from app.models import Document, DocumentChunk, IndexedChunk, IngestionJob, Section, Source, Upload, utcnow
from app.qdrant_index import QdrantIndexer, QdrantPoint


@dataclass(frozen=True)
class PostgresLoadResult:
    source: Source
    document: Document
    chunks: list[DocumentChunk]


class ParsedSectionLike(Protocol):
    @property
    def heading(self) -> str | None: ...

    @property
    def start_char(self) -> int: ...

    @property
    def end_char(self) -> int: ...

    @property
    def metadata(self) -> dict[str, object]: ...


class ParsedDocumentLike(Protocol):
    @property
    def parser(self) -> str: ...

    @property
    def title(self) -> str | None: ...

    @property
    def sections(self) -> Sequence[ParsedSectionLike]: ...

    @property
    def warnings(self) -> Sequence[str]: ...

    @property
    def metadata(self) -> dict[str, object]: ...


class ChunkLike(Protocol):
    @property
    def content(self) -> str: ...

    @property
    def metadata(self) -> dict[str, object]: ...


class DdbArtifactLoadService:
    def persist_artifacts(self, ddb_import: DdbImport, source_path: Path) -> DdbArtifacts:
        return write_ddb_artifacts(ddb_import, Path(f"{source_path}.artifacts"))


class PostgresLoadService:
    def persist_document(
        self,
        db: Session,
        *,
        job: IngestionJob,
        upload: Upload,
        document: ParsedDocumentLike,
        chunks: Sequence[ChunkLike],
        job_metadata: dict[str, object],
    ) -> PostgresLoadResult:
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
            metadata_json=_to_json(_merged_metadata(document.metadata, parser=document.parser, section_count=len(document.sections))),
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
                metadata_json=_to_json(_merged_metadata(section.metadata, start_char=section.start_char, end_char=section.end_char)),
                created_at=utcnow(),
            )
            db.add(canonical_section)
            db.flush()
            section_ids_by_heading[heading_key] = canonical_section.id

        persisted_chunks: list[DocumentChunk] = []
        for index, chunk in enumerate(chunks):
            metadata = dict(chunk.metadata)
            metadata["chunk_index"] = index
            section_heading = metadata.get("section_heading")
            if not isinstance(section_heading, str):
                section_heading = None
            section_id = section_ids_by_heading.get(section_heading)
            if section_id is None:
                section_id = next(iter(section_ids_by_heading.values()))
            document_chunk = DocumentChunk(
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
            db.add(document_chunk)
            persisted_chunks.append(document_chunk)

        return PostgresLoadResult(source=source, document=canonical_document, chunks=persisted_chunks)


class QdrantLoadService:
    def persist_index(
        self,
        db: Session,
        *,
        job: IngestionJob,
        chunks: Sequence[DocumentChunk],
        points: Sequence[QdrantPoint],
        indexer: QdrantIndexer,
        embedding_dimensions: int,
        embedding_model: str,
    ) -> None:
        indexer.ensure_collection(embedding_dimensions)
        indexer.upsert_points(points)
        for chunk, point in zip(chunks, points, strict=True):
            db.add(
                IndexedChunk(
                    upload_id=chunk.upload_id,
                    ingestion_job_id=job.id,
                    document_chunk_id=chunk.id,
                    qdrant_collection=indexer.collection,
                    qdrant_point_id=point.id,
                    embedding_model=embedding_model,
                    embedding_dimensions=embedding_dimensions,
                    created_at=utcnow(),
                )
            )


def load_intents_are_empty_or_json_safe(intents: Sequence[object]) -> bool:
    try:
        json.dumps(list(intents), sort_keys=True)
    except TypeError:
        return False
    return True


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


def _to_json(value: dict[str, object]) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"))
