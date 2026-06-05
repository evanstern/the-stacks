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

This page is still a placeholder for a later queue design task, but the current implementation is worth naming so the stub does not drift.

## Current state

- The live queue behavior is a database-backed claim/status flow.
- `ingestion.py` claims queued jobs and awaiting-embedding jobs with `FOR UPDATE SKIP LOCKED`.
- Upload batches and job rows carry the status information the rest of the app reads.
- There is no standalone brokered queue design in the code today.
- Keep the page intentionally short until a real queue system replaces that flow.

## Why this stays a stub

- The current roadmap is still sorting the higher-value layers first.
- A detailed queue design would be premature until the work actually needs it.
- The wiki should not pretend the current DB claim/status flow is a finished queue subsystem.

## Roadmap note

Queue is intentionally deferred. When it becomes the focus, it should get its own plan and wiki page that describes job claiming, lease/retry semantics, and orchestration boundaries without taking over corpus or retrieval policy.

## Related notes

- [[Layer Boundaries]]
- [[ETL Architecture]]
- [[Chat Sessions Architecture]]
