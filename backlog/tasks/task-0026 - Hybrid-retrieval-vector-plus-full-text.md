---
id: TASK-0026
title: 'Hybrid retrieval: vector plus full-text'
status: In Progress
assignee: []
created_date: '2026-09-29 02:36'
updated_date: '2026-09-29 15:53'
labels:
  - library
milestone: m-1
dependencies:
  - TASK-0022
  - TASK-0023
priority: high
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Hybrid retrieval per A9. Retrieval mode is configurable so the benchmark (TASK-0029) can compare modes.

Spec: specs/015-hybrid-retrieval
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Retrieval runs vector, FTS, or hybrid by config
- [ ] #2 Hybrid fuses both result lists with a documented rank-fusion method
- [ ] #3 Results carry chunk anchors
- [x] #4 Spec phase: Foundational — contract types, config, fusion
- [x] #5 Spec phase: User Story 1 — ask a question, get cited passages back (Priority: P1) 🎯 MVP
- [x] #6 Spec phase: User Story 2 — choose the retrieval mode by configuration (Priority: P1)
- [x] #7 Spec phase: User Story 3 — hybrid fuses both lists (Priority: P1)
- [ ] #8 Spec phase: Polish and gates
<!-- AC:END -->









## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5
(spec authoring; standing escalation sign-off 2026-09-28). Contract: specs/015-hybrid-retrieval/contracts/retrieval.md. Phase grouping: P1 alone; P2+P3+P4 (US1-3, 7 tasks) one dispatch; P5 alone.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5
(phase 1 Foundational; 11 unit tests)

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5
(phases 2-4, US1-US3; 12 integration tests; 202 pass under REQUIRE_DATABASE=1)

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5
(phase 5 gates+wiki; new note retrieval; 202/202 under REQUIRE_DATABASE=1)
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
