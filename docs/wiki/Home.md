---
title: Wiki Home
status: active
owner: docs
created: 2026-06-03
updated: 2026-06-04
tags:
  - wiki
  - etl
  - docs
---

# Wiki Home

Start here when you need the current architecture notes and roadmap spine.

- [[ETL Architecture]]
- [[ETL Plugin Contracts]]
- [[LangGraph ETL Decision]]
- [[Layer Boundaries]]
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
2. [[ETL Plugin Contracts]] for the extension boundaries.
3. [[LangGraph ETL Decision]] for the orchestration choice.
4. [[Layer Boundaries]] for the roadmap split across layers.
5. [[RAG Retrieval Architecture]] for retrieval scope and dependency rules.
6. [[Corpus Management Architecture]] for corpus lifecycle and ownership.
7. [[Chat Sessions Architecture]] for chat, session, and retrieval wiring.
8. [[Queue Architecture]] for the future queue work placeholder.

## Roadmap continuation

The next implementation plan after ETL is [[rag-retrieval-api-operations|RAG Retrieval + API Operations]], which should follow the boundary map above rather than reopening ETL.
