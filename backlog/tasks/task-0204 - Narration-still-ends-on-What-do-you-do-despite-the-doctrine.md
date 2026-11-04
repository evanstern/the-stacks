---
id: TASK-0204
title: Narration still ends on "What do you do?" despite the doctrine
status: In Progress
assignee: []
created_date: '2026-11-02 20:30'
updated_date: '2026-11-04 03:15'
labels:
  - dm
  - narration
  - playtest
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-11-02-runbook-a-playtest.md
ordinal: 190000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: DM narration ends on a moment that demands a response, never the literal "What do you do?".

Why: runbook A playtest run 1 (2026-11-02, session 9296c653): both narrations so far (seq 13, 21, dm.narrate-v7) end with "What do you do?". apps/server/src/dm/doctrine/doctrine.ts:44 lists exactly that as the wrong example, and dm.audit-v4 flags it each time, but as non-blocking, so it ships. Seq 21 also repeats the opening's smoke and footprints and echoes Odo's line.

Where: dm/prompts/narrate.ts (v7) and the audit's blocking rule for the ending; or a deterministic check in the auditor checks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Narration never ends with the literal "What do you do?" (deterministic check or a blocking audit rule), with a test
- [ ] #2 A hosted run of 10+ turns shows no narration ending on that question
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-03 by M3 runbook B (docs/design/m3-runbook-b-resolution-quality.md). Worktree .worktrees/task-0204, branch task-0204-no-what-do-you-do, cut from origin/main 40a0783d. No spec dir: signed escape line covers this task. Spine #18. Escape line E4 (card ACs drive).

Dispatch: tier=haiku pinned=cc/claude-haiku-5-5 served=claude-haiku-5-5 (E4 implementation)

AC #1: deterministic blocking check in nodes/audit.ts (final sentence is the literal 'What do you do?', incl. 'all'/'two' forms); no exemption. Orchestrator review found TASK-0205's otherPlayerQuestion ended on the banned phrase; it now asks 'What does <Declarer> do instead?'. Gates on the final tree green. AC #2 (hosted 10+ turns) ticks at the runbook B playtest; card stays In Progress until then (runbook rule).

Playtest ceiling (runbook B playtest, 2026-11-03), operator's words: "Play it, ceiling $100".
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
