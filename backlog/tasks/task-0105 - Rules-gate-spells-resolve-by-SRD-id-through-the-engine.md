---
id: TASK-0105
title: 'Rules gate: spells resolve by SRD id through the engine'
status: In Progress
assignee: []
created_date: '2026-10-26 15:42'
updated_date: '2026-11-03 08:00'
labels:
  - engine
  - dm
  - rules-gate
milestone: m-3
dependencies:
  - TASK-0104
priority: medium
ordinal: 95000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: when a character casts a spell, interpret or adjudicate emits a spell step naming the SRD spell record id (and slot level where it applies). The engine looks the record up in @the-stacks/srd, rejects an unknown id, and resolves the spell's attack, save, DC, damage dice, damage type and conditions from the record plus the caster's stats. The model never writes a spell's numbers.

Why: operator requirement 2026-10-26 (TASK-0102 card): 'Conditions, spells, and other rules with definitions absolutely need to be deterministically defined and resolvable.' Today no spell id exists in any node output: intent 'spell' plays as model-written check, attack and effect steps (apps/server/src/dm/nodes/schemas.ts). The SRD spell records exist since TASK-0043 (packages/srd, kind 'spell'). Found by the TASK-0102 gate audit (specs/033-director-robustness, rules-terms section).

Depends on TASK-0104 (the engine derives the caster's spell attack bonus and save DC from stats). Spell slots on a PC sheet stay with TASK-0058 (m-4); this card resolves the spell, not slot bookkeeping, unless the spec finds the seed already tracks slots.

Spec: specs/083-spells-by-srd-id
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Node output has a spell step that names an SRD spell id; an id not in the SRD data is rejected by the gate, with a test
- [ ] #2 The engine resolves the spell's attack or save, DC, damage and conditions from the SRD record and the caster's stats; no spell number is model-written
- [ ] #3 A spell the engine cannot resolve mechanically yet is refused with a refusal code, not improvised into free steps, with a test
- [ ] #4 The interpret and adjudicate prompts render the spell-step shape and state that spell numbers come from the engine
- [ ] #5 Scripted-dice engine tests cover at least one attack spell, one save spell and one condition spell from the SRD; existing dm tests and the scripted CI playtest stay green
- [x] #6 Spec phase: Seam check [orchestrator]
- [ ] #7 Spec phase: Engine spell resolution (card AC #2, #3, #5; US1, US2, US3, US4)
- [ ] #8 Spec phase: Spell step, plan gate, resolve, prompts, snapshot and seeds (card AC #1–#5; US1–US5)
- [ ] #9 Spec phase: Re-ground (wiki)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-03 by M3 runbook B (docs/design/m3-runbook-b-resolution-quality.md). Worktree .worktrees/task-0105, branch task-0105-spells-by-srd-id, cut from origin/main 05ef251e. Spec number 083 claimed with a stub. Spine #14; spec authored while 0104 builds.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5 (spec 083 authoring, C1)

spec-bridge sync: Seam check [orchestrator]: 1/1 · Engine spell resolution (card AC #2, #3, #5; US1, US2, US3, US4): 0/16 · Spell step, plan gate, resolve, prompts, snapshot and seeds (card AC #1–#5; US1–US5): 0/14 · Re-ground (wiki): 0/6
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
