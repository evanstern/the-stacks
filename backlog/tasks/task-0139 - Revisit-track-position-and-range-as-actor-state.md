---
id: TASK-0139
title: 'Revisit: track position and range as actor state'
status: To Do
assignee: []
created_date: '2026-10-27 03:40'
updated_date: '2026-11-07 05:17'
labels:
  - revisit
  - engine
  - rules-gate
  - replan-2026-11
dependencies: []
priority: low
ordinal: 126000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Trigger: revisit when maps land (M6) or when a captured run shows narration or an action contradicting distance, reach or line of sight. Context: TASK-0135's inventory (docs/design/actor-state-gate.md, branch task-0135-actor-state-gate) found position and range untracked, so no actor-state gate can check reach, range or movement. Carded 2026-10-26 by the M3 sweep orchestrator under decision-0020.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A decision record states which positional facts the engine tracks and which gates read them
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged into TASK-0270 by replan-2026-11. Positions and range are the zone model.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
