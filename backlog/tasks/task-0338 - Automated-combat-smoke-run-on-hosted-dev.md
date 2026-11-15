---
id: TASK-0338
title: Automated combat smoke run on hosted dev
status: In Progress
assignee: []
created_date: '2026-11-14T02:29:00Z'
updated_date: '2026-11-15T13:41:00Z'
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

Claimed 2026-11-14 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0338, branch task-0338-combat-smoke, cut from origin/main 014f1ae6. No spec dir: signed escape line covers this task.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5
C9 go for the hosted auditor (operator, 2026-11-14, in chat, relayed verbatim): "Go, run audit".
Hosted run 2026-11-14, session 8c7d506e-43a0-48e6-a60c-8b1f3d3493b8, vm-104 at 014f1ae6. Fully scripted: 3 /move stages, then combat rounds 1-3 in full, with no human input. Log: docs/playtests/2026-11-14-combat-smoke-hosted.md (branch task-0338-combat-smoke). Rehearsal log a25b066b (partial: Docker hung locally).
AC #1 met. AC #2 not met: auditor verdict fail. deeds-narrated failed 3 (seq 80, 239, 242); each deed was told one narration late because it was posted while an NPC narration was streaming (TASK-0350). dice-lines failed 5, from the same shift.
Spend $1.14 of $15. Cards: TASK-0347, TASK-0348, TASK-0349, TASK-0350; evidence on TASK-0304.

Retest 2026-11-15 (session 6031b671-da08-4336-b7ab-058dcedb4939, vm-104 at 058f831c, wave 2b deployed). Ceiling "$15, same as last" (TASK-0278). Scripted: 3 /move stages, call-out, then loop.sh.
- Attempt-1 schema failures: 0.0% (0/576); jobs check.stripped: 0. Exit 5 met.
- First token p50 1.05 s; first prose p50 4.10 s (n=562). Typed Intents to engine rows: 0 ms. Fallbacks: 0.
- Rounds: r1 214 s, r2 81 s, r3 70 s (party alive). After r3, all PCs were down, and the rounds were monster-only.
- Encounter end: not reached. Party down by round 3; the encounter never ended and AI-DM turns ran on for 500+ rounds (TASK-0354). The jobs were stopped by an operator-run DB update (C9, 13:35 UTC).
- Spend: $10.60 of $15, about $8 of it in the runaway loop.
- deeds-narrated: pending the hosted auditor (C9).

Operator ruling on PR #184 (2026-11-15, in chat): "Approve, AC #2 open". The logs land; AC #2 stays unchecked until a rerun passes deeds-narrated after TASK-0350. The card stays In Progress.

From spec 116 OQ-4 (TASK-0347): a stripped dm.react reply now counts as ok in dm_model_calls. The retest exit-5 reading must count jobs.result.check.stripped entries alongside ledger attempt-1 failures.

Retest auditor (2026-11-15, C9 go given by the operator running the command): `node dist/playtest/cli.js audit --session 6031b671-... --auditor none` in stacks-dev-app-1. Verdict fail: deeds-narrated 2 (seq 231, 240), dice-lines 5, life-states 32, dice-language 4, 4 notes.
- Cause of the deeds-narrated fails: the export caps jobs at 500 (TASK-0355). The session had 577 jobs, so the windows for narrations 232 and 241 were dropped. Both deeds were told by the next narration.
- Local re-audit with the 77 missing jobs rebuilt from the debug route (`--dir`, worktree build at 4c1d3be4): deeds-narrated 0 fails; dice-lines 3 (TASK-0356); life-states 31 (TASK-0357, mostly inside the TASK-0354 loop); dice-language 4.
- AC #2 is not ticked. The hosted report fails, and the passing reading needs an operator ruling.
<!-- SECTION:NOTES:END -->
