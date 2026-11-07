---
id: TASK-0130
title: 'Doctrine pass: rewrite resolution doctrine against D14'
status: To Do
assignee: []
created_date: '2026-10-27 02:33'
updated_date: '2026-11-07 05:22'
labels:
  - dm
  - doctrine
  - narration
  - revisit
  - 'ws:narration'
milestone: m-10
dependencies:
  - TASK-0127
  - TASK-0104
priority: medium
ordinal: 117000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
REWRITTEN by replan-2026-11: Doctrine pass against the planner and fact sheet, not the audit.

Source: docs/design/replan-2026-11/board-rework-map.md. Acceptance criteria are refined at the milestone's planning (P-16).

--- Previous description (superseded where it conflicts) ---
Outcome: the doctrine pairs, narrate rules and audit definitions that govern resolution match decision-0022 (D14) and the contract cards that implement it. Scope: doctrine pairs P6 hero-is-theirs, P7, P8 blame-the-situation, P9 roll-when-uncertain, P10 fail-forward, P11 trying-costs, P12, P13 yes-and, P19 dice-stand, P24; narrate-v3 N5, N7, N8 (E3); audit-v2 A1 player-agency. Add the flavour-intensity rule (operator ruling 2026-10-26): flavour matches the natural die, a low natural roll gets a bigger, more dramatic failure and a high one a more dramatic success, without moving state or choosing for the player. Text and audit wording only; measure on a captured run. Grounding: decision-0022 (D14) and docs/research/Resolution-and-Outcome/Analysis-Dice-Versus-Player.md (TASK-0115, lands with TASK-0115's PR).
<!-- SECTION:DESCRIPTION:END -->


## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Operator ruling 2026-11-02 (M3 planning, orchestrator session local_6a4a04a4): research, doctrine and low-priority revisits move out of m-3. Milestone cleared, revisit label added. Re-enter a milestone when its trigger fires.

Rewritten by replan-2026-11. Doctrine pass against the planner and fact sheet, not the audit.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
