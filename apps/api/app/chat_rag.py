import json
from collections.abc import Sequence
from dataclasses import dataclass
from typing import TypedDict

import httpx
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.graph import END, START, StateGraph
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.embeddings import EmbeddingClient, get_embedding_client
from app.models import Citation, ChatMessage, ChatSession, DocumentChunk, RetrievalHit, RetrievalRun, utcnow
from app.qdrant_index import QdrantIndexer, QdrantSearchHit, get_qdrant_indexer


NO_EVIDENCE_RESPONSE = "I do not have enough evidence in the indexed corpus to answer that question."


@dataclass(frozen=True)
class ContextChunk:
    chunk_id: str
    content: str
    score: float
    metadata: dict[str, object]


@dataclass(frozen=True)
class GeneratedAnswer:
    answer: str
    cited_chunk_ids: list[str]


class RagGraphState(TypedDict):
    question: str
    contexts: list[ContextChunk]
    generation: GeneratedAnswer | None


class ChatClient:
    model: str

    def generate_answer(self, question: str, contexts: Sequence[ContextChunk]) -> GeneratedAnswer:
        raise NotImplementedError


class OpenAIChatClient(ChatClient):
    def __init__(self, settings: Settings) -> None:
        self.api_key = settings.openai_api_key
        self.model = settings.openai_chat_model

    def generate_answer(self, question: str, contexts: Sequence[ContextChunk]) -> GeneratedAnswer:
        if not self.api_key:
            raise RuntimeError("OPENAI_API_KEY is required for chat")
        response = httpx.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={
                "model": self.model,
                "messages": [
                    {"role": "system", "content": _system_prompt()},
                    {"role": "user", "content": _user_prompt(question, contexts)},
                ],
                "response_format": {"type": "json_object"},
            },
            timeout=60,
        )
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(f"OpenAI chat request failed: {response.text[:1000]}") from exc
        content = response.json()["choices"][0]["message"]["content"]
        payload = json.loads(content)
        return GeneratedAnswer(answer=str(payload.get("answer", "")), cited_chunk_ids=list(payload.get("citations", [])))


class RetrievalGraphInvoker:
    def __init__(self, chat_client: ChatClient) -> None:
        self.chat_client = chat_client
        self.graph = _compile_state_graph(chat_client, None)

    def invoke(self, state: dict[str, object], config: dict[str, object]) -> dict[str, object]:
        return self.graph.invoke(_graph_state(state), config)


class PostgresCheckpointedGraphInvoker(RetrievalGraphInvoker):
    def __init__(self, chat_client: ChatClient, database_url: str) -> None:
        self.chat_client = chat_client
        self.database_url = _psycopg_conn_string(database_url)

    def invoke(self, state: dict[str, object], config: dict[str, object]) -> dict[str, object]:
        with PostgresSaver.from_conn_string(self.database_url) as checkpointer:
            graph = _compile_state_graph(self.chat_client, checkpointer)
            return graph.invoke(_graph_state(state), config)


def get_chat_client(settings: Settings) -> ChatClient:
    return OpenAIChatClient(settings)


def get_graph_invoker(chat_client: ChatClient, settings: Settings) -> RetrievalGraphInvoker:
    if settings.database_url.startswith("postgresql"):
        return PostgresCheckpointedGraphInvoker(chat_client, settings.database_url)
    return RetrievalGraphInvoker(chat_client)


def setup_langgraph_checkpointer(database_url: str) -> None:
    if not database_url.startswith("postgresql"):
        return
    with PostgresSaver.from_conn_string(_psycopg_conn_string(database_url)) as checkpointer:
        checkpointer.setup()


def answer_session_message(
    db: Session,
    session_id: str,
    content: str,
    embedding_client: EmbeddingClient | None = None,
    qdrant_indexer: QdrantIndexer | None = None,
    chat_client: ChatClient | None = None,
    graph_invoker: RetrievalGraphInvoker | None = None,
    settings: Settings | None = None,
) -> ChatMessage:
    settings = settings or get_settings()
    embedding_client = embedding_client or get_embedding_client(settings)
    qdrant_indexer = qdrant_indexer or get_qdrant_indexer(settings)
    chat_client = chat_client or get_chat_client(settings)
    graph_invoker = graph_invoker or get_graph_invoker(chat_client, settings)

    session = db.get(ChatSession, session_id)
    if session is None:
        raise ValueError("Session not found")

    now = utcnow()
    user_message = ChatMessage(chat_session_id=session.id, role="user", content=content, created_at=now)
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

    contexts = _retrieve_contexts(db, content, embedding_client, qdrant_indexer, settings)
    _record_hits(db, retrieval_run, contexts)

    if not contexts:
        assistant_message = _assistant_message(db, session, NO_EVIDENCE_RESPONSE, {"no_evidence": True})
        retrieval_run.assistant_message_id = assistant_message.id
        retrieval_run.status = "no_evidence"
        retrieval_run.metadata_json = _to_json({"thread_id": session.id, "selected_context_count": 0})
        session.updated_at = utcnow()
        db.commit()
        db.refresh(assistant_message)
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
        assistant_message = _assistant_message(db, session, NO_EVIDENCE_RESPONSE, {"no_evidence": True})
        retrieval_run.assistant_message_id = assistant_message.id
        retrieval_run.status = "no_evidence"
        retrieval_run.metadata_json = _to_json({"thread_id": session.id, "selected_context_count": len(contexts)})
        session.updated_at = utcnow()
        db.commit()
        db.refresh(assistant_message)
        return assistant_message

    assistant_message = _assistant_message(db, session, generation.answer, {"no_evidence": False})
    retrieval_run.assistant_message_id = assistant_message.id
    retrieval_run.status = "answered"
    retrieval_run.metadata_json = _to_json({"thread_id": session.id, "selected_context_count": len(contexts)})
    for index, context in enumerate(cited_contexts, start=1):
        db.add(
            Citation(
                assistant_message_id=assistant_message.id,
                retrieval_run_id=retrieval_run.id,
                document_chunk_id=context.chunk_id,
                label=f"[{index}]",
                metadata_json=_to_json(_citation_metadata(context)),
                created_at=utcnow(),
            )
        )
    session.updated_at = utcnow()
    db.commit()
    db.refresh(assistant_message)
    return assistant_message


