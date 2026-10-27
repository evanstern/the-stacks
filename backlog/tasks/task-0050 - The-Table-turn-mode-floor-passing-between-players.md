---
id: TASK-0050
title: 'The Table: turn-mode floor passing between players'
status: In Progress
assignee: []
created_date: '2026-10-25 20:00'
updated_date: '2026-10-27 13:43'
labels:
  - multiplayer
  - gate
  - ui
milestone: m-3
dependencies:
  - TASK-0048
references:
  - docs/design/architecture.md
priority: medium
ordinal: 40000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: in turn mode, the floor passes between human players in initiative order. Only the active player commits for their turn. Everyone else talks and suggests.

Why: decision-0016, turn-mode row. M2 has one human, so the floor only passes between that human and AI actors. Several humans need visible turn ownership and a clean handoff.

Spec: specs/049-turn-floor
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 In turn mode, only the active player commits an action for their character's turn.
- [ ] #2 Other players comment on the active player's declared action and suggest alternatives.
- [ ] #3 Ending a turn passes the floor to the next actor in initiative order, human or AI.
- [ ] #4 The play route shows whose turn it is to every viewer.
- [ ] #5 The DM passes or reclaims the floor at any time.
- [ ] #6 Tests cover a round with two humans and one AI companion.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope addition from TASK-0049 Q5 (operator accepted the defaults, 2026-10-27): the AI DM's override of a stalled party sign-off is in scope here.

Claimed 2026-10-27 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0050, branch task-0050-turn-floor, cut from origin/main 3529df2. Spec number 049 claimed with a stub. Spec 048 is taken by TASK-0141 (PR #73). Scope includes TASK-0049 Q5 (AI DM overrides a stalled party sign-off).
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
