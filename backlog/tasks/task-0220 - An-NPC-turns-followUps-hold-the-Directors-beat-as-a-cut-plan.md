---
id: TASK-0220
title: An NPC turn's followUps hold the Director's beat as a cut plan
status: To Do
assignee: []
created_date: '2026-11-03 03:51'
labels:
  - dm
milestone: m-3
dependencies:
  - TASK-0207
ordinal: 206000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: an NPC turn whose reading only carries followUps (lines it would say, steps deferred) does not count as a cut beat, so the Director's turn-entry, tracker and scene-end moves are not held.

Why: spec 081 (TASK-0207) OQ-3. runner.ts computes cutBeat from any reading with followUps, so Pell's talk turn (run 1 seq 124-126) held the Director's moves for that beat. TASK-0207 moves the line into a say field but leaves this rule unchanged.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 cutBeat counts only followUps from a party member's first-stage cut, not an NPC turn's reading, with a runner test
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
