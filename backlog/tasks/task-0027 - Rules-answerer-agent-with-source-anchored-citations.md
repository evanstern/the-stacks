---
id: TASK-0027
title: Rules-answerer agent with source-anchored citations
status: In Progress
assignee: []
created_date: '2026-09-29 02:36'
updated_date: '2026-09-29 18:52'
labels:
  - ai
milestone: m-1
dependencies:
  - TASK-0026
priority: high
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Grounded Q&A over the library. SSE transport per decision-0004.

Spec: specs/018-rules-answerer
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 POST /library/ask streams an answer as text/event-stream
- [ ] #2 Every claim cites a chunk by book, section, and exact quote span
- [ ] #3 The agent refuses to answer when retrieval finds nothing relevant, and says so
- [ ] #4 Tests run against the fake provider
- [ ] #5 Spec phase: Foundational — citation parser, quote verification, config
- [ ] #6 Spec phase: User Story 1 — streamed answer with verified citations (Priority: P1) 🎯 MVP
- [ ] #7 Spec phase: User Story 2 — refuse when nothing is relevant (Priority: P1)
- [ ] #8 Spec phase: User Story 3 — failures, auth, and cancellation (Priority: P2)
- [ ] #9 Spec phase: Polish, re-grounding, and gates
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5
(spec authoring; standing escalation sign-off 2026-09-28; ~194k tokens). No operator checkpoint: operator-only auth follows constitution VIII / A9; no new dependency; no migration. SSE contract: specs/018-rules-answerer/contracts/ask-sse.md (TASK-0028 builds against it). Phase grouping: P1; P2+P3; P4; P5.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
