import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.chat_citations import (
    _citation_markers_match_contexts,
    _has_unsupported_citation_placement,
    _repair_citation_markers,
    _retrieval_metadata_with_final_citations,
    _validated_citations,
)
from app.chat_rag import (
    NO_EVIDENCE_RESPONSE,
    ChatClient,
    ContextChunk,
    GeneratedAnswer,
    RetrievalGraphInvoker,
    _assistant_message,
    _to_json,
    get_chat_client,
    get_graph_invoker,
)
from app.config import Settings, get_settings
from app.embeddings import EmbeddingClient, get_embedding_client
from app.models import (
    Citation,
    ChatMessage,
    ChatSession,
    DocumentChunk,
    RetrievalRun,
    utcnow,
)
from app.qdrant_index import QdrantIndexer, get_qdrant_indexer
from app.retrieval_service import (
    RetrievalService,
    citation_metadata_by_chunk_id,
    record_retrieval_hits,
    resolve_retrieval_scope,
)
from app.schemas import ChatMessageEnvelope, ChatMessageRead, CitationRead


class SessionMessageNotFoundError(Exception):
    pass


def answer_session_message(
    db: Session,
    session_id: str,
    content: str,
    embedding_client: EmbeddingClient | None = None,
    qdrant_indexer: QdrantIndexer | None = None,
    chat_client: ChatClient | None = None,
    graph_invoker: RetrievalGraphInvoker | None = None,
    retrieval_service: RetrievalService | None = None,
    settings: Settings | None = None,
) -> ChatMessage:
    session = db.get(ChatSession, session_id)
    if session is None:
        raise SessionMessageNotFoundError("Session not found")

    settings = settings or get_settings()
    chat_client = chat_client or get_chat_client(settings)
    graph_invoker = graph_invoker or get_graph_invoker(chat_client, settings)
    if retrieval_service is None:
        embedding_client = embedding_client or get_embedding_client(settings)
        qdrant_indexer = qdrant_indexer or get_qdrant_indexer(settings)
        retrieval_service = RetrievalService(
            db, embedding_client, qdrant_indexer, settings
        )

    now = utcnow()
    user_message = ChatMessage(
        chat_session_id=session.id, role="user", content=content, created_at=now
    )
    db.add(user_message)
    db.flush()

    retrieval_run = RetrievalRun(
        chat_session_id=session.id,
        user_message_id=user_message.id,
        query=content,
        status="running",
        metadata_json=_to_json({"thread_id": session.id}),
        created_at=now,
    )
    db.add(retrieval_run)
    db.flush()

    retrieval_scope = resolve_retrieval_scope(db, settings)
    retrieval_result = retrieval_service.retrieve(content, retrieval_scope)
    contexts = [
        ContextChunk.from_candidate(candidate)
        for candidate in retrieval_result.candidates
    ]
    citation_metadata = citation_metadata_by_chunk_id(retrieval_result.citations)
    record_retrieval_hits(db, retrieval_run, retrieval_result)
    retrieval_metadata: dict[str, object] = {
        "thread_id": session.id,
        **retrieval_result.persistence_metadata(),
    }

    if not contexts:
        assistant_message = _commit_no_evidence_turn(
            db, session, retrieval_run, retrieval_metadata
        )
        return assistant_message

    result = graph_invoker.invoke(
        {"question": content, "contexts": contexts},
        {"configurable": {"thread_id": session.id}},
    )
    generation = result["generation"]
    if not isinstance(generation, GeneratedAnswer):
        raise RuntimeError("RAG graph returned an invalid generation")
    cited_contexts = _validated_citations(generation, contexts)
    if not cited_contexts:
        assistant_message = _commit_no_evidence_turn(
            db, session, retrieval_run, retrieval_metadata
        )
        return assistant_message

    repaired_answer = _repair_citation_markers(
        generation.answer, cited_contexts, contexts
    )
    if repaired_answer is None or _has_unsupported_citation_placement(repaired_answer):
        assistant_message = _commit_no_evidence_turn(
            db, session, retrieval_run, retrieval_metadata
        )
        return assistant_message

    if not _citation_markers_match_contexts(repaired_answer, cited_contexts):
        assistant_message = _commit_no_evidence_turn(
            db, session, retrieval_run, retrieval_metadata
        )
        return assistant_message

    assistant_message = _assistant_message(
        db, session, repaired_answer, {"no_evidence": False}
    )
    retrieval_run.assistant_message_id = assistant_message.id
    retrieval_run.status = "answered"
    retrieval_run.metadata_json = _to_json(
        _retrieval_metadata_with_final_citations(retrieval_metadata, cited_contexts)
    )
    for index, context in enumerate(cited_contexts, start=1):
        db.add(
            Citation(
                assistant_message_id=assistant_message.id,
                retrieval_run_id=retrieval_run.id,
                document_chunk_id=context.chunk_id,
                label=f"[{index}]",
                metadata_json=_to_json(citation_metadata[context.chunk_id]),
                created_at=utcnow(),
            )
        )
    session.updated_at = utcnow()
    db.commit()
    db.refresh(assistant_message)
    return assistant_message


