---
id: TASK-0042
title: 'First Scene: pure 5e engine package'
status: In Progress
assignee: []
created_date: '2026-10-25 19:59'
updated_date: '2026-10-26 01:58'
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

Spec: specs/026-dnd5e-engine
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
- [x] #12 Spec phase: Setup — package scaffold and boundary rule (AC #10)
- [ ] #13 Spec phase: Foundational — schemas, RNG, dice and the entry point (US1, AC #1–#3, #9)
- [ ] #14 Spec phase: User Story 2 — combatants, HP and damage defenses, temporary HP, life states, death saves (AC #4, #7)
- [ ] #15 Spec phase: User Story 6 — attacks, checks and saves (AC #2, #9, #11; research R8)
- [ ] #16 Spec phase: User Stories 3 and 4 — conditions, initiative and turns (AC #5, #6)
- [ ] #17 Spec phase: User Story 5 — rests and spell slots (AC #8)
- [ ] #18 Spec phase: Polish — coverage meta-test, replay scene, docs, full gate (AC #9, #11)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-25 by the M2 First Scene sweep (docs/design/m2-first-scene-sweep-runbook.md, lane 1). Worktree .worktrees/task-0042, branch task-0042-dnd5e-engine, cut from origin/main 4fee63a. Spec number 026-dnd5e-engine claimed with a stub.

Spec authoring by opus-implementer: f12be7e, plus amendments 27364fc and e092e03; ~241k tokens in total. Clarify was skipped (spec.md records why).
Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
Orchestrator rulings 2026-10-25, derived from decision-0021 idea 1 and decision-0017 (research R8):
- Adjudication supplies inputs as data: AC, DC, damage type, defenses, roll mode, and autoFail with a reason.
- The engine does all of the arithmetic: attack versus AC, criticals, resistance, vulnerability and immunity.
Implementation dispatch grouping (orchestrator's call): P1 | P2 | P3+P4 | P5+P6 | P7.

Phase 1 (Setup) by sonnet-implementer: c839b7a; ci:check green, boundaries 11/11. Deviation: @types/node is a test-only devDependency.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
