---
id: TASK-0025
title: D&D Beyond HTML parser with fixtures
status: In Progress
assignee: []
created_date: '2026-09-29 02:36'
updated_date: '2026-09-29 03:13'
labels:
  - library
milestone: m-1
dependencies: []
priority: high
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
First-class DDB export parser per A9 and decision-0003.

Spec: specs/012-ddb-parser
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Committed synthetic fixtures mirror DDB structure with original or SRD 5.1 text
- [ ] #2 Parser emits sections, tables, and stat blocks with anchors
- [ ] #3 A local-only real-export suite runs when fixtures/private exists and skips with a visible notice otherwise
- [ ] #4 fixtures/private is gitignored
- [ ] #5 Spec phase: Setup
- [ ] #6 Spec phase: Foundational — types, selectors, fixtures
- [ ] #7 Spec phase: User Story 1 — anchored sections (Priority: P1) 🎯 MVP
- [ ] #8 Spec phase: User Story 2 — tables and stat blocks whole (Priority: P2)
- [ ] #9 Spec phase: User Story 3 — private real-export suite (Priority: P3)
- [ ] #10 Spec phase: Polish & cross-cutting
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spec 012 authored (f7a2794): spec, plan, research, data-model, contracts/parser.md, quickstart, tasks (22 tasks, 6 phases). Clarify skipped — A9 and decision-0003 settle direction. OPERATOR CHECKPOINT: new runtime dependency parse5 ^8 (research R2) needs approval before Phase 1 dispatch.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
