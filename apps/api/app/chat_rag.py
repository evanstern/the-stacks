import json
import re
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, TypedDict, cast

import httpx
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.graph import END, START, StateGraph
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.embeddings import EmbeddingClient, get_embedding_client
from app.models import Citation, ChatMessage, ChatSession, RetrievalRun, utcnow
from app.qdrant_index import QdrantIndexer, get_qdrant_indexer
from app.retrieval_service import (
    RetrievalCandidate,
    RetrievalService,
    citation_metadata_by_chunk_id,
    record_retrieval_hits,
    resolve_retrieval_scope,
)


NO_EVIDENCE_RESPONSE = "I do not have enough evidence in the indexed corpus to answer that question."
_CITATION_MARKER_RE = re.compile(r"\[(\d+)\]")
_BRACKET_TOKEN_RE = re.compile(r"\[([^\[\]]+)\]")


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


class RagGraphState(TypedDict):
    question: str
    contexts: list[ContextChunk]
    generation: GeneratedAnswer | None


class ChatClient:
    model: str = ""

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
        return self.graph.invoke(_graph_state(state), cast(Any, config))


class PostgresCheckpointedGraphInvoker(RetrievalGraphInvoker):
    def __init__(self, chat_client: ChatClient, database_url: str) -> None:
        super().__init__(chat_client)
        self.chat_client = chat_client
        self.database_url = _psycopg_conn_string(database_url)

    def invoke(self, state: dict[str, object], config: dict[str, object]) -> dict[str, object]:
        with PostgresSaver.from_conn_string(self.database_url) as checkpointer:
            graph = _compile_state_graph(self.chat_client, checkpointer)
            return graph.invoke(_graph_state(state), cast(Any, config))


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
    retrieval_service: RetrievalService | None = None,
    settings: Settings | None = None,
) -> ChatMessage:
    settings = settings or get_settings()
    chat_client = chat_client or get_chat_client(settings)
    graph_invoker = graph_invoker or get_graph_invoker(chat_client, settings)
    if retrieval_service is None:
        embedding_client = embedding_client or get_embedding_client(settings)
        qdrant_indexer = qdrant_indexer or get_qdrant_indexer(settings)
        retrieval_service = RetrievalService(db, embedding_client, qdrant_indexer, settings)

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

    retrieval_scope = resolve_retrieval_scope(db, settings)
    retrieval_result = retrieval_service.retrieve(content, retrieval_scope)
    contexts = [ContextChunk.from_candidate(candidate) for candidate in retrieval_result.candidates]
    citation_metadata = citation_metadata_by_chunk_id(retrieval_result.citations)
    record_retrieval_hits(db, retrieval_run, retrieval_result)
    retrieval_metadata: dict[str, object] = {
        "thread_id": session.id,
        **retrieval_result.persistence_metadata(),
    }

    if not contexts:
        assistant_message = _assistant_message(db, session, NO_EVIDENCE_RESPONSE, {"no_evidence": True})
        retrieval_run.assistant_message_id = assistant_message.id
        retrieval_run.status = "no_evidence"
        retrieval_run.metadata_json = _to_json(retrieval_metadata)
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
        retrieval_run.metadata_json = _to_json(retrieval_metadata)
        session.updated_at = utcnow()
        db.commit()
        db.refresh(assistant_message)
        return assistant_message

    repaired_answer = _repair_citation_markers(generation.answer, cited_contexts, contexts)
    if repaired_answer is None or _has_unsupported_citation_placement(repaired_answer):
        assistant_message = _assistant_message(db, session, NO_EVIDENCE_RESPONSE, {"no_evidence": True})
        retrieval_run.assistant_message_id = assistant_message.id
        retrieval_run.status = "no_evidence"
        retrieval_run.metadata_json = _to_json(retrieval_metadata)
        session.updated_at = utcnow()
        db.commit()
        db.refresh(assistant_message)
        return assistant_message

    if not _citation_markers_match_contexts(repaired_answer, cited_contexts):
        assistant_message = _assistant_message(db, session, NO_EVIDENCE_RESPONSE, {"no_evidence": True})
        retrieval_run.assistant_message_id = assistant_message.id
        retrieval_run.status = "no_evidence"
        retrieval_run.metadata_json = _to_json(retrieval_metadata)
        session.updated_at = utcnow()
        db.commit()
        db.refresh(assistant_message)
        return assistant_message

    assistant_message = _assistant_message(db, session, repaired_answer, {"no_evidence": False})
    retrieval_run.assistant_message_id = assistant_message.id
    retrieval_run.status = "answered"
    retrieval_run.metadata_json = _to_json(_retrieval_metadata_with_final_citations(retrieval_metadata, cited_contexts))
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


