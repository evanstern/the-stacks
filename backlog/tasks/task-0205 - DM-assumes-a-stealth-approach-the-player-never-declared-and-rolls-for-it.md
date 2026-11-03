---
id: TASK-0205
title: DM assumes a stealth approach the player never declared and rolls for it
status: In Progress
assignee: []
created_date: '2026-11-02 22:21'
updated_date: '2026-11-03 02:46'
labels:
  - dm
  - playtest
  - rules
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-11-02-runbook-a-playtest.md
priority: high
ordinal: 191000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the DM resolves what the player declared. A method the player did not state (stealth, force, a specific skill) is not assumed; the DM either asks or resolves the plain action.

Why: runbook A playtest run 1 (2026-11-02, session 9296c653, seq 24-30). Tamsin's player committed 'We move toward the reed camp until we see Goblins or they see us.' The player never mentioned stealth. dm.director-v4 wrote in its goal note 'Approach beat: call Stealth (Kestrel leads, +5; Tamsin's mail and Wenna's boathook argue against quiet)', and dm.interpret-v5 followed it: one DEX (Stealth) check for Kestrel at disadvantage, DC 13, 1d20+5 → 4 = 9, failure. The narration then described the party sneaking ('the reeds swallow sound', 'the others drag at the quiet like anchors') and raised the alarm. Three problems: (1) the method was invented; (2) the roll was made for Kestrel, a different human player's character, from Tamsin's action; (3) a group stealth check was folded into one roll at disadvantage. Interpret also used 1198 output tokens on this one action.

Related: TASK-0128 (group checks), TASK-0127/spec 070 (stakes before dice), TASK-0104 (engine-derived modifiers), TASK-0113 (player-agency residue).

Spec: specs/077-no-undeclared-method
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Interpret does not add a check whose method the declaration does not state or clearly imply; it asks (clarify) instead, with a test replaying this action
- [ ] #2 A check from one player's action rolls for that player's character, never another human's, with a test
- [ ] #3 The Director's goal note cannot prescribe a skill the player did not choose (prompt rule plus test)
- [ ] #4 Spec phase: The rule (card AC #1, #2; US1, US2)
- [ ] #5 Spec phase: Wiring and the run 1 replay (merge condition; US1, US2)
- [ ] #6 Spec phase: Wiki (re-ground)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Run 1 again, seq 114-122. Tamsin: 'I move towards Pell' became an Athletics check (6+5 = 11 vs DC 13, failure); the Director's goal note told interpret to show 'the hidden goblins tracking her'. The operator: 'the result assumed stealth was still on … I never said to stop sneaking, however, the stealth check failed so I had assumed we were out of stealth because of that.' The DM keeps an approach mode (stealth) the player never declared and that a failed check should have ended. Add: a failed stealth check ends the hidden state, and the hidden state is tracked, not assumed from goal-note prose.

Claimed 2026-11-02 by M3 runbook B (docs/design/m3-runbook-b-resolution-quality.md). Worktree .worktrees/task-0205, branch task-0205-no-undeclared-method, cut from origin/main fbf4d1df. Spec number 077 claimed with a stub. Spine #5.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5 (spec 077 authoring, C1)

spec-bridge sync: The rule (card AC #1, #2; US1, US2): 0/5 · Wiring and the run 1 replay (merge condition; US1, US2): 0/7 · Wiki (re-ground): 0/7
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
