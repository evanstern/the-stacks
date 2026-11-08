---
id: TASK-0130
title: 'Doctrine pass: rewrite resolution doctrine against D14'
status: To Do
assignee: []
created_date: '2026-10-27 02:33'
updated_date: '2026-11-07 05:24'
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

Intent: rewrite the resolution doctrine against D14 (decision-0022) so it governs the planner, rulings and prose slots. The audit loop retires under N-07 (TASK-0272), so no rule may depend on regenerate-then-fallback. Rules that decide whether to roll, what a failure costs and who chooses become planner or ruling inputs. The flavour-intensity rule (operator ruling 2026-10-26) stays as prose-slot doctrine. Lands after TASK-0245 and N-07.

Source: docs/design/replan-2026-11/board-rework-map.md (rewrite row), plan-of-action.md §5, target-architecture.md, decisions-for-ratification.md.

Prior scope (superseded): rewrite doctrine pairs P6-P13, P19, P24, narrate-v3 N5/N7/N8 and audit-v2 A1 against D14, add the flavour-intensity rule with an audit check, and measure on a captured run. Grounding: docs/research/Resolution-and-Outcome/Analysis-Dice-Versus-Player.md.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each listed doctrine pair and narrate rule is rewritten or retired against D14, citing the research branch.
- [ ] #2 No doctrine or narrate rule depends on the regenerate-then-fallback audit loop.
- [ ] #3 Rules on whether to roll, failure cost and player choice are stated as planner or ruling inputs.
- [ ] #4 The flavour-intensity rule lives in the prose-slot doctrine and never changes a fact row or state.
- [ ] #5 A captured R1 run compares player-agency and leak-check rates before and after the pass.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Operator ruling 2026-11-02 (M3 planning, orchestrator session local_6a4a04a4): research, doctrine and low-priority revisits move out of m-3. Milestone cleared, revisit label added. Re-enter a milestone when its trigger fires.

Rewritten by replan-2026-11. Doctrine pass against the planner and fact sheet, not the audit.

AC re-authored by replan-2026-11.
<!-- SECTION:NOTES:END -->
