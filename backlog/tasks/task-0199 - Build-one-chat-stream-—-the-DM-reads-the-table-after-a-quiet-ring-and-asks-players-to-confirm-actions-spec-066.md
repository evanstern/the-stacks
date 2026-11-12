---
id: TASK-0199
title: >-
  Build: one chat stream — the DM reads the table after a quiet ring and asks
  players to confirm actions (spec 066)
status: In Progress
assignee: []
created_date: 2026-11-02 06:46
updated_date: '2026-11-12T02:57:00Z'
labels:
  - web
  - dm
  - playtest
  - ws:table-ux
milestone: m-10
dependencies:
  - TASK-0188
priority: high
ordinal: 178000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
REWRITTEN by replan-2026-11: Quiet ring for exploration only (P-04), on the Intent `declared` state; amend spec 066.

Intent: the play route keeps one composer and one Send button. In exploration and social play, a `declared` Intent waits for the quiet ring; the DM then reacts or posts a confirm row. A 👍 moves the Intent to `confirmed` and sends it to the gate. Combat uses explicit turns: the active player's Enter commits (N-10, TASK-0275). Human-DM tables may turn the ring off. Amend spec 066 after CP-4 freezes the Intent contract (N-01, TASK-0266). UI: no modals. Use Brave for the live check.

Source: docs/design/replan-2026-11/board-rework-map.md (rewrite row), plan-of-action.md §5, target-architecture.md, decisions-for-ratification.md.

Prior scope (superseded): every deed waited for a 2 s + 8 s quiet ring and a 👍 confirm row (decision-0028, D20; TASK-0188 design), with `action.declare {text}` as the only write.

Spec: specs/066-one-chat-stream
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rewritten by replan-2026-11. Quiet ring for exploration only (P-04), on the Intent `declared` state; amend spec 066.

AC re-authored by replan-2026-11.

CP-5 ruling 2026-11-08 (docs/design/r1-fast-table-runbook.md) F2: this card owns the combat Enter-commit rule (AC #4); TASK-0275 builds on it.

T015 (spec 092): amend spec 066 against Intent contract v1.1 (decision-0030 + Amendments) before implementation: confirm row = declared->confirmed; action.suggest carries Intent bodies; quiet ring in exploration only, Enter commits in combat (this card owns it, F2); readable-post rule reads Intent kinds. Review at C-AMD.

Claimed 2026-11-11 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0199, branch task-0199-quiet-ring, cut from origin/main 9e51c948. No spec dir: signed escape line covers this task.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5
Spec 066 amended (282eb567, spec.md + plan.md). 70 tasks in 7 phases: split recommended (0199-server AC 1,2,3,5,6; 0199-web AC 4,7). Frozen-contract amendments C-1..C-9 listed in plan.md. Awaiting C-AMD (and C-GATE) review; tasks.md not re-derived yet.
<!-- SECTION:NOTES:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Spec 066 is amended after CP-4 so the quiet ring runs on the Intent declared state.
- [ ] #2 In exploration and social play, a declared Intent waits for the quiet ring, then gets a DM reaction or confirm row.
- [ ] #3 A 👍 on the confirm row moves the Intent from declared to confirmed and sends it to the gate.
- [ ] #4 In combat, no quiet ring runs; the active player's Enter commits the Intent, with a test.
- [ ] #5 A human-DM table setting turns the quiet ring off, with a test.
- [ ] #6 @dm produces one read-only ask_dm answer that changes no state, with a test.
- [ ] #7 The play route has one composer and one Send button, verified live in Brave.
- [ ] #8 Spec 066 is amended against Intent contract v1.1 and reviewed by the operator at C-AMD before implementation.
<!-- AC:END -->
