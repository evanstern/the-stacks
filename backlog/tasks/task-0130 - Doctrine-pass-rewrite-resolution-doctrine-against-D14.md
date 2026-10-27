---
id: TASK-0130
title: 'Doctrine pass: rewrite resolution doctrine against D14'
status: To Do
assignee: []
created_date: '2026-10-27 02:33'
labels:
  - dm
  - doctrine
  - narration
milestone: m-3
dependencies:
  - TASK-0127
  - TASK-0104
priority: medium
ordinal: 117000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the doctrine pairs, narrate rules and audit definitions that govern resolution match decision-0022 (D14) and the contract cards that implement it. Scope: doctrine pairs P6 hero-is-theirs, P7, P8 blame-the-situation, P9 roll-when-uncertain, P10 fail-forward, P11 trying-costs, P12, P13 yes-and, P19 dice-stand, P24; narrate-v3 N5, N7, N8 (E3); audit-v2 A1 player-agency. Add the flavour-intensity rule (operator ruling 2026-10-26): flavour matches the natural die, a low natural roll gets a bigger, more dramatic failure and a high one a more dramatic success, without moving state or choosing for the player. Text and audit wording only; measure on a captured run. Grounding: decision-0022 (D14) and docs/research/Resolution-and-Outcome/Analysis-Dice-Versus-Player.md (TASK-0115, lands with TASK-0115's PR).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each listed pair and rule is rewritten or confirmed against D14, citing the research branch
- [ ] #2 The flavour-intensity rule is in the narrate doctrine, with an audit check that flavour never adds a state change
- [ ] #3 A captured run measures player-agency and fallback rates before and after the pass
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
