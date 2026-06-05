---
title: Layer Boundaries
status: active
owner: docs
created: 2026-06-04
updated: 2026-06-04
tags:
  - wiki
  - architecture
  - roadmap
---

# Layer Boundaries

This page records the current roadmap split. It keeps the work separated by layer so each page can stay narrow and the next agent can pick up the right thread.

## Layer map

- [[ETL Architecture]] covers source intake, parsing, chunking, and the staged handoff into later work.
- [[RAG Retrieval Architecture]] covers retrieval requests, ranking, and answer-time lookup rules.
- [[Corpus Management Architecture]] covers corpus selection, import, reset, and lifecycle rules.
- [[Chat Sessions Architecture]] covers user chat sessions, session state, and how retrieval plugs into chat.
- [[Queue Architecture]] is reserved for future queue design and stays a stub for now.

## Ownership and non-ownership

### ETL

- Owns source dispatch, parsing, chunking, and the current staged ETL flow.
- Does not own retrieval policy, corpus lifecycle, or chat session behavior.

### RAG retrieval

- Owns answer-time retrieval behavior and the rules for what can be searched.
- Does not own corpus import, source ingestion, or queue lifecycle.

### Corpus management

- Owns corpus scope, imports, resets, and the rules for what counts as part of a corpus.
- Does not own query-time ranking or chat orchestration.

### Chat sessions

- Owns session state and the chat-facing flow that consumes retrieval results.
- Does not own corpus imports or ETL staging rules.

### Queue

- Remains a future concern.
- Does not carry implementation detail in the wiki yet.

## Dependencies

- RAG retrieval depends on corpus scope. Indexed data is not automatically eligible for every retrieval call.
- Chat depends on retrieval and session state, but not on corpus reset mechanics.
- Corpus management depends on the ETL output shape, but it does not control the ETL flow.
- Queue work should stay separate until a real queue task is ready.

## Open questions

- Which retrieval filters are hard requirements versus optional hints.
- How much corpus scope metadata needs to travel with a chat session.
- Whether queue work lands before or after chat session refinements.

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
