---
id: TASK-0170
title: >-
  A check's declared outcome is fixed before the roll and handed to the narrator
  as fact
status: In Progress
assignee: []
created_date: '2026-10-28 19:20'
updated_date: '2026-11-03 04:21'
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
- [ ] #1 Interpret declares a concrete outcome for every band, success included, on each check step from a player action, and a schema test rejects a check step with no success outcome
- [ ] #2 NarrationFacts carries the applied outcome text beside the roll, with a test
- [ ] #3 The narrate prompt presents the applied outcome as settled fact that the prose must deliver
- [ ] #4 The auditor fails narration that does not deliver the applied outcome, with a test over a captured run that replays the claw-marks case
- [ ] #5 A success on an information-seeking check names seed information in its declared outcome, with a test
- [ ] #6 Spec phase: Step contract, discoverable clues, seeds, fixtures (card AC #1, #5; US1, US2)
- [ ] #7 Spec phase: Resolve and facts carry the applied outcome (card AC #2, #5; US1, US2)
- [ ] #8 Spec phase: Narration, audit, fallback and the claw-marks replay (card AC #3, #4; US1, US3)
- [ ] #9 Spec phase: Contracts and wiki re-ground
<!-- AC:END -->









## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-02 by M3 runbook B (docs/design/m3-runbook-b-resolution-quality.md). Worktree .worktrees/task-0170, branch task-0170-declared-outcome, cut from origin/main b79489e2. Spec number 080 claimed with a stub. Spine #9; spec authored early against spec 070.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5 (spec 080 authoring, C1)
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
