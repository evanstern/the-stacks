import json

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.auth import current_admin_session
from app.chat_session_service import (
    ChatSessionService,
    SessionMessageNotFoundError,
    chat_session_service,
)
from app.chat_rag import (
    ChatClient,
    RetrievalGraphInvoker,
    get_chat_client,
    get_graph_invoker,
    read_session_messages,
)
from app.config import Settings, get_settings
from app.database import get_db
from app.embeddings import EmbeddingClient, EmbeddingError, get_embedding_client
from app.models import AdminSession, ChatSession, utcnow
from app.qdrant_index import QdrantIndexer, QdrantIndexError, get_qdrant_indexer
from app.retrieval_service import RetrievalService
from app.schemas import (
    ChatMessageCreate,
    ChatMessageEnvelope,
    ChatMessageRead,
    SessionCreate,
    SessionRead,
)


router = APIRouter(prefix="/sessions", tags=["sessions"])


def _embedding_dependency(
    settings: Annotated[Settings, Depends(get_settings)],
) -> EmbeddingClient:
    return get_embedding_client(settings)


def _qdrant_dependency(
    settings: Annotated[Settings, Depends(get_settings)],
) -> QdrantIndexer:
    return get_qdrant_indexer(settings)


def _chat_dependency(
    settings: Annotated[Settings, Depends(get_settings)],
) -> ChatClient:
    return get_chat_client(settings)


def _graph_dependency(
    chat_client: Annotated[ChatClient, Depends(_chat_dependency)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> RetrievalGraphInvoker:
    return get_graph_invoker(chat_client, settings)


def _retrieval_service_dependency(
    db: Annotated[Session, Depends(get_db)],
    embedding_client: Annotated[EmbeddingClient, Depends(_embedding_dependency)],
    qdrant_indexer: Annotated[QdrantIndexer, Depends(_qdrant_dependency)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> RetrievalService:
    return RetrievalService(db, embedding_client, qdrant_indexer, settings)


def _chat_session_service_dependency() -> ChatSessionService:
    return chat_session_service


def _read_session(session: ChatSession) -> SessionRead:
    return SessionRead(
        id=session.id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        metadata=json.loads(session.metadata_json),
    )


@router.get("", response_model=list[SessionRead])
def list_sessions(
    _: AdminSession = Depends(current_admin_session),
    db: Session = Depends(get_db),
) -> list[SessionRead]:
    sessions = db.scalars(
        select(ChatSession).order_by(
            desc(ChatSession.updated_at), desc(ChatSession.created_at)
        )
    ).all()
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
    session = db.scalars(
        select(ChatSession)
        .order_by(desc(ChatSession.updated_at), desc(ChatSession.created_at))
        .limit(1)
    ).first()
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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found"
        )
    return _read_session(session)


@router.get("/{session_id}/messages", response_model=list[ChatMessageRead])
def list_session_messages(
    session_id: str,
    _: AdminSession = Depends(current_admin_session),
    db: Session = Depends(get_db),
    chat_session_service_dependency: ChatSessionService = Depends(
        _chat_session_service_dependency
    ),
) -> list[ChatMessageRead]:
    if db.get(ChatSession, session_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found"
        )
    return [
        chat_session_service_dependency.read_chat_message(db, message)
        for message in read_session_messages(db, session_id)
    ]


@router.post("/{session_id}/messages", response_model=ChatMessageEnvelope)
def create_session_message(
    session_id: str,
    payload: ChatMessageCreate,
    _: AdminSession = Depends(current_admin_session),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    chat_client: ChatClient = Depends(_chat_dependency),
    graph_invoker: RetrievalGraphInvoker = Depends(_graph_dependency),
    retrieval_service: RetrievalService = Depends(_retrieval_service_dependency),
    chat_session_service_dependency: ChatSessionService = Depends(
        _chat_session_service_dependency
    ),
) -> ChatMessageEnvelope:
    try:
        return chat_session_service_dependency.answer_session_message_envelope(
            db,
            session_id,
            payload.content,
            chat_client=chat_client,
            graph_invoker=graph_invoker,
            retrieval_service=retrieval_service,
            settings=settings,
        )
    except SessionMessageNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found"
        ) from exc
    except (EmbeddingError, QdrantIndexError, RuntimeError) as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_chat_failure_detail(exc),
        ) from exc
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc


def _chat_failure_detail(exc: Exception) -> str:
    if isinstance(exc, EmbeddingError):
        return "Embedding service is unavailable"
    if isinstance(exc, QdrantIndexError):
        return "Retrieval index is unavailable"
    return "Chat response service is unavailable"
