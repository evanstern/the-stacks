---
id: TASK-0019
title: Re-baseline milestone dates after M0 close
status: In Progress
assignee: []
created_date: '2026-09-29 02:15'
updated_date: '2026-09-29 02:15'
labels:
  - docs
milestone: m-1
dependencies: []
priority: low
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
milestones.md requires dates to be re-baselined at each milestone close. M0 closed 2026-09-23, three weeks ahead of its mid-Oct target. Shift M1–M6 targets to start from 2026-09-29, keeping each milestone's duration budget.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 M0 section records delivery on 2026-09-23 with a link to the sweep runbook
- [ ] #2 M1–M6 targets restate from a 2026-09-29 M1 start with unchanged durations
- [ ] #3 A re-baseline note records the date and reason
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Single-file edit of docs/design/milestones.md, dispatched to haiku tier. Dates: M1 3wk from 2026-09-29 -> 2026-10-20; M2 +3wk -> 2026-11-10; M3 +3wk -> 2026-12-01; M4 +4wk -> 2026-12-29; M5 +4wk -> 2027-01-26; M6 +3wk -> 2027-02-16.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
