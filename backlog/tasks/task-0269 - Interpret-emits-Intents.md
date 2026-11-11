---
id: TASK-0269
title: Interpret emits Intents
status: In Progress
assignee: []
created_date: 2026-11-07 05:13
updated_date: '2026-11-11T19:50:00Z'
labels:
  - ws:intent
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

Spec: specs/104-interpret-intents
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Slash commands produce Intents with zero model calls.
- [ ] #2 Interpret output validates against the Intent schema on attempt 1 in >= 99% of the playtest corpus.
- [ ] #3 A compound declaration yields one Intent per stage, each planned in turn.
- [ ] #4 `resolve.ts` loses the code paths the planner now owns (moved from TASK-0267 by F1).
- [ ] #5 Band effects and the free retry (autoSuccess) keep working beside the Intent path until a card puts stakes on Intents (spec 097 OQ-5).
- [ ] #6 The encounter-start gathering in resolve.ts is removed once spatial placement owns it (spec 100 OQ-13).
- [ ] #7 A beat narrates the facts of every intent.recorded row it covers, including rows the gate settled before the turn job ran, as why rows (spec 102 OQ-4; spec 103 OQ-8 window: the job input carries only triggerSeq and intent.recorded has no action link).
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
CP-5 ruling 2026-11-08 (docs/design/r1-fast-table-runbook.md) F1: takes AC #4 from TASK-0267.

Operator ruling 2026-11-09 (R1 lane specs 097-100): spec 097 OQ-5 and spec 100 OQ-13 added as AC.

Claimed 2026-11-11 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0269, branch task-0269-interpret-intents, cut from origin/main 702390db. Spec number 104 claimed with a stub.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5
Spec 104 spec.md + plan.md (2ac78ce1) against 092 06d7ca13, 093 beae54aa, 097 a34d5d39, 100 16ae6147, 102 86d425b6, 103 39c9ed24, base 702390db. Size check: ~52 tasks; split recommended (PR A this card: AC 1,2,3,5,7 ~36 tasks; PR B new card: AC 4,6 ~16 tasks, after TASK-0223). Awaiting operator ruling on the split.
<!-- SECTION:NOTES:END -->
