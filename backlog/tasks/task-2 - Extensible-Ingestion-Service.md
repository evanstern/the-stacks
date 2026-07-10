---
id: TASK-2
title: Extensible Ingestion Service
status: Done
assignee: []
created_date: '2026-07-10 18:25'
updated_date: '2026-07-10 18:26'
labels: []
dependencies: []
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Accept-then-async ingestion pipeline: upload intake with tickets, versioned NormalizedDocument plugin contract, shipped ingesters (ddb-saved-html, markdown, generic-html), chunking/embedding/indexing, and per-upload event evidence.

Spec: specs/008-ingestion-service
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Spec phase: Setup (Shared Infrastructure)
- [x] #2 Spec phase: Foundational (Blocking Prerequisites)
- [x] #3 Spec phase: User Story 1 — Upload a D&D Beyond export and get a searchable corpus (Priority: P1) 🎯 MVP
- [x] #4 Spec phase: User Story 2 — See what happened to every upload (Priority: P2)
- [x] #5 Spec phase: User Story 3 — Honest front door: rejection, limits, duplicates (Priority: P3)
- [x] #6 Spec phase: User Story 4 — Generic material through fallback ingesters (Priority: P4)
- [x] #7 Spec phase: User Story 5 — Add a new ingester without touching the pipeline core (Priority: P5)
- [x] #8 Spec phase: Polish & Cross-Cutting Concerns
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
spec-bridge sync: Setup (Shared Infrastructure): 5/5 · Foundational (Blocking Prerequisites): 7/7 · User Story 1 — Upload a D&D Beyond export and get a searchable corpus (Priority: P1) 🎯 MVP: 18/18 · User Story 2 — See what happened to every upload (Priority: P2): 6/6 · User Story 3 — Honest front door: rejection, limits, duplicates (Priority: P3): 5/5 · User Story 4 — Generic material through fallback ingesters (Priority: P4): 6/6 · User Story 5 — Add a new ingester without touching the pipeline core (Priority: P5): 4/4 · Polish & Cross-Cutting Concerns: 6/6 — status In Progress → Done
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Setup: 5/5 · Foundational: 7/7 · US1: 18/18 · US2: 6/6 · US3: 5/5 · US4: 6/6 · US5: 4/4 · Polish: 6/6). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->
