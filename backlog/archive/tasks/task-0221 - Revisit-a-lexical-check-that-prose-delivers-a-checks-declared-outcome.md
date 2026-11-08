---
id: TASK-0221
title: 'Revisit: a lexical check that prose delivers a check''s declared outcome'
status: To Do
assignee: []
created_date: '2026-11-03 04:21'
updated_date: '2026-11-07 05:18'
labels:
  - dm
  - narration
  - revisit
  - replan-2026-11
milestone: m-3
dependencies:
  - TASK-0170
ordinal: 207000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Revisit trigger: runbook B's playtest, or any later playtest that records a check success whose declared outcome the narration did not deliver while the dm.audit passed. If none, close this card.

Why: spec 080 (TASK-0170) OQ-4 took default (a): delivery of the applied outcome is a dm.audit criterion (model), not a deterministic code check.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The playtest log records whether any success went undelivered past the audit
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Closed (close-superseded) by replan-2026-11: TASK-0272.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
