---
title: Wiki Home
status: active
owner: docs
created: 2026-06-03
updated: 2026-07-10
tags:
  - wiki
  - v3
  - docs
---

# Wiki Home

The codebase is the **v3 rebuild**, promoted to the repo root on 2026-07-06 when v2 was
retired ([ADR 0001](../adr/0001-retire-v2-before-parity.md)).

## Current architecture

- [[Walking Skeleton]] — the foundation slice: monorepo layout, compose topology,
  queue/event/vector doctrine, auth, sidecar contract. Ingestion, retrieval, and chat
  build on this.
- [[Ingestion]] — the extensible ingestion pipeline (spec 008): the plugin seam
  (`@stacks/ingestion-contract`/`-plugins`), detection dispatch, structure-aware
  chunking, and generation-flip re-ingestion. Retrieval and chat build on what this
  produces: indexed, traceable passages.
- [[Worktree Environments]] — the per-worktree environment protocol (spec 009):
  deterministic `10×NNN` port blocks, per-worktree compose identity, the
  `mint-worktree-env` tool, and docker lifecycle isolation rules.

Also see the interactive courses under `docs/courses/007-v3-skeleton/` and
`docs/courses/008-ingestion-service/`.

## Historical reference (v2 — retired 2026-07-06)

The retired v2 application's wiki pages (ETL, upload intake, layer boundaries, API
boundary, RAG retrieval, corpus/chat/queue architecture, etc.) and its interactive course
were moved to `.v2/` when v2 was retired. They describe no running code — see
`.v2/wiki/` and `.v2/courses/inside-the-stacks-v2/`. v2's designs informed the current
grounding docs (`docs/grounding/`); its full code lives in git history.

## What this wiki is for

This folder holds the durable notes that should stay current as the roadmap moves.

- Keep the notes short and practical.
- Link related pages instead of repeating details.
- Update the `updated` frontmatter field when you change a page.

## Roadmap continuation

The walking skeleton (spec 007) is complete and converged; the extensible ingestion
pipeline (spec 008) has all five user stories implemented and is finishing its
verify-convergence step. Next specs build on ingestion's output (indexed, traceable
passages): retrieval and chat. v2's roadmap is closed (its pages are archived under
`.v2/`).
