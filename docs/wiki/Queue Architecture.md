---
title: Queue Architecture
status: active
owner: docs
created: 2026-06-04
updated: 2026-06-04
tags:
  - wiki
  - architecture
  - queue
---

# Queue Architecture

This page is a placeholder for a later queue design task.

## Current state

- Queue architecture is not being specified here yet.
- The wiki only needs a clear marker that queue work is separate from the current ETL, retrieval, corpus, and chat pages.

## Why this stays a stub

- The current roadmap is still sorting the higher-value layers first.
- A detailed queue design would be premature until the work actually needs it.

## Roadmap note

Queue is intentionally deferred. When it becomes the focus, it should get its own plan and wiki page that describes job claiming, lease/retry semantics, and orchestration boundaries without taking over corpus or retrieval policy.

## Related notes

- [[Layer Boundaries]]
- [[ETL Architecture]]
- [[Chat Sessions Architecture]]
