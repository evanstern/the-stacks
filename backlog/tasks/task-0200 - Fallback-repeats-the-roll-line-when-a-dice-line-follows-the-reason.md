---
id: TASK-0200
title: Fallback repeats the roll line when a dice line follows the reason
status: To Do
assignee: []
created_date: '2026-11-02 08:18'
labels:
  - dm
  - narration
  - playtest
milestone: m-3
dependencies:
  - TASK-0193
ordinal: 186000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: an in-fiction fallback does not print the roll text twice.

Why: alpha run 3 (2026-11-02, seq 148-158): Odo's fallback line printed the raw roll line twice. Raised as OQ-3 by the spec 071 author (TASK-0193), 2026-11-02, and kept out of that task.

Where: apps/server/src/dm/fallback.ts. Candidate: drop the reason sentence when a dice line follows.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A fallback whose reason restates the dice line prints the roll once, with a test
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
