---
id: TASK-0216
title: 'Revisit: reveals in talk turns, and offstage NPCs in the narrate prompt'
status: To Do
assignee: []
created_date: '2026-11-03 02:37'
labels:
  - dm
  - presence
  - revisit
milestone: m-3
dependencies:
  - TASK-0206
ordinal: 202000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Revisit trigger: runbook B's playtest (docs/design/m3-runbook-b-resolution-quality.md, Last step). If the playtest shows an NPC revealed in a talk turn staying absent, or narration calling an offstage NPC gone after a reveal, scope this card; otherwise close it.

Why: spec 078 (TASK-0206) OQ-3 and OQ-4 took default (a): talk-turn reveals are out of scope (react output has no arrivals field), and the narrate prompt still lists offstage NPCs as 'gone'. Options (b): add arrivals to the react output; filter offstage actors from narrate as the chronicle now does.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The runbook B playtest log records whether either gap appeared
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
