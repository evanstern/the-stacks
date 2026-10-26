---
id: TASK-0110
title: An action that ends the encounter resolves as refused
status: To Do
assignee: []
created_date: '2026-10-26 19:15'
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

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
