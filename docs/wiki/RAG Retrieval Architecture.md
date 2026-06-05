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
- Resolve the active runtime scope before lookup begins.
- Filter out candidates that do not belong to the current scope.
- Persist the retrieval trace and the hit metadata that chat and records views rely on.
- The scope filter that stops cross-corpus lookups before they reach the answer layer.

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

## Current implementation

- `RetrievalService` owns the answer-time retrieval flow.
- `RetrievalScope` carries the active runtime context and the Qdrant collection to search.
- `CandidateLookupAdapter` performs the candidate lookup against the active scope.
- `CandidateRankingAdapter` filters missing or out-of-scope chunks, applies the score threshold, deduplicates, and trims the final set.
- `RetrievalService.retrieve()` embeds the query, asks the lookup adapter for candidates, runs ranking, assembles citations, and returns trace metadata.
- `record_retrieval_hits()` persists the retrieval hits so the trace survives outside the request.
- The result shape also carries weak-result reasons when retrieval produces a thin answer set.

## Scope filtering

- Only chunks in the active runtime scope are eligible by default.
- Scope is resolved before lookup, not after ranking.
- The retrieval result carries weak-result reasons when the search turns up little useful material.
- The trace includes enough metadata for the chat layer and records views to reconstruct what happened.
- This is the same scope discipline that `chat_rag.py` and the records routes depend on.

## Roadmap note

This page is the architecture anchor for the `rag-retrieval-api-operations` plan. That plan should keep retrieval scoped, chat-owned persistence separate, and queue behavior out of the retrieval layer.

## Related notes

- [[Layer Boundaries]]
- [[Corpus Management Architecture]]
- [[Chat Sessions Architecture]]
- [[ETL Architecture]]
