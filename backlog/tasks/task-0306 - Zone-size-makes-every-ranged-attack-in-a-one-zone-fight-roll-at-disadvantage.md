---
id: TASK-0306
title: Zone size makes every ranged attack in a one-zone fight roll at disadvantage
status: To Do
assignee: []
created_date: '2026-11-10T04:45:00Z'
labels:
  - ws:space
  - replan-2026-11
  - ep-1
  - rules
milestone: m-10
dependencies: []
priority: medium
ordinal: 290000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while merging TASK-0271 with TASK-0274 (2026-11-09). Spec 100 gathers the party into the encounter zone at encounter start, and the reed-camp encounter is one zone (a 30-ft mud island). The close-combat rule (TASK-0274, operator ruling: engine applies ranged disadvantage when a hostile shares the attacker's zone) therefore gives every ranged attack in that fight disadvantage, for the whole fight. SRD 5.2.1 applies it only when a hostile is within 5 ft. Kestrel, an archer, is penalized on every shot. Evidence: two DB tests needed a second d20 (TASK-0271 commit c57d756b).

Options: (a) the rule needs the attacker 'engaged' (a hostile that has moved or attacked into melee with it, tracked per combatant) not merely sharing a zone; (b) split large encounter zones in seeds; (c) start ranged combatants at an edge zone. Needs an operator ruling before build.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An operator ruling picks the model for 'within 5 ft' in zone mode, recorded on this card.
- [ ] #2 In the reed-camp fight, an archer not engaged in melee rolls a ranged attack without disadvantage, with a golden-dice test.
- [ ] #3 An archer with a hostile engaged in melee with it still rolls at disadvantage.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