def _retrieval_metadata_with_final_citations(
    metadata: dict[str, object], cited_contexts: Sequence[ContextChunk]
) -> dict[str, object]:
    trace = metadata.get("trace")
    if not isinstance(trace, dict):
        return metadata
    updated_trace = dict(cast(dict[str, object], trace))
    updated_trace["final_citation_choices"] = [
        {"label": f"[{index}]", "document_chunk_id": context.chunk_id}
        for index, context in enumerate(cited_contexts, start=1)
    ]
    return {**metadata, "trace": updated_trace}


def _validated_citations(generation: GeneratedAnswer, contexts: Sequence[ContextChunk]) -> list[ContextChunk]:
    by_id = {context.chunk_id: context for context in contexts}
    cited: list[ContextChunk] = []
    seen_chunk_ids: set[str] = set()
    invalid_citation_seen = False
    for chunk_id in generation.cited_chunk_ids:
        context = by_id.get(_normalize_generated_citation_id(chunk_id))
        if context is None:
            invalid_citation_seen = True
            continue
        if context.chunk_id not in seen_chunk_ids:
            cited.append(context)
            seen_chunk_ids.add(context.chunk_id)

    marker_contexts = _contexts_from_inline_markers(generation.answer, contexts)
    if marker_contexts:
        marker_ids = {context.chunk_id for context in marker_contexts}
        cited_ids = {context.chunk_id for context in cited}
        if not invalid_citation_seen or marker_ids.issubset(cited_ids):
            return marker_contexts

    if invalid_citation_seen:
        return []
    return cited


def _contexts_from_inline_markers(answer: str, contexts: Sequence[ContextChunk]) -> list[ContextChunk]:
    marker_tokens = [match.group(1).strip() for match in _BRACKET_TOKEN_RE.finditer(answer)]
    if not marker_tokens:
        return []

    zero_marker_seen = any(token == 0 for token in _numeric_marker_tokens(answer))
    cited: list[ContextChunk] = []
    seen_chunk_ids: set[str] = set()
    for raw_token in marker_tokens:
        context = _context_from_inline_marker(raw_token, contexts, zero_marker_seen)
        if context is None:
            return []
        if context.chunk_id not in seen_chunk_ids:
            cited.append(context)
            seen_chunk_ids.add(context.chunk_id)
    return cited


def _context_from_inline_marker(raw_token: str, contexts: Sequence[ContextChunk], zero_marker_seen: bool) -> ContextChunk | None:
    token = _normalize_generated_citation_id(raw_token)
    if token.isdigit():
        context_index = _context_index_from_numeric_marker(int(token), zero_marker_seen)
        if context_index is None or context_index >= len(contexts):
            return None
        return contexts[context_index]

    matching_contexts = [context for context in contexts if context.chunk_id == token or context.chunk_id.startswith(token)]
    if len(matching_contexts) == 1:
        return matching_contexts[0]
    return None


def _numeric_marker_tokens(answer: str) -> list[int]:
    tokens: list[int] = []
    for match in _BRACKET_TOKEN_RE.finditer(answer):
        token = match.group(1).strip()
        if not token.isdigit():
            continue
        tokens.append(int(token))
    return tokens


def _context_index_from_numeric_marker(token: int, zero_marker_seen: bool) -> int | None:
    if token == 0:
        return 0 if zero_marker_seen else None
    return token - 1


