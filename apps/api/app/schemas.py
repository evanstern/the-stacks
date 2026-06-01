from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    password: str = Field(min_length=1)


class AuthStatus(BaseModel):
    authenticated: bool


class SessionCreate(BaseModel):
    title: str | None = Field(default=None, max_length=200)


class SessionRead(BaseModel):
    id: str
    title: str | None
    created_at: datetime
    updated_at: datetime
    metadata: dict[str, object]

    model_config = ConfigDict(from_attributes=True)


class ChatMessageCreate(BaseModel):
    content: str = Field(min_length=1)


class CitationRead(BaseModel):
    id: str
    document_chunk_id: str
    label: str
    metadata: dict[str, object]


class ChatMessageRead(BaseModel):
    id: str
    chat_session_id: str
    role: str
    content: str
    metadata: dict[str, object]
    citations: list[CitationRead]
    created_at: datetime


class ChatMessageEnvelope(BaseModel):
    user_message: ChatMessageRead
    assistant_message: ChatMessageRead
    retrieval_run_id: str
    no_evidence: bool


class UploadQueued(BaseModel):
    upload_id: str
    job_id: str
    queued: bool


class UploadRead(BaseModel):
    id: str
    original_filename: str
    content_type: str
    extension: str
    sha256: str
    size_bytes: int
    created_at: datetime


class IngestionJobRead(BaseModel):
    id: str
    upload_id: str
    status: str
    error_summary: str | None
    metadata: dict[str, object]
    created_at: datetime
    updated_at: datetime


class IngestionEventRead(BaseModel):
    id: str
    ingestion_job_id: str
    upload_id: str
    event_type: str
    message: str | None
    metadata: dict[str, object]
    created_at: datetime


class SourceRead(BaseModel):
    id: str
    upload_id: str
    title: str | None
    original_filename: str
    extension: str
    sha256: str
    chunk_count: int
    indexed_chunk_count: int
    created_at: datetime


class ChunkRead(BaseModel):
    id: str
    upload_id: str
    ingestion_job_id: str
    chunk_index: int
    content: str
    metadata: dict[str, object]
    created_at: datetime


class RetrievalRunRead(BaseModel):
    id: str
    chat_session_id: str
    user_message_id: str
    assistant_message_id: str | None
    query: str
    status: str
    metadata: dict[str, object]
    created_at: datetime


class RecordsStatsRead(BaseModel):
    uploads: int
    jobs: int
    sources: int
    chunks: int
    indexed_chunks: int
    retrieval_runs: int
