---
id: TASK-0202
title: Seed-declared starting conditions on NPCs
status: To Do
assignee: []
created_date: '2026-11-02 14:51'
labels:
  - dm
  - seed
  - revisit
dependencies:
  - TASK-0194
ordinal: 188000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a scene seed can give an NPC a starting condition (e.g. restrained), so the engine knows it.

Why: spec 068 OQ-3 (operator accepted the default 2026-11-02). Pell is bound in the fiction, but the engine has no restrained condition on him, so 'remove restrained' is refused with CONDITION_NOT_PRESENT after the check lands.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The seed schema accepts starting conditions on an NPC, and the shipped greyhollow seed gives Pell restrained
- [ ] #2 Freeing Pell removes restrained with no refusal, with a test
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
