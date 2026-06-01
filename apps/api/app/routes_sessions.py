import json

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.auth import current_admin_session
from app.chat_rag import (
    ChatClient,
    RetrievalGraphInvoker,
    answer_session_message,
    get_chat_client,
    get_graph_invoker,
    message_citations,
    read_session_messages,
)
from app.config import Settings, get_settings
from app.database import get_db
from app.embeddings import EmbeddingClient, EmbeddingError, get_embedding_client
from app.models import AdminSession, ChatMessage, ChatSession, Citation, DocumentChunk, RetrievalRun, utcnow
from app.qdrant_index import QdrantIndexer, QdrantIndexError, get_qdrant_indexer
from app.schemas import ChatMessageCreate, ChatMessageEnvelope, ChatMessageRead, CitationRead, SessionCreate, SessionRead


router = APIRouter(prefix="/sessions", tags=["sessions"])


def _embedding_dependency(settings: Annotated[Settings, Depends(get_settings)]) -> EmbeddingClient:
    return get_embedding_client(settings)


def _qdrant_dependency(settings: Annotated[Settings, Depends(get_settings)]) -> QdrantIndexer:
    return get_qdrant_indexer(settings)


def _chat_dependency(settings: Annotated[Settings, Depends(get_settings)]) -> ChatClient:
    return get_chat_client(settings)


def _graph_dependency(
    chat_client: Annotated[ChatClient, Depends(_chat_dependency)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> RetrievalGraphInvoker:
    return get_graph_invoker(chat_client, settings)


def _read_session(session: ChatSession) -> SessionRead:
    return SessionRead(
        id=session.id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        metadata=json.loads(session.metadata_json),
    )


def _read_citation(db: Session, citation: Citation) -> CitationRead:
    metadata = json.loads(citation.metadata_json)
    chunk = db.get(DocumentChunk, citation.document_chunk_id)
    if chunk is not None and "cited_text" not in metadata:
        metadata["cited_text"] = chunk.content
    return CitationRead(
        id=citation.id,
        document_chunk_id=citation.document_chunk_id,
        label=citation.label,
        metadata=metadata,
    )


def _read_message(db: Session, message: ChatMessage) -> ChatMessageRead:
    return ChatMessageRead(
        id=message.id,
        chat_session_id=message.chat_session_id,
        role=message.role,
        content=message.content,
        metadata=json.loads(message.metadata_json),
        citations=[_read_citation(db, citation) for citation in message_citations(db, message.id)],
        created_at=message.created_at,
    )


@router.get("", response_model=list[SessionRead])
def list_sessions(
    _: AdminSession = Depends(current_admin_session),
    db: Session = Depends(get_db),
) -> list[SessionRead]:
    sessions = db.scalars(select(ChatSession).order_by(desc(ChatSession.updated_at), desc(ChatSession.created_at))).all()
    return [_read_session(session) for session in sessions]


@router.post("", response_model=SessionRead, status_code=status.HTTP_201_CREATED)
def create_session(
    payload: SessionCreate,
    _: AdminSession = Depends(current_admin_session),
    db: Session = Depends(get_db),
) -> SessionRead:
    now = utcnow()
    session = ChatSession(title=payload.title, created_at=now, updated_at=now)
    db.add(session)
    db.commit()
    db.refresh(session)
    return _read_session(session)


@router.get("/latest", response_model=SessionRead | None)
def latest_session(
    _: AdminSession = Depends(current_admin_session),
    db: Session = Depends(get_db),
) -> SessionRead | None:
    session = db.scalars(select(ChatSession).order_by(desc(ChatSession.updated_at), desc(ChatSession.created_at)).limit(1)).first()
    if session is None:
        return None
    return _read_session(session)


@router.get("/{session_id}", response_model=SessionRead)
def get_session(
    session_id: str,
    _: AdminSession = Depends(current_admin_session),
    db: Session = Depends(get_db),
) -> SessionRead:
    session = db.get(ChatSession, session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return _read_session(session)


@router.get("/{session_id}/messages", response_model=list[ChatMessageRead])
def list_session_messages(
    session_id: str,
    _: AdminSession = Depends(current_admin_session),
    db: Session = Depends(get_db),
) -> list[ChatMessageRead]:
    if db.get(ChatSession, session_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return [_read_message(db, message) for message in read_session_messages(db, session_id)]


@router.post("/{session_id}/messages", response_model=ChatMessageEnvelope)
def create_session_message(
    session_id: str,
    payload: ChatMessageCreate,
    _: AdminSession = Depends(current_admin_session),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    embedding_client: EmbeddingClient = Depends(_embedding_dependency),
    qdrant_indexer: QdrantIndexer = Depends(_qdrant_dependency),
    chat_client: ChatClient = Depends(_chat_dependency),
    graph_invoker: RetrievalGraphInvoker = Depends(_graph_dependency),
) -> ChatMessageEnvelope:
    if db.get(ChatSession, session_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    try:
        message = answer_session_message(
            db,
            session_id,
            payload.content,
            embedding_client=embedding_client,
            qdrant_indexer=qdrant_indexer,
            chat_client=chat_client,
            graph_invoker=graph_invoker,
            settings=settings,
        )
    except (EmbeddingError, QdrantIndexError, RuntimeError) as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    retrieval_run = db.scalars(select(RetrievalRun).where(RetrievalRun.assistant_message_id == message.id)).one()
    user_message = db.get(ChatMessage, retrieval_run.user_message_id)
    if user_message is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Persisted chat turn is incomplete")
    return ChatMessageEnvelope(
        user_message=_read_message(db, user_message),
        assistant_message=_read_message(db, message),
        retrieval_run_id=retrieval_run.id,
        no_evidence=json.loads(message.metadata_json).get("no_evidence") is True,
    )
