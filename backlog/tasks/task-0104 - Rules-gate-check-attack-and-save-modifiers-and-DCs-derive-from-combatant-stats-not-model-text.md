---
id: TASK-0104
title: >-
  Rules gate: check, attack and save modifiers and DCs derive from combatant
  stats, not model text
status: In Progress
assignee: []
created_date: '2026-10-26 15:42'
updated_date: '2026-11-03 06:10'
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

Spec: specs/082-engine-derived-numbers
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Check, save and attack steps from interpret and adjudicate carry no model-written modifier; the engine derives it from the acting combatant's stats
- [ ] #2 A check or save DC comes from an engine-tabulated difficulty (SRD 5.2.1 DC table) or a target stat the engine reads; the model picks a difficulty tier, not a number
- [ ] #3 Attack rolls use the target's AC from its stats; targetAc is not model-written
- [ ] #4 A step naming a combatant, ability or skill the stats do not define is rejected at the schema or engine gate, with a test
- [ ] #5 Scripted-dice engine tests cover each derivation; existing dm tests and the scripted CI playtest stay green
- [x] #6 Spec phase: Seam check [orchestrator]
- [ ] #7 Spec phase: Engine derivation (card AC #1, #2, #4, #5; US1, US2, US3, US4)
- [ ] #8 Spec phase: Stats on combatants and the reaction path (card AC #1, #3, #4; US2, US3)
- [ ] #9 Spec phase: Step contract, prompts, resolve and plan gate (card AC #1–#4; US1, US2, US3)
- [ ] #10 Spec phase: Scripts, fixtures and integration tests (card AC #5; US5)
- [ ] #11 Spec phase: Re-ground (wiki)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
RESEARCH FINDINGS 2026-10-26 (TASK-0115; decision-0022 D14 point 4). Derive the modifier from the character's ability, proficiency and skill data. The model picks a difficulty tier from the SRD 5.2.1 ladder (Very Easy 5, Easy 10, Medium 15, Hard 20, Very Hard 25, Nearly Impossible 30; SRD p.6), never a raw number. Advantage and disadvantage come from conditions where the SRD defines them, plus model-stated circumstances with a reason. Social DCs keyed to NPC attitude belong to TASK-0119. Dependents: TASK-0128 (opposition DC and Help), TASK-0130 (doctrine pass).

Claimed 2026-11-02 by M3 runbook B (docs/design/m3-runbook-b-resolution-quality.md). Worktree .worktrees/task-0104, branch task-0104-engine-derived-numbers, cut from origin/main b79489e2. Spec number 082 claimed with a stub. Spine #13; R3: authored against spec 070's step contract.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5 (spec 082 authoring, C1)

spec-bridge sync: Seam check [orchestrator]: 0/1 · Engine derivation (card AC #1, #2, #4, #5; US1, US2, US3, US4): 0/13 · Stats on combatants and the reaction path (card AC #1, #3, #4; US2, US3): 0/9 · Step contract, prompts, resolve and plan gate (card AC #1–#4; US1, US2, US3): 0/14 · Scripts, fixtures and integration tests (card AC #5; US5): 0/7 · Re-ground (wiki): 0/6

Spec 082 (557399ed). Defaults (a) taken: OQ-2 condition-driven auto save failures and auto crits out of scope (carded); OQ-3 the roll step and effect Amounts stay model-written (carded); OQ-4 sessions started before this card get STAT_UNDEFINED, start a new scene; OQ-5 paused plans failing the new schema are dropped and re-interpreted; OQ-6 position proxies for frightened/prone with ponytail comments, grappled not derived; OQ-7 monster-feature DCs stay a model-picked tier (carded). OQ-1 (attack damage; Kestrel's Sneak Attack stops applying under default a) put to the operator.

OPERATOR RULING 2026-11-02 on spec 082 OQ-1, in the operator's words: "I'm okay with stats-only as long as the rule for Sneak Attack is something that's going to come later. I don't want to miss it, and I think there's a better time to handle it (when we handle other abilities, maybe) but I do not want to lose it either". OQ-1 takes (a): attack damage comes from the attack entry only. Sneak Attack is carded as TASK-0225 (m-4, after TASK-0058, with class abilities). Tripwire: docs/design/playtest-scenarios.md gains a standing S-sneak-attack row every scenario carries until TASK-0225 is Done.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5 (spec 082 authoring, C1)
Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5 (spec 082 phase 0 seam check and amendment, C1)

spec-bridge sync: Seam check [orchestrator]: 1/1 · Engine derivation (card AC #1, #2, #4, #5; US1, US2, US3, US4): 0/13 · Stats on combatants and the reaction path (card AC #1, #3, #4; US2, US3): 0/9 · Step contract, prompts, resolve and plan gate (card AC #1–#4; US1, US2, US3): 0/14 · Scripts, fixtures and integration tests (card AC #5; US5): 0/7 · Re-ground (wiki): 0/6

Phase 0 seam check (eeb91c61): 15 seams moved, none changed meaning; see specs/082-engine-derived-numbers/deviations.md. interpret bumps to v11, adjudicate to v8; narrate and audit untouched (main narrate-v14 after #122).

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (spec 082 phases 1-2)
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
