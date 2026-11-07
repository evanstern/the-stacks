---
id: TASK-0257
title: >-
  A check that needs no roll ships without its dice line, so the auditor fails
  the turn
status: To Do
assignee: []
created_date: '2026-11-07 04:08'
updated_date: '2026-11-07 05:19'
labels:
  - dm
  - narration
  - playtest
  - replan-2026-11
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-11-06-runbook-b2-playtest.md
priority: high
ordinal: 241000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a check resolved with no roll (an automatic success, total null) carries its 'no roll needed' line in the shipped narration, as renderDiceLines expects, so the deterministic dice-lines check passes.

Why: runbook B2 playtest run 1 (2026-11-06, session bb4952dc). The deterministic auditor (--auditor none, run on vm-104 with the operator's go) returned verdict fail on two findings, both dice-lines ledger-contradiction 'expected 1, found 0': seq 191 (Odo's reliquary toll to Snag) and seq 215 (Odo stepping between Snag and the fire-goblin, check.resolved seq 213 with band success, total null, margin null). Both are Persuasion checks with no roll (auto-success). Both narrations passed the model audit on attempt 1 and shipped with no dice line. expectedDiceLines renders a 'no roll needed' line for such a check (facts.ts renderRollLine autoSuccess); the shipped narration had none. Report: /app/apps/server/.playtests/20261107T040659Z-session-bb4952dc/report.json in the dev app container.

Related: TASK-0213 (pull-in dice line, the last dice-lines fail), TASK-0104 (engine-derived numbers), TASK-0170 (declared outcome).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A narration whose facts hold an auto-success check ships that check's 'no roll needed' dice line, with a test replaying seq 183-191
- [ ] #2 The deterministic auditor passes seq 191 and seq 215 on a replay of this session
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Closed (close-superseded) by replan-2026-11: 0245: a no-roll check renders a code fact row.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
