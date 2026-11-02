---
id: TASK-0122
title: 'Research branch 5: running combat'
status: To Do
assignee: []
created_date: '2026-10-27 02:06'
updated_date: '2026-11-02 05:22'
labels:
  - research
  - dm
  - doctrine
  - revisit
dependencies:
  - TASK-0121
  - TASK-0048
priority: low
ordinal: 109000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: combat doctrine and the parked combat rules are decided from documented DM practice plus playtest evidence. Scope: morale, monster tactics, combat pacing, optional injury and massive-damage rules (DMG 2014 Ch 9 Combat Options), the parked Grit save, fight budgeting and downed-target table (decision-0021, TASK-0055). Trigger: TASK-0048 playtest evidence exists. Vault: docs/research/ (scaffolded by TASK-0115). Method: research:research-vault, then research:analyze-vault. Source rules: paraphrase non-SRD books, cite by heading path, never commit their text; SRD 5.2.1 is CC-BY-4.0. Ordering basis: docs/research/DM-Craft-Map/Analysis-Refactor-Risk-and-Deep-Dive-Order.md (operator-approved 2026-10-26 on TASK-0115).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A vault branch for this topic passes the research branch gate
- [ ] #2 An analysis note answers each TASK-0055 parked rule from sources plus TASK-0048 evidence, with a recommendation
- [ ] #3 A decision record is created with the backlog CLI after operator go
- [ ] #4 TASK-0055 carries the findings
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
RE-ENTRY TRIGGER 2026-10-26 (TASK-0055 ruling, option A): this branch is the only path by which the Grit save, fight budgeting, the downed-target table or any other combat-pacing rule returns. Evaluate against TASK-0048 and TASK-0053 fight statistics (after TASK-0134 fixes the NPC zero-HP count). Any rule this branch recommends gets its own decision record and card.

Operator ruling 2026-11-02 (M3 planning, orchestrator session local_6a4a04a4): research, doctrine and low-priority revisits move out of m-3. Milestone cleared, revisit label added. Re-enter a milestone when its trigger fires.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
