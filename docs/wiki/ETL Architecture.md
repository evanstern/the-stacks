---
title: ETL Architecture
status: active
owner: docs
created: 2026-06-03
updated: 2026-06-03
tags:
  - wiki
  - etl
  - architecture
---

# ETL Architecture

This note captures the current shape of the ETL flow so the refactor can stay aligned with it.

## Flow at a glance

1. Ingest an uploaded source.
2. Classify the source before deeper processing.
3. Parse and chunk content.
4. Enqueue embedding and indexing work when the job reaches the later stage.

The contract tests lock a few seams that matter during extraction. Direct DDB saved HTML dispatches before generic HTML, ZIP uploads are stored as `archived_webpage` source archives, and `process_next_queued_job` stops at `awaiting_embedding`.

## Boundaries

- Parsing and chunking happen before embedding.
- ZIP archives keep archive locator metadata.
- The full `process_next_job` path resumes embedding and indexing after the queued-stage work is done.

## Related notes

- [[ETL Plugin Contracts]] for the plugin surface.
- [[LangGraph ETL Decision]] for the orchestration rationale.
