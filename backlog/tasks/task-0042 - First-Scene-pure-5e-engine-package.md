---
id: TASK-0042
title: 'First Scene: pure 5e engine package'
status: To Do
assignee: []
created_date: '2026-10-25 19:59'
updated_date: '2026-10-25 19:59'
labels:
  - first-scene
  - engine
milestone: m-2
dependencies:
  - TASK-0041
references:
  - docs/design/architecture.md
  - docs/design/milestones.md
priority: high
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a pure 5e engine package. Its one entry point is (state, command, rng) -> events | refusal. It has no I/O, no database, no network and no LLM.

Why: the engine owns every number; the LLM owns story and never rolls or does arithmetic (decision-0017 layer 2, decision-0021 idea 1). The gate (TASK-0045) wraps this function, and every later milestone resolves mechanics through it. 5e only, behind a dnd5e module boundary (decision-0010).

Scope: dice expression parser, seeded RNG with scripted-dice injection, HP and temporary HP, conditions as data, initiative and turn order, life states and death saves, short and long rests, spell slots, refusal codes. Spell and monster effects beyond these primitives resolve through adjudication (TASK-0046), not code.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The engine exposes one pure function that takes state, a command and an RNG, and returns events or a refusal.
- [ ] #2 The dice parser accepts NdM, modifiers, keep-highest and keep-lowest (for example 4d6kh3), advantage, disadvantage and bonus dice.
- [ ] #3 A seeded RNG makes every roll reproducible, and tests inject scripted dice results.
- [ ] #4 The engine applies damage and healing to HP and temporary HP, and each resulting event records before and after values.
- [ ] #5 Conditions are data records, and the engine applies, lists and removes them.
- [ ] #6 The engine rolls initiative, orders turns and advances the active turn.
- [ ] #7 The engine tracks life states (conscious, unconscious, stable, dead) and resolves death saves.
- [ ] #8 The engine resolves short and long rests, and spends and restores spell slots.
- [ ] #9 An illegal command returns a refusal with a specific error code and produces no events.
- [ ] #10 The boundary check fails if the package imports a database, network or LLM module.
- [ ] #11 Scripted-dice unit tests cover every command and every refusal code.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
