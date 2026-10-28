---
id: TASK-0168
title: 'Revisit: the turn resumed after a DM roll approval interprets the action again'
status: To Do
assignee: []
created_date: '2026-10-28 08:50'
labels:
  - dm-runtime
  - revisit
dependencies: []
priority: low
ordinal: 155000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Revisit card (a maybe). The TASK-0159 live check (spec 055, 01cd836) showed that with a human DM a player check pauses on a check.roll proposal (policy ask). After the DM approves the roll, the resumed approval turn calls dm.director and dm.interpret again before narrate. So each check under a human DM pays for director and interpret twice, and the second reading could differ from the first. Revisit trigger: the TASK-0163 alpha run or the TASK-0053 demo shows a doubled per-check cost, or a resumed turn reading the action differently. On trigger, spec whether the resumed turn reuses the stored interpret result, or drop this card by a decision record.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The trigger fired and a spec covers reuse of the interpret result on a resumed turn, or a decision record drops this card
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
