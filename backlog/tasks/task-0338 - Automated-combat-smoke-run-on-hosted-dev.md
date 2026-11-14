---
id: TASK-0338
title: Automated combat smoke run on hosted dev
status: To Do
assignee: []
created_date: '2026-11-14T02:29:00Z'
updated_date: '2026-11-14T14:42:00Z'
labels:
  - playtest
  - ws:tooling
milestone: m-10
dependencies:
  - TASK-0337
  - TASK-0336
ordinal: 322000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replan 2026-11-13 wave 2 (operator: 'Approved, but automate the tests'). Replace the human combat test drive with an automated run, using the existing driver in ~/.cache/stacks-sweep/pw/ (pw.mjs, act.sh, turn.sh, loop.sh, metrics.py) over the debug-port Brave page websocket, as in the 2026-11-10 lane playtest. Walk the greyhollow-ford party into the reed-camp fight and play at least two full rounds. Record round time, commit-to-first-engine-row, first narration token, attempt-1 schema failures and encounter end, plus 'every deed narrated' from the auditor. A paid run needs a ceiling recorded on TASK-0278 in the operator's words; vm-104 commands need C9.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A script-driven hosted run plays two combat rounds with no human input and writes a playtest log with the R1 metrics table filled in.
- [ ] #2 The run's auditor report passes the 'every deed narrated' check.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Ceiling (operator, 2026-11-14, in chat): "$15, same as last". Recorded on TASK-0278.
<!-- SECTION:NOTES:END -->
