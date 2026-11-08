---
id: TASK-0169
title: 'Roll lines name the ability, skill and roll mode of the check'
status: To Do
assignee: []
created_date: '2026-10-28 19:14'
updated_date: '2026-11-07 05:18'
labels:
  - dm
  - web
  - replan-2026-11
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-10-28-two-browser-alpha.md
priority: medium
ordinal: 156000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: every roll line names what kind of roll it is, for example 'Tamsin Vale — Intelligence (Investigation), advantage: 2d20kh1+3 → …'.

Why: two-browser alpha playtest 2026-10-28, item 3. The line read '1d20+3 → 20 = 23 vs DC 12' with only the model's free-text reason, so the player could not tell which check was rolled or whether help applied. Interpret steps already carry ability, skill and roll mode (apps/server/src/dm/nodes/schemas.ts StepSchema). FactRoll (apps/server/src/dm/facts.ts) keeps only name, reason and expression, so renderRollLine cannot print them.

Related: TASK-0128 makes Help grant advantage; TASK-0104 derives the modifier. This card only labels what the engine rolled.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 FactRoll carries the ability, the skill (or none) and the roll mode of each check and save
- [ ] #2 renderRollLine prints ability, skill in parentheses, and the roll mode when it is not normal, with a test
- [ ] #3 Attack roll lines name the attack, unchanged otherwise, with a test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Merged into TASK-0247 by replan-2026-11. Roll rows name check and mode.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
