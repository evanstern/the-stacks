---
id: TASK-0204
title: Narration still ends on "What do you do?" despite the doctrine
status: To Do
assignee: []
created_date: '2026-11-02 20:30'
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
- [ ] #1 Narration never ends with the literal "What do you do?" (deterministic check or a blocking audit rule), with a test
- [ ] #2 A hosted run of 10+ turns shows no narration ending on that question
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
