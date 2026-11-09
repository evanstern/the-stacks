---
id: TASK-0299
title: Companion and monster turns emit Intents
status: To Do
assignee: []
created_date: '2026-11-08 19:56'
updated_date: '2026-11-09 13:29'
labels:
  - 'ws:intent'
  - replan-2026-11
  - ep-1
milestone: m-10
dependencies:
  - TASK-0269
priority: high
ordinal: 283000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`dm/companion.ts` submits `action.declare` text, so each companion turn costs a companion call plus an interpret call. Monster turns run through the Director. R1 exit criterion 3 (a 4v4 round under 60 s) needs AI actors to emit typed Intents straight to the planner.

Source: docs/design/r1-fast-table-runbook.md finding F5, CP-5 ruling 2026-11-08. Parent epic: TASK-0258. (gap G2).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An AI companion turn emits a typed Intent and makes no interpret call.
- [ ] #2 A monster turn emits typed Intents from its stat block and tactics with no Director prose call on the mechanics path.
- [ ] #3 AI-actor Intents pass the same gate and planner as player Intents, with a test.
- [ ] #4 A fixture 4v4 round with three companions and four monsters completes under 60 s with the fake model.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From spec 096 OQ1 (TASK-0302): prompts/companion.ts still renders a human commenter's user id. Fix it here when companion turns emit Intents.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
