---
id: TASK-0104
title: >-
  Rules gate: check, attack and save modifiers and DCs derive from combatant
  stats, not model text
status: To Do
assignee: []
created_date: '2026-10-26 15:42'
updated_date: '2026-10-27 02:33'
labels:
  - engine
  - dm
  - rules-gate
milestone: m-3
dependencies: []
priority: medium
ordinal: 94000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: when the DM runtime resolves a check, attack or save, the engine computes the roll's modifier from the combatant's stats (ability scores, proficiency bonus, skill and save proficiencies) and the DC or AC from the target's stats or an engine-tabulated DC. The model names the ability, the skill and the target; it never writes the modifier or the DC.

Why: operator requirement 2026-10-26 (TASK-0102 card): rules with definitions must be deterministically defined and resolvable, and the AI must not invent them. Today interpret and adjudicate emit a free dice expression ('1d20+3') and a numeric dc on each check and attack step (apps/server/src/dm/nodes/schemas.ts StepSchema). The engine parses the expression, but the modifier and the DC are model-chosen. Found by the TASK-0102 gate audit (specs/033-director-robustness, rules-terms section).

Scope: the source of stats is the scene seed's combatant records (apps/server/src/dm/seed/schema.ts), which already carry abilities and skills. TASK-0058 (m-4) later moves the source to the codex PC entity; this card does not build sheets. Engine-owned numbers per TASK-0042 R8.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Check, save and attack steps from interpret and adjudicate carry no model-written modifier; the engine derives it from the acting combatant's stats
- [ ] #2 A check or save DC comes from an engine-tabulated difficulty (SRD 5.2.1 DC table) or a target stat the engine reads; the model picks a difficulty tier, not a number
- [ ] #3 Attack rolls use the target's AC from its stats; targetAc is not model-written
- [ ] #4 A step naming a combatant, ability or skill the stats do not define is rejected at the schema or engine gate, with a test
- [ ] #5 Scripted-dice engine tests cover each derivation; existing dm tests and the scripted CI playtest stay green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
RESEARCH FINDINGS 2026-10-26 (TASK-0115; decision-0022 D14 point 4). Derive the modifier from the character's ability, proficiency and skill data. The model picks a difficulty tier from the SRD 5.2.1 ladder (Very Easy 5, Easy 10, Medium 15, Hard 20, Very Hard 25, Nearly Impossible 30; SRD p.6), never a raw number. Advantage and disadvantage come from conditions where the SRD defines them, plus model-stated circumstances with a reason. Social DCs keyed to NPC attitude belong to TASK-0119. Dependents: TASK-0128 (opposition DC and Help), TASK-0130 (doctrine pass).
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
