import json
from collections.abc import Sequence

from sqlalchemy.orm import Session

from app.chat_rag import ChatClient, ContextChunk, GeneratedAnswer, RetrievalGraphInvoker
from app.models import ChatSession, Document, DocumentChunk, IndexedChunk, IngestionJob, Section, Source, Upload, utcnow


class FakeChatClient(ChatClient):
    def __init__(self, answer: str, cited_chunk_ids: list[str]) -> None:
        self.model = "fake-chat-model"
        self.answer = answer
        self.cited_chunk_ids = cited_chunk_ids
        self.requests: list[tuple[str, list[str]]] = []

    def generate_answer(self, question: str, contexts: Sequence[ContextChunk]) -> GeneratedAnswer:
        self.requests.append((question, [context.chunk_id for context in contexts]))
        return GeneratedAnswer(answer=self.answer, cited_chunk_ids=self.cited_chunk_ids)


class CapturingGraphInvoker(RetrievalGraphInvoker):
    def __init__(self, chat_client: ChatClient) -> None:
        super().__init__(chat_client)
        self.configs: list[dict[str, object]] = []

    def invoke(self, state: dict[str, object], config: dict[str, object]) -> dict[str, object]:
        self.configs.append(config)
        return super().invoke(state, config)


def create_session(db: Session, title: str = "RAG test") -> ChatSession:
    session = ChatSession(title=title, created_at=utcnow(), updated_at=utcnow())
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def create_indexed_chunk(
    db: Session,
    content: str,
    filename: str = "sample.md",
    section: str | None = "Bestiary",
    qdrant_collection: str = "thestacks_chunks",
) -> DocumentChunk:
    upload = Upload(
        original_filename=filename,
        stored_path=f"/tmp/{filename}",
        content_type="text/markdown",
        extension=".md",
        sha256="abc123",
        size_bytes=len(content.encode()),
        created_at=utcnow(),
    )
    db.add(upload)
    db.flush()
    job = IngestionJob(upload_id=upload.id, status="completed", created_at=utcnow(), updated_at=utcnow())
    db.add(job)
    db.flush()
    source = Source(
        upload_id=upload.id,
        title=filename,
        source_type="md",
        filename=filename,
        metadata_json=json.dumps({"sha256": upload.sha256}, sort_keys=True),
        chunk_count=1,
        created_at=utcnow(),
        updated_at=utcnow(),
    )
    db.add(source)
    db.flush()
    document = Document(
        source_id=source.id,
        title=filename,
        ordinal=0,
        metadata_json="{}",
        created_at=utcnow(),
    )
    db.add(document)
    db.flush()
    canonical_section = Section(
        document_id=document.id,
        heading_path=section,
        ordinal=0,
        metadata_json="{}",
        created_at=utcnow(),
    )
    db.add(canonical_section)
    db.flush()
    metadata = {
        "source_filename": filename,
        "section_heading": section,
        "embedding_model": "test-embedding-model",
        "embedding_dimensions": 4,
    }
    chunk = DocumentChunk(
        upload_id=upload.id,
        ingestion_job_id=job.id,
        source_id=source.id,
        document_id=document.id,
        section_id=canonical_section.id,
        chunk_index=0,
        content=content,
        content_hash="abc123chunk",
        token_count=len(content.split()),
        metadata_json=json.dumps(metadata, sort_keys=True),
        created_at=utcnow(),
    )
    db.add(chunk)
    db.flush()
    db.add(
        IndexedChunk(
            upload_id=upload.id,
            ingestion_job_id=job.id,
            document_chunk_id=chunk.id,
            qdrant_collection=qdrant_collection,
            qdrant_point_id="point-1",
            embedding_model="test-embedding-model",
            embedding_dimensions=4,
            created_at=utcnow(),
        )
    )
    db.commit()
    db.refresh(chunk)
    return chunk
