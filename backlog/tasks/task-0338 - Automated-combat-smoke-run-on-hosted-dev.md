---
id: TASK-0338
title: Automated combat smoke run on hosted dev
status: To Do
assignee: []
created_date: '2026-11-14T02:29:00Z'
updated_date: '2026-11-15T05:01:00Z'
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
- [x] #1 A script-driven hosted run plays two combat rounds with no human input and writes a playtest log with the R1 metrics table filled in.
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

C9 go for the hosted auditor (operator, 2026-11-14, in chat, relayed verbatim): "Go, run audit".
Hosted run 2026-11-14, session 8c7d506e-43a0-48e6-a60c-8b1f3d3493b8, vm-104 at 014f1ae6. Fully scripted: 3 /move stages, then combat rounds 1-3 in full, with no human input. Log: docs/playtests/2026-11-14-combat-smoke-hosted.md (branch task-0338-combat-smoke). Rehearsal log a25b066b (partial: Docker hung locally).
AC #1 met. AC #2 not met: auditor verdict fail. deeds-narrated failed 3 (seq 80, 239, 242); each deed was told one narration late because it was posted while an NPC narration was streaming (TASK-0350). dice-lines failed 5, from the same shift.
Spend $1.14 of $15. Cards: TASK-0347, TASK-0348, TASK-0349, TASK-0350; evidence on TASK-0304.

Operator ruling on PR #184 (2026-11-15, in chat): "Approve, AC #2 open". The logs land; AC #2 stays unchecked until a rerun passes deeds-narrated after TASK-0350. The card stays In Progress.
<!-- SECTION:NOTES:END -->
