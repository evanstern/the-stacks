---
id: TASK-0196
title: >-
  Playtest cost estimate: expected output from measured typical, cap only for
  upper bound
status: To Do
assignee: []
created_date: '2026-11-02 06:33'
updated_date: '2026-11-07 05:18'
labels:
  - playtest
  - cost
  - replan-2026-11
milestone: m-3
dependencies:
  - TASK-0192
ordinal: 183000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the playtest cost estimate's expected figure uses a measured typical output per dm purpose; maxTokens stays the upper bound.

Why: spec 067 (TASK-0192) raises every dm.* maxTokens to 4000. The estimate uses the cap as expected output, so its expected figure rises about fivefold and stops being a useful ceiling input for C6. Raised as OQ-2 by the spec 067 author, 2026-11-02.

Where: apps/server/src/dm/purposes.ts, the playtest budget estimate and test/playtest/budget.test.ts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Expected cost per purpose uses a measured typical output, cited to its source
- [ ] #2 The upper bound still uses maxTokens
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Operator, 2026-11-02: "our estimates are wildly over compensating"; 9router 7-day spend under $8 against estimates sized for far more. Supports measuring typical output.

Merged into TASK-0186 by replan-2026-11. Cost estimate.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
