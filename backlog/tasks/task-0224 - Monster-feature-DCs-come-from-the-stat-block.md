---
id: TASK-0224
title: Monster-feature DCs come from the stat block
status: To Do
assignee: []
created_date: '2026-11-03 05:40'
updated_date: '2026-11-03 09:53'
labels:
  - dm
  - engine
  - rules
milestone: m-3
dependencies:
  - TASK-0104
ordinal: 210000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spec 082 (TASK-0104) OQ-7: a DC a monster feature names (a save against a trait) stays a model-picked difficulty tier. Derive it from the SRD stat block.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A save against a monster feature uses the DC its SRD record states, with an engine test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope added by spec 084 (TASK-0128) OQ-2: stat-block escape DCs (21 of 38 SRD grapple escape DCs differ from 8 + STR mod + proficiency); the engine uses the formula until this card lands.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
