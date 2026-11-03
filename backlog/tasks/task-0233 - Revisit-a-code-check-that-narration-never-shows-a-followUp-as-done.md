---
id: TASK-0233
title: 'Revisit: a code check that narration never shows a followUp as done'
status: To Do
assignee: []
created_date: '2026-11-03 10:46'
labels:
  - dm
  - narration
  - revisit
milestone: m-3
dependencies:
  - TASK-0214
ordinal: 219000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Revisit trigger: runbook B's playtest. If the playtest records narration showing a parked followUp (not yet attempted) as done, scope a deterministic check; otherwise close this card.

Why: spec 085 (TASK-0214) OQ-2 took default (a): TASK-0208 carries open followUps into later beats and the narrate rule forbids showing them done, but only the model audit enforces it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The runbook B playtest log records whether any followUp was shown as done
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
