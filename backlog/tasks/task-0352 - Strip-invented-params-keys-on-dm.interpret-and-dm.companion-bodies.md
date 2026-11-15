---
id: TASK-0352
title: Strip invented params keys on dm.interpret and dm.companion bodies
status: To Do
assignee: []
created_date: '2026-11-15T06:02:00Z'
labels:
  - ws:dm
  - revisit
milestone: m-10
dependencies: []
priority: low
ordinal: 336000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Revisit task (spec 116 OQ-2). TASK-0347 strips params keys a strict kind schema does not list, but only on dm.react confirm items. dm.interpret and dm.companion share IntentBodySchema, so the same invented-key failure can hit them. Trigger: the first dm_model_calls schema-mismatch on dm.interpret or dm.companion whose cause is an unknown params key. Then reuse dm/react-params.ts stripParams through those calls' normalize seam.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The trigger has fired, or the card is closed with a note that it never did
- [ ] #2 On fire: the two purposes strip unknown params keys before validation and record each strip, with a replay test
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
