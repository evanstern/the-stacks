---
id: TASK-0170
title: >-
  A check's declared outcome is fixed before the roll and handed to the narrator
  as fact
status: Done
assignee: []
created_date: '2026-10-28 19:20'
updated_date: '2026-11-03 05:16'
labels:
  - dm
  - rules
milestone: m-3
dependencies:
  - TASK-0127
priority: high
ordinal: 157000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a check that comes from a player's action resolves to a definite outcome for the task that player attempted, and the narrator receives that outcome as a fact. The narrator describes the outcome; it never decides it.

Rule (operator, 2026-10-28): success means the attempted task happens. 'I push the tree over' plus a success means the tree falls. 'I sneak past the guards' plus a success means the sneak works. 'I look for what made these claw marks' plus a success means the player learns what made them, taken from the seed's own facts.

Why: two-browser alpha playtest 2026-10-28, item 2. Tamsin investigated 'what may have made these claw marks' and rolled 23 vs DC 12. The narration described the marks in more detail and never named a creature, so the success read as a failure. The defect sits upstream of narration: the narrator gets the roll but no definite outcome for the attempt, so it improvises one.

Shape: builds on TASK-0127. 0127 has interpret declare a consequence per outcome band before the roll, and carries the band in NarrationFacts. This card adds the success side. Interpret states each band's outcome for this specific attempt, success included. Resolve puts the outcome that applied into NarrationFacts beside the roll line. For an information-seeking check, the success outcome names seed information (ties to TASK-0148 reveal facts).

Spec: specs/080-declared-outcome
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Interpret declares a concrete outcome for every band, success included, on each check step from a player action, and a schema test rejects a check step with no success outcome
- [x] #2 NarrationFacts carries the applied outcome text beside the roll, with a test
- [x] #3 The narrate prompt presents the applied outcome as settled fact that the prose must deliver
- [x] #4 The auditor fails narration that does not deliver the applied outcome, with a test over a captured run that replays the claw-marks case
- [x] #5 A success on an information-seeking check names seed information in its declared outcome, with a test
- [x] #6 Spec phase: Step contract, discoverable clues, seeds, fixtures (card AC #1, #5; US1, US2)
- [x] #7 Spec phase: Resolve and facts carry the applied outcome (card AC #2, #5; US1, US2)
- [x] #8 Spec phase: Narration, audit, fallback and the claw-marks replay (card AC #3, #4; US1, US3)
- [x] #9 Spec phase: Contracts and wiki re-ground
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-02 by M3 runbook B (docs/design/m3-runbook-b-resolution-quality.md). Worktree .worktrees/task-0170, branch task-0170-declared-outcome, cut from origin/main b79489e2. Spec number 080 claimed with a stub. Spine #9; spec authored early against spec 070.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5 (spec 080 authoring, C1)

spec-bridge sync: Step contract, discoverable clues, seeds, fixtures (card AC #1, #5; US1, US2): 0/10 · Resolve and facts carry the applied outcome (card AC #2, #5; US1, US2): 0/7 · Narration, audit, fallback and the claw-marks replay (card AC #3, #4; US1, US3): 0/9 · Contracts and wiki re-ground: 0/5

Spec 080 (93143a67). Defaults (a) taken: OQ-1 a success names only the current beat's clues (seed-marked discoverable); secrets and knows stay out. OQ-2 ferry-house clue 1 names goblin feet in the three seeds and the spec 031 copy. OQ-3 claw-marks fixture is reconstructed and labelled so; the runbook B playtest re-checks it live. OQ-4 no lexical delivery check here; revisit card opened. Findings: the seed never named the creature, and interpret never saw beat clues. Builds after TASK-0127.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (spec 080 phases 1-2, with seam check against built spec 070)

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (spec 080 phase 3)
Seam check (phases 1-2): seams moved, none changed meaning; see specs/080-declared-outcome/deviations.md.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (spec 080 phase 4, contracts and wiki)

spec-bridge sync: Step contract, discoverable clues, seeds, fixtures (card AC #1, #5; US1, US2): 10/10 · Resolve and facts carry the applied outcome (card AC #2, #5; US1, US2): 7/7 · Narration, audit, fallback and the claw-marks replay (card AC #3, #4; US1, US3): 9/9 · Contracts and wiki re-ground: 5/5 — status In Progress → Done
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Step contract, discoverable clues, seeds, fixtures (card AC #1, #5; US1, US2): 10/10 · Resolve and facts carry the applied outcome (card AC #2, #5; US1, US2): 7/7 · Narration, audit, fallback and the claw-marks replay (card AC #3, #4; US1, US3): 9/9 · Contracts and wiki re-ground: 5/5). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 All tests and checks run green
- [x] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
