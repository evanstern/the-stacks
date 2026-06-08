---
title: Wiki Home
status: active
owner: docs
created: 2026-06-03
updated: 2026-06-07
tags:
  - wiki
  - etl
  - docs
---

# Wiki Home

Start here for the current architecture spine, then read the ETL and upload intake notes before the layer-specific architecture pages.

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

## Current reading order

1. [[ETL Architecture]] for the system shape.
2. [[Upload Intake Boundary]] for the bounded upload orchestration review and the route-versus-service decision.
3. [[ETL Plugin Contracts]] for the extension boundaries.
4. [[LangGraph ETL Decision]] for the orchestration choice.
5. [[API Boundary Architecture]] for the route and service contract, dependency injection, error mapping, response schemas, test seams, and wiki preflight and postflight rules.
6. [[Layer Boundaries]] for the ownership split across layers.
7. [[API Refactor Roadmap]] for the R1 to R7 backend follow-up phases that can later become separate Spec Kit features.
8. [[Corpus Management Architecture]] for the current default-corpus contract and scope control.
9. [[RAG Retrieval Architecture]] for retrieval scope, trace, and answer-time behavior.
10. [[Chat Sessions Architecture]] for chat, session state, and retrieval wiring.
11. [[Queue Architecture]] for the deferred queue stub.

## Roadmap continuation

The next implementation plan after ETL was [[RAG Retrieval Architecture|RAG Retrieval + API Operations]], which is now complete. The corpus contract page is already merged and should be read as current state, not as pending work.
