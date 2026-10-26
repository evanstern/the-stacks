---
id: TASK-0113
title: >-
  Narration player-agency residue: scene-start hero moves, v3 dodge breach,
  companion scope
status: To Do
assignee: []
created_date: '2026-10-26 20:08'
labels:
  - dm
  - narration
milestone: m-3
dependencies: []
priority: low
ordinal: 103000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: real-model narration does not move the human player's hero at scene start or on a foe's miss, and the playtest auditor treats AI companions according to a stated rule.

Evidence: TASK-0106 rerun 20261026T192319Z (specs/034-narration-quality/evidence/verify-20261026T192319Z-greyhollow-ford-provider/ classification.md). F1: scene-start narration 'Tamsin Vale leads the way up from the bank'. F6: 'Tamsin twists just enough' on a recorded miss, a breach the narrate-v3 rule did not prevent. F7: the playtest auditor treats companion Brother Odo as a player's hero. Seq 130: an invented near-miss with no miss fact. Operator ruling 2026-10-26: card the residue in m-3.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A narrate rule or check covers the hero at scene start, with a test over the opening framing
- [ ] #2 The v3 miss rule's adherence is measured on a captured run, and a fix with a test follows if it is below a stated rate
- [ ] #3 The playtest auditor's hero-is-theirs check states whether companions count, with a test
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
