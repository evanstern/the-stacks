---
id: TASK-0026
title: 'Hybrid retrieval: vector plus full-text'
status: To Do
assignee: []
created_date: '2026-09-29 02:36'
labels:
  - library
milestone: m-1
dependencies:
  - TASK-0022
  - TASK-0023
priority: high
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Hybrid retrieval per A9. Retrieval mode is configurable so the benchmark (TASK-0029) can compare modes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Retrieval runs vector, FTS, or hybrid by config
- [ ] #2 Hybrid fuses both result lists with a documented rank-fusion method
- [ ] #3 Results carry chunk anchors
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