def _has_unsupported_citation_placement(answer: str) -> bool:
    if not answer.strip():
        return True
    if _has_duplicate_adjacent_citation_marker(answer):
        return True
    for line in answer.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("```"):
            continue
        if stripped.count("|") >= 2:
            continue
        if _contains_invalid_bracket_token(stripped):
            return True
    return False


def _has_duplicate_adjacent_citation_marker(answer: str) -> bool:
    previous_label: str | None = None
    previous_end = -1
    for match in _CITATION_MARKER_RE.finditer(answer):
        label = match.group(1)
        if label == previous_label and answer[previous_end : match.start()].strip() == "":
            return True
        previous_label = label
        previous_end = match.end()
    return False


def _contains_invalid_bracket_token(line: str) -> bool:
    for match in _BRACKET_TOKEN_RE.finditer(line):
        token = match.group(1).strip()
        if token.isdigit():
            continue
        return True
    return False


def _repair_citation_markers(answer: str, cited_contexts: Sequence[ContextChunk], contexts: Sequence[ContextChunk]) -> str | None:
    if not _BRACKET_TOKEN_RE.search(answer):
        if not cited_contexts:
            return answer
        labels = "".join(f"[{index}]" for index, _ in enumerate(cited_contexts, start=1))
        return f"{answer.rstrip()} {labels}"

    repaired_parts: list[str] = []
    last_index = 0
    zero_marker_seen = any(token == 0 for token in _numeric_marker_tokens(answer))
    for match in _BRACKET_TOKEN_RE.finditer(answer):
        repaired_parts.append(answer[last_index:match.start()])
        token = _normalize_generated_citation_id(match.group(1))
        numeric_label = int(token) if token.isdigit() else None
        if numeric_label is not None:
            context_index = _context_index_from_numeric_marker(numeric_label, zero_marker_seen)
            if context_index is None or context_index >= len(contexts):
                return None
            label = _label_for_context(contexts[context_index], cited_contexts)
            if label is None:
                return None
            repaired_parts.append(f"[{label}]")
        else:
            label = _label_for_citation_token(token, cited_contexts)
            if label is None:
                return None
            repaired_parts.append(f"[{label}]")
        last_index = match.end()
    repaired_parts.append(answer[last_index:])
    return "".join(repaired_parts)


def _label_for_context(target_context: ContextChunk, cited_contexts: Sequence[ContextChunk]) -> int | None:
    for index, context in enumerate(cited_contexts, start=1):
        if context.chunk_id == target_context.chunk_id:
            return index
    return None


def _label_for_citation_token(token: str, cited_contexts: Sequence[ContextChunk]) -> int | None:
    matching_labels = [index for index, context in enumerate(cited_contexts, start=1) if context.chunk_id == token or context.chunk_id.startswith(token)]
    if len(matching_labels) == 1:
        return matching_labels[0]
    return None


def _normalize_generated_citation_id(chunk_id: str) -> str:
    normalized = chunk_id.strip()
    if normalized.startswith("chunk_id="):
        return normalized.removeprefix("chunk_id=").strip()
    return normalized


def _citation_markers_match_contexts(answer: str, cited_contexts: Sequence[ContextChunk]) -> bool:
    marker_labels: list[int] = []
    seen_labels: set[int] = set()
    for match in _CITATION_MARKER_RE.finditer(answer):
        label = int(match.group(1))
        if label not in seen_labels:
            seen_labels.add(label)
            marker_labels.append(label)
    if not marker_labels:
        return not cited_contexts
    expected_labels = list(range(1, len(cited_contexts) + 1))
    return marker_labels == expected_labels


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
    context_text = "\n\n".join(f"chunk_id={context.chunk_id}\n{context.content}" for context in contexts)
    return f"Question: {question}\n\nContext:\n{context_text}"


def _to_json(value: dict[str, object]) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def _compile_state_graph(chat_client: ChatClient, checkpointer: Any | None):
    graph = StateGraph(RagGraphState)

    def generate(state: RagGraphState) -> dict[str, GeneratedAnswer]:
        return {"generation": chat_client.generate_answer(state["question"], state["contexts"])}

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
