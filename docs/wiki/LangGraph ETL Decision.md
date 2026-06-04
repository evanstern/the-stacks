---
title: LangGraph ETL Decision
status: active
owner: docs
created: 2026-06-03
updated: 2026-06-03
tags:
  - wiki
  - etl
  - langgraph
  - decision
---

# LangGraph ETL Decision

LangGraph is the orchestration choice for the ETL refactor.

## Why this path

- The ETL flow has a clear staged shape, so a graph fits the job boundaries.
- The queued stage and the full job path already split cleanly, which makes the orchestration handoff explicit.
- The refactor needs a place to preserve the current dispatch and archive rules without hiding them in a single procedural path.

## Decision notes

- Keep parse and chunk work on the early path.
- Keep embedding and indexing on the later path.
- Preserve the current source dispatch order and archive treatment.

## Related notes

- [[ETL Architecture]] for the process layout.
- [[ETL Plugin Contracts]] for the boundary rules.
