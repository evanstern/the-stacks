---
id: TASK-0128
title: 'Engine: opposition as a derived DC, and Help as advantage'
status: In Progress
assignee: []
created_date: '2026-10-27 02:32'
updated_date: '2026-11-03 10:23'
labels:
  - dm
  - engine
  - rules
milestone: m-3
dependencies:
  - TASK-0104
priority: medium
ordinal: 115000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: opposed efforts and assistance resolve by SRD 5.2.1 rules in the engine, not by model-chosen numbers. SRD 5.2.1 states opposition as a check against a DC derived from the opponent (for example the grapple escape DC, 8 + Strength modifier + proficiency bonus) and defines the Help action as advantage on an ally's next check. It has no group-check rule; group checks stay behind the table-rules flag from the stakes-before-dice card. Grounding: decision-0022 (D14) and docs/research/Resolution-and-Outcome/Analysis-Dice-Versus-Player.md (TASK-0115, lands with TASK-0115's PR).

Spec: specs/084-opposition-and-help
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The engine derives an opposition DC from the opponent's stats for each SRD-defined case, with tests
- [ ] #2 A Help action grants advantage on the ally's next matching check and expires per SRD 5.2.1, with a test
- [ ] #3 Interpret emits opposition and help as step kinds, and a schema test covers both
- [ ] #4 Spec phase: Seam check [orchestrator]
- [ ] #5 Spec phase: Engine (card AC #1, #2; US1, US2)
- [ ] #6 Spec phase: Step contract, prompts, plan gate and resolve (card AC #1, #3; US1, US3)
- [ ] #7 Spec phase: Narration facts and end-to-end test (card AC #1–#3; US1, US2, US4)
- [ ] #8 Spec phase: Re-ground (wiki)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-03 by M3 runbook B (docs/design/m3-runbook-b-resolution-quality.md). Worktree .worktrees/task-0128, branch task-0128-opposition-and-help, cut from origin/main 4cea63d8. Spec number 084 claimed with a stub. Spine #15; beside 0105 if disjoint.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5 (spec 084 authoring, C1)

spec-bridge sync: Seam check [orchestrator]: 0/1 · Engine (card AC #1, #2; US1, US2): 0/15 · Step contract, prompts, plan gate and resolve (card AC #1, #3; US1, US3): 0/11 · Narration facts and end-to-end test (card AC #1–#3; US1, US2, US4): 0/5 · Re-ground (wiki): 0/7

Spec 084 (d781547f). Defaults (a) taken: OQ-1 opposition as a check difficulty variant {opposedBy, rule}; OQ-2 the formula for every opponent, stat-block escape DCs added to TASK-0224; OQ-3 an assist lasts until used, replaced, or an encounter ends; OQ-4 an assist fact in facts/narrate/fallback (fallback order: after 0204, before 0214); OQ-5 group checks carded; OQ-6 commit order. Held behind 0105 (merged #124); now unblocked.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5 (spec 084 phase 0 seam check and amendment, C1)

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (spec 084 phases 1-2)
Phase 0: S1 (spell attacks bypass handleAttackRoll) resolved as D5a per SRD 5.2.1 Help text ('the next attack roll'); a spell attack takes the assist.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (spec 084 phases 3-4)
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
