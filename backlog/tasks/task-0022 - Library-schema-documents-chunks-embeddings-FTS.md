---
id: TASK-0022
title: 'Library schema: documents, chunks, embeddings, FTS'
status: To Do
assignee: []
created_date: '2026-09-29 02:36'
labels:
  - library
milestone: m-1
dependencies: []
documentation:
  - backlog/docs/doc-0001 - M1-open-decisions-—-proposals.md
priority: high
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Library plane tables per architecture A3/A9 and decision-0002.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Migrations create documents, chunks, and embeddings tables with a pgvector column of dimension 1024
- [ ] #2 Every embedding row stores model and dim
- [ ] #3 Chunks carry a full-text search column with a GIN index and a vector index
- [ ] #4 Chunks store source anchors: book, section path, and character span
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
