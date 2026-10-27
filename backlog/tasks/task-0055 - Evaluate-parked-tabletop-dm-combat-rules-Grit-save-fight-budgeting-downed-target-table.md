---
id: TASK-0055
title: >-
  Evaluate parked tabletop-dm combat rules: Grit save, fight budgeting,
  downed-target table
status: In Progress
assignee: []
created_date: '2026-10-25 20:00'
updated_date: '2026-10-27 03:31'
labels:
  - revisit
  - engine
  - dm
milestone: m-3
dependencies:
  - TASK-0048
references:
  - 'https://github.com/bradbushSFAI/tabletop-dm'
priority: low
ordinal: 45000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a decision on each parked tabletop-dm combat rule, made from First Scene playtest evidence.

Why: decision-0021 parked two ideas because the operator was unsure: the Grit save house rule, and fight budgeting with downed-target tables. Planning principle decision-0020 requires a revisit card with a concrete trigger. The trigger is TASK-0048: its playtests show whether fights run too lethal, too long or too flat.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The evaluation cites TASK-0048 playtest transcripts and ledgers as evidence.
- [x] #2 A decision record adopts, adapts or rejects the Grit save.
- [x] #3 A decision record adopts, adapts or rejects fight budgeting and the downed-target table.
- [x] #4 Each adopted rule gets its own board card with acceptance criteria.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
RESEARCH FINDINGS 2026-10-26 (TASK-0115, branch Resolution-and-Outcome, note Outcome-Shapes): DMG 2014 Ch 9 Combat Options offers optional Injuries (on a critical hit, drop to 0 HP, or death save failed by 5 or more; a variant hands the injury to the player as a flaw to portray), Massive Damage (half HP max from one source forces a DC 15 Con save or a System Shock roll), Hitting Cover, Cleaving and Morale (monsters and NPCs only). None are in SRD 5.2.1. Branch 5 (TASK-0122) researches these against TASK-0048 evidence. The half-HP threshold is already used as the heavy-hit reflex trigger in TASK-0113 (narration colour only, no mechanics).

OPERATOR RULING 2026-10-26 (M3 sweep Lane 0, option A): 'A'. Reject the Grit save, fight budgeting and the downed-target table by one decision record citing docs/design/m2-demo.md Fight statistics (5 rounds, no hero at 0 HP, 0 death saves, ended by flight; run 5 ended by bargain). TASK-0122 (research branch 5, running combat) is the single re-entry path for any combat-pacing rule. Evidence defect carded: TASK-0134 (stats miss goblin-3 at 0 HP). Follow-up concern the operator raised with this ruling: TASK-0135 (actor-state rule gate).

Claimed 2026-10-26 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0055, branch task-0055-combat-rules-ruling, cut from origin/main a4aab3c. No spec dir: signed escape line covers this task. Track D1. Escape line E1; ruling R1 (option A).

Decision recorded: decision-0023 (D15). Grit save, fight budgeting and downed-target table rejected. Re-entry path: TASK-0122. AC #4 met vacuously (no rule adopted).
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
