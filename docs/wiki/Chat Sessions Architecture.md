---
title: Chat Sessions Architecture
status: active
owner: docs
created: 2026-06-04
updated: 2026-06-04
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

## What this layer does not own

- It does not define corpus membership.
- It does not change ETL processing rules.
- It does not decide which indexed data is eligible for retrieval.

## Dependencies

- Depends on [[RAG Retrieval Architecture]] for answer-time lookup.
- Depends on [[Corpus Management Architecture]] for the active corpus scope.
- Depends on [[ETL Architecture]] only for the indexed data shape it consumes indirectly.

## Open questions

- How much retrieval detail should be stored in the session record.
- Whether failed retrieval should be visible inline or only in records.
- How session context should remember corpus changes mid-conversation.

## Roadmap note

Chat is a consumer of retrieval, not the owner of retrieval policy. The next retrieval plan should keep this separation explicit so session state does not absorb corpus lifecycle or retrieval ranking rules.

## Related notes

- [[Layer Boundaries]]
- [[RAG Retrieval Architecture]]
- [[Corpus Management Architecture]]
- [[ETL Architecture]]
