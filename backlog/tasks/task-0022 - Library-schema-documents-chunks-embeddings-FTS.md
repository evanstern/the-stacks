---
id: TASK-0022
title: 'Library schema: documents, chunks, embeddings, FTS'
status: In Progress
assignee: []
created_date: '2026-09-29 02:36'
updated_date: '2026-09-29 05:13'
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
Library plane tables per architecture A3/A9 and decision-0002 (vector dim 1024; model and dim stored per row). Anchors match TASK-0025's parser contract (book, section path, character span).

Spec: specs/013-library-schema
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Migrations create documents, chunks, and embeddings tables with a pgvector column of dimension 1024
- [ ] #2 Every embedding row stores model and dim
- [ ] #3 Chunks carry a full-text search column with a GIN index and a vector index
- [ ] #4 Chunks store source anchors: book, section path, and character span
- [ ] #5 Spec phase: Foundational — schema and migration
- [ ] #6 Spec phase: User Story 1 — store a parsed book with verifiable anchors (Priority: P1) 🎯 MVP
- [ ] #7 Spec phase: User Story 2 — keyword search on every chunk (Priority: P1)
- [ ] #8 Spec phase: User Story 3 — embeddings from several models (Priority: P2)
- [ ] #9 Spec phase: Immutability and polish
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
spec-bridge sync: Foundational — schema and migration: 0/3 · User Story 1 — store a parsed book with verifiable anchors (Priority: P1) 🎯 MVP: 0/3 · User Story 2 — keyword search on every chunk (Priority: P1): 0/1 · User Story 3 — embeddings from several models (Priority: P2): 0/3 · Immutability and polish: 0/5

Spec 013 authored 2026-09-29 (speckit-specify → plan → tasks; clarify skipped: decision-0002, A3 and the parser contract settle every choice). No new dependency. Awaiting implementation dispatch.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5

Phase 1 (T001-T003) done in e11dc3d: migration 0002_tiny_odin.sql (3 tables, vector extension, immutability triggers, GIN + HNSW cosine). ci:check with REQUIRE_DATABASE=1 green against stacks-task-0022 (3022/15022). Fresh-volume apply proven; implementer's 'docker compose down -v' reset only stacks-task-0022 (orchestrator verified: the-stacks-db-1 and its volume untouched; .env untracked). ~167k subagent tokens.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