def answer_session_message_envelope(
    db: Session,
    session_id: str,
    content: str,
    embedding_client: EmbeddingClient | None = None,
    qdrant_indexer: QdrantIndexer | None = None,
    chat_client: ChatClient | None = None,
    graph_invoker: RetrievalGraphInvoker | None = None,
    retrieval_service: RetrievalService | None = None,
    settings: Settings | None = None,
) -> ChatMessageEnvelope:
    assistant_message = answer_session_message(
        db,
        session_id,
        content,
        embedding_client=embedding_client,
        qdrant_indexer=qdrant_indexer,
        chat_client=chat_client,
        graph_invoker=graph_invoker,
        retrieval_service=retrieval_service,
        settings=settings,
    )
    return read_chat_message_envelope(db, assistant_message)


def read_chat_message_envelope(
    db: Session, assistant_message: ChatMessage
) -> ChatMessageEnvelope:
    retrieval_run = db.scalars(
        select(RetrievalRun).where(
            RetrievalRun.assistant_message_id == assistant_message.id
        )
    ).one()
    user_message = db.get(ChatMessage, retrieval_run.user_message_id)
    if user_message is None:
        raise LookupError("Persisted chat turn is incomplete")
    return ChatMessageEnvelope(
        user_message=read_chat_message(db, user_message),
        assistant_message=read_chat_message(db, assistant_message),
        retrieval_run_id=retrieval_run.id,
        no_evidence=json.loads(assistant_message.metadata_json).get("no_evidence")
        is True,
    )


def read_chat_message(db: Session, message: ChatMessage) -> ChatMessageRead:
    return ChatMessageRead(
        id=message.id,
        chat_session_id=message.chat_session_id,
        role=message.role,
        content=message.content,
        metadata=json.loads(message.metadata_json),
        citations=[
            _read_citation(db, citation)
            for citation in _message_citations(db, message.id)
        ],
        created_at=message.created_at,
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


def _message_citations(db: Session, message_id: str) -> list[Citation]:
    return list(
        db.scalars(
            select(Citation)
            .where(Citation.assistant_message_id == message_id)
            .order_by(Citation.created_at)
        ).all()
    )


def _commit_no_evidence_turn(
    db: Session,
    session: ChatSession,
    retrieval_run: RetrievalRun,
    retrieval_metadata: dict[str, object],
) -> ChatMessage:
    assistant_message = _assistant_message(
        db, session, NO_EVIDENCE_RESPONSE, {"no_evidence": True}
    )
    retrieval_run.assistant_message_id = assistant_message.id
    retrieval_run.status = "no_evidence"
    retrieval_run.metadata_json = _to_json(retrieval_metadata)
    session.updated_at = utcnow()
    db.commit()
    db.refresh(assistant_message)
    return assistant_message


class ChatSessionService:
    def answer_session_message_envelope(
        self,
        db: Session,
        session_id: str,
        content: str,
        embedding_client: EmbeddingClient | None = None,
        qdrant_indexer: QdrantIndexer | None = None,
        chat_client: ChatClient | None = None,
        graph_invoker: RetrievalGraphInvoker | None = None,
        retrieval_service: RetrievalService | None = None,
        settings: Settings | None = None,
    ) -> ChatMessageEnvelope:
        return answer_session_message_envelope(
            db,
            session_id,
            content,
            embedding_client=embedding_client,
            qdrant_indexer=qdrant_indexer,
            chat_client=chat_client,
            graph_invoker=graph_invoker,
            retrieval_service=retrieval_service,
            settings=settings,
        )

    def read_chat_message(self, db: Session, message: ChatMessage) -> ChatMessageRead:
        return read_chat_message(db, message)


chat_session_service = ChatSessionService()
