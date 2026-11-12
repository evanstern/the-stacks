---
id: TASK-0317
title: 'Revisit: withdraw a declared Intent'
status: To Do
assignee: []
created_date: '2026-11-12T03:01:00Z'
labels:
  - ws:intent
  - revisit
milestone: m-11
dependencies: []
ordinal: 301000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spec 066 OQ-7 (sent there by spec 102 OQ-7): R1 has no withdraw request, because a 👍 settles at once and stale suggestions are derived. Trigger: a playtest player tries to take back a declared action before the ring ends, or a stale suggestion confuses play.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A player can withdraw their own declared Intent before it is confirmed, and the confirm row drops it.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
