---
id: TASK-0355
title: Auditor export caps jobs at 500 and drops early facts windows
status: To Do
assignee: []
created_date: '2026-11-15T13:40:00Z'
labels:
  - bug
  - ws:tooling
milestone: m-10
dependencies: []
priority: high
ordinal: 339000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-0338 retest (2026-11-15, session 6031b671). exportSession reads listDmJobs(db, sessionId, 500) (apps/server/src/playtest/export.ts:105; harness.ts:300 has the same cap). The session had 577 jobs, so the 77 oldest jobs and their factsThrough windows were dropped. The auditor then fell back to raw segments. deeds-narrated failed on seq 231 and 240, both told by the next narration (spec 115). When the 77 jobs were rebuilt from the debug route, the same run had 0 deeds-narrated fails and 3 dice-lines fails, against 5 before. Fix: page all jobs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The export and the harness read every job of a session, with no fixed cap.
- [ ] #2 A test with more than 500 jobs asserts the oldest job's factsThrough reaches jobs.json.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
