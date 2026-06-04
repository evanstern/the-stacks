---
title: ETL Plugin Contracts
status: active
owner: docs
created: 2026-06-03
updated: 2026-06-03
tags:
  - wiki
  - etl
  - contracts
---

# ETL Plugin Contracts

This note describes the boundaries the ETL plugins need to respect.

## Current contract shape

- Source dispatch happens before generic fallback handling.
- ZIP uploads are treated as archived sources, even when the archive contains DDB saved HTML.
- The queued job path is parse and chunk only.
- Embedding and indexing remain on the full job path.

## Practical rules

- Keep source-type decisions explicit.
- Keep archive metadata available for archived uploads.
- Avoid moving embedding into the queued-only path.

## Related notes

- [[ETL Architecture]] for the flow context.
- [[LangGraph ETL Decision]] for why the orchestration boundary sits where it does.
