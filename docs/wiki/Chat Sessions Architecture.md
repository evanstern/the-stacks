---
title: Chat Sessions Architecture
status: active
owner: docs
created: 2026-06-04
updated: 2026-06-05
tags:
  - wiki
  - architecture
  - chat
---

# Chat Sessions Architecture

This page covers the chat layer that owns session state and the path from a user message to a retrieval-backed response.

## What this layer owns

- Session creation, loading, and persistence.
- The chat loop that sends the current message into retrieval.
- The user-facing shape of chat results and session history.
- The route boundary that turns session requests into a retrieval-backed response.
- The answer envelope returned to the client, including the safe failure shape.
- Citation validation and repair after the answer graph produces output.
- The route/session split that keeps HTTP handling thin while the chat layer owns persistence.

## What this layer does not own

- It does not define corpus membership.
- It does not change ETL processing rules.
- It does not decide which indexed data is eligible for retrieval.

## Dependencies

- Depends on [[RAG Retrieval Architecture]] for answer-time lookup and trace data.
- Depends on [[Corpus Management Architecture]] for the active corpus scope.
- Depends on [[ETL Architecture]] only for the indexed data shape it consumes indirectly.

## Request path

- `routes_sessions.py` is a thin HTTP boundary: it wires the session routes, injects dependencies, invokes the chat service facade, maps errors to safe HTTP shapes, and returns `ChatMessageEnvelope`.
- `answer_session_message()` in `chat_rag.py` is a compatibility facade that delegates to `chat_session_service.py`, which owns the chat-turn orchestration: user/assistant persistence, retrieval-run lifecycle, retrieval calls, graph invocation, citation validation/repair (via `chat_citations.py`), and session timestamp updates.
- The route returns a `ChatMessageEnvelope`, not a raw internal result object.
- Embedding, Qdrant, and runtime failures are mapped to a safe `503` response shape.
- Citation validation remains a chat-owned step after the answer graph completes.

## Chat-owned boundaries

- LangGraph is used here for chat answer generation and checkpointing.
- Citation validation and repair stay in the chat layer after the answer graph returns.
- Session persistence stays separate from retrieval trace persistence, even though the two are linked in the request flow.

## Roadmap note

Chat is a consumer of retrieval, not the owner of retrieval policy. The retrieval plan should keep session state, trace storage, and corpus lifecycle in separate lanes.

## Related notes

- [[Layer Boundaries]]
- [[RAG Retrieval Architecture]]
- [[Corpus Management Architecture]]
- [[ETL Architecture]]
