---
title: Wiki Home
status: active
owner: docs
created: 2026-06-03
updated: 2026-06-06
tags:
  - wiki
  - etl
  - docs
---

# Wiki Home

Start here for the current architecture spine, then read the corpus contract page before the retrieval notes.

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
4. [[Layer Boundaries]] for the ownership split across layers.
5. [[Corpus Management Architecture]] for the current default-corpus contract and scope control.
6. [[RAG Retrieval Architecture]] for retrieval scope, trace, and answer-time behavior.
7. [[Chat Sessions Architecture]] for chat, session state, and retrieval wiring.
8. [[Queue Architecture]] for the deferred queue stub.

## Roadmap continuation

The next implementation plan after ETL was [[RAG Retrieval Architecture|RAG Retrieval + API Operations]], which is now complete. The corpus contract page is already merged and should be read as current state, not as pending work.
