---
title: Layer Boundaries
status: active
owner: docs
created: 2026-06-04
updated: 2026-06-05
tags:
  - wiki
  - architecture
  - roadmap
---

# Layer Boundaries

This page records the current split across ETL, retrieval, corpus, chat, and queue. It keeps each note narrow and the ownership lines clear.

## Layer map

- [[ETL Architecture]] covers source intake, parsing, chunking, and the staged handoff into later work.
- [[RAG Retrieval Architecture]] covers retrieval requests, ranking, and answer-time lookup rules.
- [[Corpus Management Architecture]] covers corpus selection, import, reset, and lifecycle rules.
- [[Chat Sessions Architecture]] covers user chat sessions, session state, and how retrieval plugs into chat.
- [[Queue Architecture]] stays a stub for future queue design.

## Ownership and non-ownership

### ETL

- Owns source dispatch, parsing, chunking, and the current staged ETL flow.
- Does not own retrieval policy, corpus lifecycle, or chat session behavior.

### RAG retrieval

- Owns answer-time retrieval behavior, trace persistence, and the rules for what can be searched.
- Does not own corpus import, source ingestion, chat session state, or queue lifecycle.

### Corpus management

- Owns corpus scope, imports, resets, and the rules for what counts as part of a corpus.
- Does not own query-time ranking or chat orchestration.

### Chat sessions

- Owns session state, chat persistence, and the chat-facing flow that consumes retrieval results.
- Does not own corpus imports or ETL staging rules.

### Queue

- Remains a future concern.
- Does not carry implementation detail in the wiki yet.

## Dependencies

- RAG retrieval depends on corpus scope and chat context, but it still only searches eligible data.
- Chat depends on retrieval and session state, but not on corpus reset mechanics.
- Corpus management depends on the ETL output shape, but it does not control the ETL flow.
- Queue work should stay separate until a real queue task is ready.

## Roadmap follow-up

- The next implementation plan after ETL is `rag-retrieval-api-operations`.
- That plan should use this boundary map as the contract for retrieval, corpus, chat, and queue ownership.
- Queue remains a placeholder until a dedicated queue design plan is justified.

## Related notes

- [[ETL Architecture]]
- [[ETL Plugin Contracts]]
- [[LangGraph ETL Decision]]
- [[RAG Retrieval Architecture]]
- [[Corpus Management Architecture]]
- [[Chat Sessions Architecture]]
- [[Queue Architecture]]
