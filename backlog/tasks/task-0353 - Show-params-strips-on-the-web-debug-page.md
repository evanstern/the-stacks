---
id: TASK-0353
title: Show params strips on the web debug page
status: To Do
assignee: []
created_date: '2026-11-15T06:02:00Z'
labels:
  - ws:dm
  - revisit
milestone: m-10
dependencies: []
priority: low
ordinal: 337000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Revisit task (spec 116 OQ-3). TASK-0347 records each stripped confirm params key as check.stripped on the talk job (jobs.result.check). The /turns and /jobs debug routes show it, but the web debug page reads checkpoint.narration.check, which a confirm-only read never writes, so the page does not. Trigger: an operator or playtest needs to read strips on the page instead of the routes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The trigger has fired, or the card is closed with a note that it never did
- [ ] #2 On fire: the debug page renders a talk job's check.stripped entries
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
