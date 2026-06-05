---
title: LangGraph ETL Decision
status: active
owner: docs
created: 2026-06-03
updated: 2026-06-05
tags:
  - wiki
  - etl
  - langgraph
  - decision
---

# LangGraph ETL Decision

LangGraph is deferred for ETL. The live ETL runtime is still direct and sequential, while LangGraph is already used in chat answer generation and checkpointing today.

## Why this path

- The ETL flow has a clear staged shape, but the shipped runtime is still `DirectSequentialEtlRunner` in `main/apps/api/app/etl/runner.py`.
- The current ETL path in `main/apps/api/app/ingestion.py` keeps the parse/chunk step and the later embed/index step as ordinary sequential code.
- LangGraph already has a real home in `main/apps/api/app/chat_rag.py`, where it supports the chat answer graph and checkpointing instead of ETL orchestration.

## Decision notes

- Keep parse and chunk work on the early path for now.
- Keep embedding and indexing on the later path for now.
- Preserve the current source dispatch order and archive treatment.
- Treat a LangGraph ETL runtime as a deferred design choice, not the current implementation.

## Current implementation

- ETL jobs are processed directly and sequentially.
- The live runner is `DirectSequentialEtlRunner`, not a LangGraph graph.
- The LangGraph imports in `chat_rag.py` belong to chat-time answer generation and checkpointing.
- That keeps the ETL decision separate from the chat/RAG LangGraph work that already ships.

## Related notes

- [[Layer Boundaries]] for the roadmap split.
- [[ETL Architecture]] for the process layout.
- [[ETL Plugin Contracts]] for the boundary rules.
- [[RAG Retrieval Architecture]] for the next roadmap layer after ETL.
