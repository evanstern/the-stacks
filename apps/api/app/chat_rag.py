import json
from collections.abc import Sequence
from dataclasses import dataclass
from importlib import import_module
from typing import Any, TypedDict, cast

import httpx
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.graph import END, START, StateGraph
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.embeddings import EmbeddingClient
from app.models import Citation, ChatMessage, ChatSession, utcnow
from app.qdrant_index import QdrantIndexer
from app.retrieval_service import RetrievalCandidate, RetrievalService


class PersistedChatTurnIncompleteError(Exception):
    pass


NO_EVIDENCE_RESPONSE = (
    "I do not have enough evidence in the indexed corpus to answer that question."
)


@dataclass(frozen=True)
class ContextChunk:
    chunk_id: str
    content: str
    score: float
    metadata: dict[str, object]

    @classmethod
    def from_candidate(cls, candidate: RetrievalCandidate) -> "ContextChunk":
        return cls(
            chunk_id=candidate.chunk_id,
            content=candidate.content,
            score=candidate.score,
            metadata=candidate.metadata,
        )


@dataclass(frozen=True)
class GeneratedAnswer:
    answer: str
    cited_chunk_ids: list[str]


from app.chat_citations import (  # noqa: E402
    _citation_markers_match_contexts,
    _has_unsupported_citation_placement,
    _repair_citation_markers,
    _retrieval_metadata_with_final_citations,
    _validated_citations,
)


class RagGraphState(TypedDict):
    question: str
    contexts: list[ContextChunk]
    generation: GeneratedAnswer | None


class ChatClient:
    model: str = ""

    def generate_answer(
        self, question: str, contexts: Sequence[ContextChunk]
    ) -> GeneratedAnswer:
        raise NotImplementedError


class OpenAIChatClient(ChatClient):
    def __init__(self, settings: Settings) -> None:
        self.api_key = settings.openai_api_key
        self.model = settings.openai_chat_model

    def generate_answer(
        self, question: str, contexts: Sequence[ContextChunk]
    ) -> GeneratedAnswer:
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
            raise RuntimeError(
                f"OpenAI chat request failed: {response.text[:1000]}"
            ) from exc
        content = response.json()["choices"][0]["message"]["content"]
        payload = json.loads(content)
        return GeneratedAnswer(
            answer=str(payload.get("answer", "")),
            cited_chunk_ids=list(payload.get("citations", [])),
        )


class RetrievalGraphInvoker:
    def __init__(self, chat_client: ChatClient) -> None:
        self.chat_client = chat_client
        self.graph = _compile_state_graph(chat_client, None)

    def invoke(
        self, state: dict[str, object], config: dict[str, object]
    ) -> dict[str, object]:
        return self.graph.invoke(_graph_state(state), cast(Any, config))


class PostgresCheckpointedGraphInvoker(RetrievalGraphInvoker):
    def __init__(self, chat_client: ChatClient, database_url: str) -> None:
        super().__init__(chat_client)
        self.chat_client = chat_client
        self.database_url = _psycopg_conn_string(database_url)

    def invoke(
        self, state: dict[str, object], config: dict[str, object]
    ) -> dict[str, object]:
        with PostgresSaver.from_conn_string(self.database_url) as checkpointer:
            graph = _compile_state_graph(self.chat_client, checkpointer)
            return graph.invoke(_graph_state(state), cast(Any, config))


def get_chat_client(settings: Settings) -> ChatClient:
    return OpenAIChatClient(settings)


def get_graph_invoker(
    chat_client: ChatClient, settings: Settings
) -> RetrievalGraphInvoker:
    if settings.database_url.startswith("postgresql"):
        return PostgresCheckpointedGraphInvoker(chat_client, settings.database_url)
    return RetrievalGraphInvoker(chat_client)


def setup_langgraph_checkpointer(database_url: str) -> None:
    if not database_url.startswith("postgresql"):
        return
    with PostgresSaver.from_conn_string(
        _psycopg_conn_string(database_url)
    ) as checkpointer:
        checkpointer.setup()


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
    service_answer_session_message = cast(
        Any, import_module("app.chat_session_service")
    ).answer_session_message

    return cast(
        ChatMessage,
        service_answer_session_message(
            db,
            session_id,
            content,
            embedding_client=embedding_client,
            qdrant_indexer=qdrant_indexer,
            chat_client=chat_client,
            graph_invoker=graph_invoker,
            retrieval_service=retrieval_service,
            settings=settings,
        ),
    )


def _assistant_message(
    db: Session, session: ChatSession, content: str, metadata: dict[str, object]
) -> ChatMessage:
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
    return list(
        db.scalars(
            select(ChatMessage)
            .where(ChatMessage.chat_session_id == session_id)
            .order_by(ChatMessage.created_at)
        ).all()
    )


def message_citations(db: Session, message_id: str) -> list[Citation]:
    return list(
        db.scalars(
            select(Citation)
            .where(Citation.assistant_message_id == message_id)
            .order_by(Citation.created_at)
        ).all()
    )


def _system_prompt() -> str:
    return (
        "Answer only from the supplied context. Return JSON with answer and citations as chunk IDs. "
        "Write the answer in concise Markdown when helpful, and use Markdown tables for comparisons or structured summaries when they improve clarity. "
        "Keep bracketed citation markers like [1] or [2][3] immediately next to the supported claims in the answer text, "
        "where each marker corresponds to the order of the returned citations. "
        "Every factual sentence must carry its citation inline at the sentence level, and if the same source supports multiple factual sentences, repeat the same marker on each sentence. "
        "Repeat [1] on every factual sentence that the same source supports. "
        "Never leave citations only at the end of a paragraph when they belong to multiple sentences. "
        "When two sources support one sentence, keep [1][2] immediately after that sentence. "
        "Put citations on each bullet line that makes a factual claim. "
        "Good: 'Ancient red dragons prefer volcanic lairs. [1] They hoard treasure obsessively. [1]'. "
        "Good: 'Ancient red dragons are volcanic and greedy. [1][2]'. "
        "Good: '- Ancient red dragons prefer volcanic lairs. [1]'. "
        "Bad: 'Ancient red dragons prefer volcanic lairs. They hoard treasure obsessively. [1]' because paragraph-end-only citations hide which sentence is supported."
    )


def _user_prompt(question: str, contexts: Sequence[ContextChunk]) -> str:
    context_text = "\n\n".join(
        f"chunk_id={context.chunk_id}\n{context.content}" for context in contexts
    )
    return f"Question: {question}\n\nContext:\n{context_text}"


def _to_json(value: dict[str, object]) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def _compile_state_graph(chat_client: ChatClient, checkpointer: Any | None):
    graph = StateGraph(RagGraphState)

    def generate(state: RagGraphState) -> dict[str, GeneratedAnswer]:
        return {
            "generation": chat_client.generate_answer(
                state["question"], state["contexts"]
            )
        }

    graph.add_node("generate", generate)
    graph.add_edge(START, "generate")
    graph.add_edge("generate", END)
    return graph.compile(checkpointer=cast(Any, checkpointer))


def _graph_state(state: dict[str, object]) -> RagGraphState:
    return {
        "question": str(state["question"]),
        "contexts": list(cast(Sequence[ContextChunk], state["contexts"])),
        "generation": None,
    }


def _psycopg_conn_string(database_url: str) -> str:
    return database_url.replace("postgresql+psycopg://", "postgresql://", 1)
