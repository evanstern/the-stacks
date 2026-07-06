---
title: Wiki Home
status: active
owner: docs
created: 2026-06-03
updated: 2026-07-06
tags:
  - wiki
  - v3
  - docs
---

# Wiki Home

The codebase is the **v3 rebuild**, promoted to the repo root on 2026-07-06 when v2 was
retired ([ADR 0001](../adr/0001-retire-v2-before-parity.md)). Start with the v3 page;
the v2 pages below remain as historical reference for the retired app.

## Current architecture (v3)

- [[V3 Walking Skeleton]] — the foundation slice: monorepo layout, compose topology,
  queue/event/vector doctrine, auth, sidecar contract. The next specs (ingestion,
  retrieval, chat) build on this.

Also see the interactive courses in `docs/courses/` (007-v3-skeleton for the current
codebase; inside-the-stacks-v2 for the retired app).

## Historical reference (v2 — retired 2026-07-06)

These pages describe the retired v2 application. They stay for context — v2's designs
informed the v3 grounding docs — but nothing here describes running code anymore.

- [[ETL Architecture]]
- [[Upload Intake Boundary]]
- [[ETL Plugin Contracts]]
- [[LangGraph ETL Decision]]
- [[Layer Boundaries]]
- [[API Boundary Architecture]]
- [[API Refactor Roadmap]]
- [[RAG Retrieval Architecture]]
- [[Corpus Management Architecture]]
- [[Chat Sessions Architecture]]
- [[Queue Architecture]]

## What this wiki is for

This folder holds the durable notes that should stay current as the roadmap moves.

- Keep the notes short and practical.
- Link related pages instead of repeating details.
- Update the `updated` frontmatter field when you change a page.

## Roadmap continuation

The walking skeleton (spec 007) is complete and converged. Next specs build on it:
ingestion (via `packages/ingestion-contract`), retrieval, and chat. v2's roadmap pages
above are closed.
