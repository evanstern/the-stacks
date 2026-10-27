---
id: TASK-0110
title: An action that ends the encounter resolves as refused
status: In Progress
assignee: []
created_date: '2026-10-26 19:15'
updated_date: '2026-10-27 09:29'
labels:
  - dm
  - engine
milestone: m-3
dependencies: []
priority: medium
ordinal: 100000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: when a committed action's own effect ends the encounter (for example a bargain that meets the morale condition), the action resolves as applied, not refused.

Evidence: TASK-0106 verification run 20261026T183818Z (specs/034-narration-quality/evidence/verify-20261026T183818Z-greyhollow-ford-provider/). Rows 260-265: Odo's bargain (act-odo-5) was committed; encounter.ended and table-mode.changed (morale condition met) followed; then action.resolved 'refused'. The fallback narration said 'Brother Odo cannot do that here.' The playtest auditor reported F54. Operator ruling 2026-10-26: card it; it does not count against TASK-0106's narration bar.

Spec: specs/045-encounter-end-resolves
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A test reproduces rows 260-265: the action whose resolution ends the encounter resolves applied
- [x] #2 The resolution order (encounter end versus action resolution) is documented in the turn-jobs contract
- [x] #3 Spec phase: The resolve order in the contracts (US4, AC #2)
- [ ] #4 Spec phase: Resolve runs the new order (US1, US2, US3)
- [ ] #5 Spec phase: Reproduce rows 260–265 end to end (US1, AC #1)
- [ ] #6 Spec phase: Wiki re-ground
- [ ] #7 Spec phase: Constitution Compliance (the-stacks)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Operator ruling 2026-10-27 (via parent session local_415a1f81): "Leave TASK-0110 in m-3: the demo never hit it." It stays in m-3 and does not block M2 close. This answers next action 1 of the runbook handoff of 2026-10-27.

Operator ruling 2026-10-27 (in chat with the third M2 orchestrator session): leave in m-3. The live demo (session e8c848ec) never hit it — no refused outcome; the fight ended by flight. Does not block M2 close.

Claimed 2026-10-26 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0110, branch task-0110-encounter-end-resolves, cut from origin/main a6c0baa. Spec number 045 claimed with a stub. Session 2 of the M3 orchestrator (2026-10-27). Track C4 (runbook amendment 1).

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
(spec authoring, spec 045, commit 86cad07; served verified from the transcript.) Root cause: resolve.ts ran the Director group (encounter end and free mode from the morale condition) before the actions. The UNKNOWN_COMBATANT refusal was a separate interpret step naming a non-combatant (likely pell), which TASK-0112 U6's plan gate covers. ORCHESTRATOR DEFAULTS (reported to the operator; the operator may overturn them): OQ-1 (a) the opening/closing Director split stands as the reading of D17 §4, so encounter start stays ahead of the actions. OQ-2 (a) the landed-row marker risk across a deploy is accepted and recorded in turn-jobs.md (Phase 1); revisit card TASK-0156 holds the trigger.

Phase 1 done (f18b9c2): resolve order (six groups, opening/closing split, hold rule, empty batch-gate slot, OQ-2 reclaim risk accepted, revisit TASK-0156) written in turn-jobs.md, resolve.md, director.md. OQ-1 default (a) stated in the contract.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
