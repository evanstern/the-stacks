---
id: TASK-0278
title: R1 playtest scenario and latency metrics
status: To Do
assignee: []
created_date: 2026-11-07 05:13
updated_date: '2026-11-14T14:42:00Z'
labels:
  - ws:tooling
  - replan-2026-11
  - ep-1
milestone: m-10
dependencies:
  - TASK-0272
  - TASK-0275
ordinal: 262000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Write the R1 combat scenario (four PCs, four goblins, zones). Add latency metrics to the auditor: Intent-to-fact-row p95, first narration token p50, round wall time.

Parent epic: TASK-0258.

Source: docs/design/replan-2026-11/board-rework-map.md (N-13).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The auditor reports the three latency metrics.
- [ ] #2 The scenario runs hosted under the playtest-run skill.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Baseline playtest 2026-11-08 (pre-R1, vm-104 at 25ea6bc8). Ceiling: $25 (operator, in chat: "$25"). Scenario: reed camp, solo plus AI companions. Measures R1 metrics plus B2 rows rolled forward.

Playtest 2026-11-10 (post-lane: planner, fact sheet, encounter state, fog, engaged-only ranged), vm-104 at ec9fe23c. Ceiling: $15 (operator, in chat: "$15, I've signed in"). Solo seed greyhollow-ford.

R1 lane playtest 2026-11-10: first-row median 43 s p95 80 s; narration median 60 s; rounds 404 s and 278 s; 0 fallbacks; attempt-1 0.9%; encounter ended. Spend $2.59 of $15. Log: docs/playtests/2026-11-10-r1-lane-playtest.md.

Test-drive ceiling (operator, 2026-11-13, in chat): "$15, same as last". This is a human-driven test drive of the post-R1-spine build (PRs #166-#176, plus #177 if merged first).

Test drive 2026-11-13 (session 0106e608, log docs/playtests/2026-11-13-r1-spine-test-drive.md): $0.17 of the $15 ceiling. First narration token 0.93-0.97 s. Stopped before combat, so AC #1 hosted metrics are not measured; blockers TASK-0336 and TASK-0337 found. Auditor verdict pass (checks-only).

Ceiling for the TASK-0338 automated combat run (operator, 2026-11-14, in chat): "$15, same as last".
<!-- SECTION:NOTES:END -->
