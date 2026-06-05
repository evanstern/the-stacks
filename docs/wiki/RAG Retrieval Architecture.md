---
title: RAG Retrieval Architecture
status: active
owner: docs
created: 2026-06-04
updated: 2026-06-05
tags:
  - wiki
  - architecture
  - rag
---

# RAG Retrieval Architecture

This page covers the retrieval layer that answers questions from stored material and records a trace of what it used.

## What this layer owns

- Build the retrieval request from the current chat context and allowed corpus scope.
- Select candidates from indexed chunks that belong to the active scope.
- Rank, trim, and persist the retrieval trace before the answer layer uses the result.

## What this layer does not own

- It does not import source material.
- It does not define corpus membership.
- It does not manage chat session persistence.
- It does not change ETL staging rules.

## Dependencies

- Depends on [[Corpus Management Architecture]] for corpus membership and scope rules.
- Depends on [[Chat Sessions Architecture]] for the active session context.
- Depends on [[ETL Architecture]] for the available chunk shape and indexing output.

Retrieval only uses data that belongs to the active corpus or another explicitly allowed scope. Indexed content is not globally searchable by default.

## Roadmap note

This page is the architecture anchor for the `rag-retrieval-api-operations` plan. That plan should keep retrieval scoped, chat-owned persistence separate, and queue behavior out of the retrieval layer.

## Related notes

- [[Layer Boundaries]]
- [[Corpus Management Architecture]]
- [[Chat Sessions Architecture]]
- [[ETL Architecture]]
