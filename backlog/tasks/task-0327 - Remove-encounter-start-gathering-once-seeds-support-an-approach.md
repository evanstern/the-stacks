---
id: TASK-0327
title: Remove encounter-start gathering once seeds support an approach
status: To Do
assignee: []
created_date: '2026-11-13T04:52:00Z'
labels:
  - ws:intent
  - revisit
milestone: m-11
dependencies:
  - TASK-0312
ordinal: 311000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Moved from TASK-0312 AC #2 by the operator's ruling of 2026-11-12. In resolve.ts directorOpening, the encounter-start gathering places the party in the encounter zone (spec 100 OQ-13). The plan was to delete it once interpret emits move Intents (TASK-0269). An attempt (TASK-0312 phase 2, 77e74f18, reverted in 767fed0b) showed the greyhollow seeds cannot support that: reed-marsh to reed-camp and causeway to reed-marsh are squeeze edges (30 ft and 60 ft). A move into the camp is refused MOVE_OVER_SPEED, and a crossbow is refused OUT_OF_RANGE, so fights opened at range and three playtest-harness tests failed. Trigger: a seed change places the party within reach at encounter start, or the seeds gain an approach the party can cover in one turn.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The encounter-start gathering block in resolve.ts is removed (spec 100 OQ-13).
- [ ] #2 The CI playtest scenario and the R1 scenario still reach a player attack roll in the first round, with a test.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