def _retrieve_contexts(
    db: Session,
    question: str,
    embedding_client: EmbeddingClient,
    qdrant_indexer: QdrantIndexer,
    settings: Settings,
) -> list[ContextChunk]:
    embedding = embedding_client.embed_texts([question]).vectors[0]
    hits = qdrant_indexer.search_points(embedding, settings.retrieval_top_k)
    contexts: list[ContextChunk] = []
    for hit in hits:
        context = _context_from_hit(db, hit)
        if context is not None and context.score >= settings.retrieval_min_score:
            contexts.append(context)
    return contexts


def _context_from_hit(db: Session, hit: QdrantSearchHit) -> ContextChunk | None:
    chunk_id = hit.payload.get("chunk_id")
    if not isinstance(chunk_id, str):
        return None
    chunk = db.get(DocumentChunk, chunk_id)
    if chunk is None:
        return None
    metadata = json.loads(chunk.metadata_json)
    metadata.update(hit.payload)
    return ContextChunk(chunk_id=chunk.id, content=chunk.content, score=hit.score, metadata=metadata)


def _record_hits(db: Session, retrieval_run: RetrievalRun, contexts: Sequence[ContextChunk]) -> None:
    for rank, context in enumerate(contexts, start=1):
        db.add(
            RetrievalHit(
                retrieval_run_id=retrieval_run.id,
                document_chunk_id=context.chunk_id,
                rank=rank,
                score=f"{context.score:.8f}",
                metadata_json=_to_json(_citation_metadata(context)),
                created_at=utcnow(),
            )
        )


def _validated_citations(generation: GeneratedAnswer, contexts: Sequence[ContextChunk]) -> list[ContextChunk]:
    by_id = {context.chunk_id: context for context in contexts}
    cited: list[ContextChunk] = []
    for chunk_id in generation.cited_chunk_ids:
        context = by_id.get(chunk_id)
        if context is not None and context not in cited:
            cited.append(context)
    if not generation.answer.strip():
        return []
    return cited


def _citation_metadata(context: ContextChunk) -> dict[str, object]:
    metadata = dict(context.metadata)
    metadata["cited_text"] = context.content
    return metadata


def _assistant_message(db: Session, session: ChatSession, content: str, metadata: dict[str, object]) -> ChatMessage:
    assistant_message = ChatMessage(
        chat_session_id=session.id,
        role="assistant",
        content=content,
        metadata_json=_to_json(metadata),
        created_at=utcnow(),
    )
    db.add(assistant_message)
    db.flush()
    return assistant_message


def read_session_messages(db: Session, session_id: str) -> list[ChatMessage]:
    return list(db.scalars(select(ChatMessage).where(ChatMessage.chat_session_id == session_id).order_by(ChatMessage.created_at)).all())


def message_citations(db: Session, message_id: str) -> list[Citation]:
    return list(db.scalars(select(Citation).where(Citation.assistant_message_id == message_id).order_by(Citation.created_at)).all())


def _system_prompt() -> str:
    return (
        "Answer only from the supplied context. Return JSON with answer and citations as chunk IDs. "
        "Use bracketed citation markers like [1] or [2][3] in the answer text next to the claims they support, "
        "where each marker corresponds to the order of the returned citations."
    )


def _user_prompt(question: str, contexts: Sequence[ContextChunk]) -> str:
    context_text = "\n\n".join(f"chunk_id={context.chunk_id}\n{context.content}" for context in contexts)
    return f"Question: {question}\n\nContext:\n{context_text}"


def _to_json(value: dict[str, object]) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def _compile_state_graph(chat_client: ChatClient, checkpointer: object | None):
    graph = StateGraph(RagGraphState)

    def generate(state: RagGraphState) -> dict[str, GeneratedAnswer]:
        return {"generation": chat_client.generate_answer(state["question"], state["contexts"])}

    graph.add_node("generate", generate)
    graph.add_edge(START, "generate")
    graph.add_edge("generate", END)
    return graph.compile(checkpointer=checkpointer)


def _graph_state(state: dict[str, object]) -> RagGraphState:
    return {
        "question": str(state["question"]),
        "contexts": list(state["contexts"]),
        "generation": None,
    }


def _psycopg_conn_string(database_url: str) -> str:
    return database_url.replace("postgresql+psycopg://", "postgresql://", 1)
