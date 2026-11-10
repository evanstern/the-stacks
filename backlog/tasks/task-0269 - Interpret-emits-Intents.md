---
id: TASK-0269
title: Interpret emits Intents
status: To Do
assignee: []
created_date: '2026-11-07 05:13'
updated_date: '2026-11-10 03:11'
labels:
  - 'ws:intent'
  - replan-2026-11
  - ep-1
milestone: m-10
dependencies:
  - TASK-0266
  - TASK-0268
ordinal: 253000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Change `dm.interpret` to output Intents through structured output. Slash-form text bypasses the model. Ambiguous text returns a clarify question.

Parent epic: TASK-0258.

Source: docs/design/replan-2026-11/board-rework-map.md (N-04).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Slash commands produce Intents with zero model calls.
- [ ] #2 Interpret output validates against the Intent schema on attempt 1 in >= 99% of the playtest corpus.
- [ ] #3 A compound declaration yields one Intent per stage, each planned in turn.
- [ ] #4 `resolve.ts` loses the code paths the planner now owns (moved from TASK-0267 by F1).
- [ ] #5 Band effects and the free retry (autoSuccess) keep working beside the Intent path until a card puts stakes on Intents (spec 097 OQ-5).
- [ ] #6 The encounter-start gathering in resolve.ts is removed once spatial placement owns it (spec 100 OQ-13).
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
CP-5 ruling 2026-11-08 (docs/design/r1-fast-table-runbook.md) F1: takes AC #4 from TASK-0267.

Operator ruling 2026-11-09 (R1 lane specs 097-100): spec 097 OQ-5 and spec 100 OQ-13 added as AC.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
