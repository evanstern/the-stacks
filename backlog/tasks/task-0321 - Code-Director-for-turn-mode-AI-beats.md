---
id: TASK-0321
title: Code Director for turn-mode AI beats
status: To Do
assignee: []
created_date: '2026-11-12T18:22:00Z'
labels:
  - ws:intent
  - revisit
milestone: m-10
dependencies:
  - TASK-0299
ordinal: 305000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spec 107 OQ-7. After TASK-0299, monster turns use a stay-put code Director, but companion beats still make a dm.director call. Trigger: the CP-7 hosted 4v4 round breaches 60 s and the Director call is the largest share of round time.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Companion beats in turn mode make no dm.director call, with a test.
- [ ] #2 The hosted 4v4 round time is re-measured after the change.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
