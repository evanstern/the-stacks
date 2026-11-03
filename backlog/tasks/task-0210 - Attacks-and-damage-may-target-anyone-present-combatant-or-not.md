---
id: TASK-0210
title: 'Attacks and damage may target anyone present, combatant or not'
status: In Progress
assignee: []
created_date: '2026-11-02 23:15'
updated_date: '2026-11-03 00:02'
labels:
  - dm
  - rules
  - playtest
milestone: m-3
dependencies:
  - TASK-0194
references:
  - docs/playtests/2026-11-02-runbook-a-playtest.md
priority: high
ordinal: 196000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: an attack or damage step may name any present actor. A target outside the turn order is pulled in first (TASK-0194's pull), as checks, conditions and heals already are.

Why: operator ruling 2026-11-02, during runbook A playtest run 1 (session 9296c653), answering 'once a captive like Pell has been pulled into the fight, should attacks on him still be refused?': "I actually think that the rule itself is incorrect -- we should be able to attack anyone regardless of combatant state." This reverses spec 068 OQ-4 (operator accepted the default 2026-11-02) and TASK-0194 AC #2, which kept attacks and damage on a non-combatant refused with UNKNOWN_COMBATANT.

Where: apps/server/src/dm/gates/plan-gate.ts (stepIds: attackerId/targetId pullable false today; damage effects pullable false), dm/nodes/resolve.ts pullIn, the 058 plan-reason-gate contract amendment, and the spec 068 tests that assert the refusal (noncombatant-targets.integration, plan-gate.test, resolve.integration). Related: TASK-0206 (an NPC the narration reveals stays absent; an absent NPC is still not targetable), TASK-0209.

Spec: specs/075-attack-anyone
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An attack or damage step on a present non-combatant passes the plan gate and pulls the target in, with a test (replays run 1 seq 45: 'I take aim and shoot at Snag' once Snag is present)
- [ ] #2 An absent actor is still refused, with a test
- [ ] #3 The spec 068 contract amendment and wiki notes record the reversal and cite this ruling
- [ ] #4 Spec phase: The gate, its unit tests and the contract (card AC #1, #2, #3)
- [ ] #5 Spec phase: The DB tests and the run 1 seq 45 replay (card AC #1, #2; merge condition)
<!-- AC:END -->





## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-02 by M3 runbook B (docs/design/m3-runbook-b-resolution-quality.md). Worktree .worktrees/task-0210, branch task-0210-attack-anyone, cut from origin/main b756b68f. Spec number 075 claimed with a stub. Spine #4.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5 (spec 075 authoring, C1)
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
