---
title: RAG Retrieval Architecture
status: active
owner: docs
created: 2026-06-04
updated: 2026-06-04
tags:
  - wiki
  - architecture
  - rag
---

# RAG Retrieval Architecture

This page covers the retrieval layer that answers questions from stored material.

## What this layer owns

- Build the retrieval request from the current chat context and allowed corpus scope.
- Select candidates from indexed chunks or other permitted records.
- Rank and trim results before they reach the answer layer.

## What this layer does not own

- It does not import source material.
- It does not define corpus membership.
- It does not manage chat session persistence.
- It does not change ETL staging rules.

## Dependencies

- Depends on [[Corpus Management Architecture]] for corpus membership and scope rules.
- Depends on [[Chat Sessions Architecture]] for the active session context.
- Depends on [[ETL Architecture]] for the available chunk shape and indexing output.

Retrieval should only use data that belongs to the active corpus or another explicitly allowed scope. The fact that content is indexed does not make it globally searchable.

## Open questions

- Which retrieval sources are allowed outside the active corpus, if any.
- Whether corpus scope should be checked before query execution or after candidate fetch.
- How much of the retrieval trace should be visible in records.

## Roadmap note

This page is the architecture anchor for the `rag-retrieval-api-operations` plan. That plan should implement retrieval as a scoped application service and keep corpus eligibility, chat persistence, and queue behavior separate.

## Related notes

- [[Layer Boundaries]]
- [[Corpus Management Architecture]]
- [[Chat Sessions Architecture]]
- [[ETL Architecture]]
