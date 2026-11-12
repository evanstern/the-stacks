---
id: TASK-0320
title: 'Monster policy: multiattack, spells and morale'
status: To Do
assignee: []
created_date: '2026-11-12T18:22:00Z'
labels:
  - ws:intent
  - revisit
milestone: m-11
dependencies:
  - TASK-0299
  - TASK-0224
ordinal: 304000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spec 107 OQ-5. TASK-0299's monsterStages() picks one attack, or a move then an attack, from the stat block and a nearest/weakest tactic. It ignores multiattack, spells, and fleeing or surrendering at low HP. Trigger: a seed or playtest needs a monster to multiattack, cast or break.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 monsterStages() plans multiattack and spell options from the stat block, with tests.
- [ ] #2 A morale rule lets a monster flee or yield in code, with a test.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
