---
id: TASK-0110
title: An action that ends the encounter resolves as refused
status: In Progress
assignee: []
created_date: '2026-10-26 19:15'
updated_date: '2026-10-27 09:20'
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
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A test reproduces rows 260-265: the action whose resolution ends the encounter resolves applied
- [ ] #2 The resolution order (encounter end versus action resolution) is documented in the turn-jobs contract
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Operator ruling 2026-10-27 (via parent session local_415a1f81): "Leave TASK-0110 in m-3: the demo never hit it." It stays in m-3 and does not block M2 close. This answers next action 1 of the runbook handoff of 2026-10-27.

Operator ruling 2026-10-27 (in chat with the third M2 orchestrator session): leave in m-3. The live demo (session e8c848ec) never hit it — no refused outcome; the fight ended by flight. Does not block M2 close.

Claimed 2026-10-26 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0110, branch task-0110-encounter-end-resolves, cut from origin/main a6c0baa. Spec number 045 claimed with a stub. Session 2 of the M3 orchestrator (2026-10-27). Track C4 (runbook amendment 1).
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
