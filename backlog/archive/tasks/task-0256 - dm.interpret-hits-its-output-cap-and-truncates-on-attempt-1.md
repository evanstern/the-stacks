---
id: TASK-0256
title: dm.interpret hits its output cap and truncates on attempt 1
status: To Do
assignee: []
created_date: '2026-11-07 03:09'
updated_date: '2026-11-07 05:19'
labels:
  - dm
  - playtest
  - replan-2026-11
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-11-06-runbook-b2-playtest.md
priority: medium
ordinal: 240000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: dm.interpret's first attempt fits its output cap, so a turn does not pay a full retry.

Why: runbook B2 playtest run 1 (2026-11-06, session bb4952dc): dm.interpret attempt 1 returned truncated twice in 28 calls (seq 31-33, 88.7 s turn; seq 169-174, 77.5 s turn). Both recovered on attempt 2. The two slowest turns of the run. Check the interpret maxTokens against interpret-v15's longer output (spec 086 added required fields; spec 088 added the arriving section).

Related: TASK-0203 (parse outcomes), TASK-0132 (progress).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The interpret output cap is sized from measured reply lengths, recorded on the card
- [ ] #2 A hosted run of 10+ turns shows no truncated dm.interpret attempt 1
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged into TASK-0273 by replan-2026-11. Interpret truncation.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
