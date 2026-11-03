# Deviations: spec 084 Phase 0 seam check

**Date**: 2026-11-03. **Branch HEAD before amendment**: `12759453`. The base is `main` at
`b0ff919d`, which includes TASK-0105 (#124, spec 083), TASK-0211 (#125), TASK-0171 (#126) and
TASK-0204 (#127).

**Dispatch decision**: develop ahead. Every task that shares a file with this card is merged. No
other runbook B task in implementation shares a source file with plan.md, so runbook B "Rule at
dispatch" does not hold this card.

## Changed-meaning seam (one)

**S1 — A spell attack is an attack roll.** Spec 083 added `handleSpellCast`
(`packages/dnd5e-engine/src/commands/spells.ts`). Its attack delivery rolls a d20 attack with
`foldMode("normal", attackModeSources(...))` and emits `attack.resolved` with `spellId`. It does not
go through `handleAttackRoll`. SRD `rules-glossary.help-action` grants advantage on "the next
attack roll" by an ally against the distracted enemy. A spell attack roll is an attack roll. As
written, plan D5 covered `handleAttackRoll` only. A spell attack would then skip the advantage
and leave the assist for a later weapon attack. That misreads the SRD.
**Resolution**: D5 now also covers the attack delivery of `handleSpellCast`. It folds
`attackAssists(target, casterId)` and ends each applied assist with cause `used`. A spell save
is a saving throw, so no assist applies (FR-011 already excludes saving throws). This follows the
SRD text and needs no operator ruling. It adds `commands/spells.ts` and
`test/commands/spells.test.ts` to Phase 1.

## Moved seams

| # | Seam | On `main` now | Effect on this card |
|---|---|---|---|
| M1 | `StepSchema` union (`nodes/schemas.ts`) | `spell` option between `attack` and `effect`. `InterpretReadingSchema.intent` already lists `"help"` | Append `help` after `spell`. No intent change |
| M2 | `refineSteps` | Unchanged. The attack branch runs, then `return` for anything but an ability check | Put the opposition and help branches before that `return` |
| M3 | `prompts/step-grammar.ts` | Two spell lines between the attack line and the difficulty-tier line | Add the opposition-rules line beside the tier line. Add the help line after the spell lines |
| M4 | Prompt versions | interpret-v12, adjudicate-v9, narrate-v16, audit-v10 | Bump to interpret-v13, adjudicate-v10, narrate-v17, audit-v11 (M5) |
| M5 | `prompts/audit.ts` | Renders facts through narrate's `factEntries`. Every fact-shape card bumped it with narrate (v7 to v10) | The assist fact changes audit's rendered prompt too. Bump audit to v11. Adds `prompts/audit.ts` to Phase 3 |
| M6 | `nodes/resolve.ts` `runSteps` | `case "spell"` before `case "attack"`. `case "check"` unchanged | Add `case "help"`. D11 is unchanged |
| M7 | `plan-gate.ts` `stepIds`, `stepTexts` | Each switch has a `spell` case | Append the `help` cases |
| M8 | `plan-gate.ts` `foreignActor` | The ternary checks `attackerId`, `casterId`, then `combatantId` for a move | Add `helperId` as a fourth branch |
| M9 | `plan-gate.ts` `statGap`, verdict | `statGap` signature unchanged. New `spellGap` runs after it. The `ok:false` verdict code is `STAT_UNDEFINED` or a `SPELL_*` code | Help and opposition gaps stay in `statGap`. No `spellGap` change |
| M10 | `plan-gate.ts` `askUndeclared` | The id ternary covers `attackerId`, `casterId` and an ability-check `combatantId`. `otherPlayerQuestion(name, declarer)` ends "What does <Declarer> do instead?" (TASK-0204) | Add `helperId`. Call the two-argument form. The plan-gate test asserts the new question text |
| M11 | Engine `commands/attacks.ts` | `checkNamed` and `actorUnable` are exported. `isUnable` is not | D6 uses `checkNamed` and `actorUnable`. Widen the `role` parameter to `"attacker" \| "checker" \| "helper"`. Do not export `isUnable` |
| M12 | Engine `derive.ts` | Adds `spellcastingModifier` | No overlap. Append the D2 functions |
| M13 | Engine `execute.ts`, `index.ts` | `spell.cast` handler registered. Spell exports appended | Append `help.grant` and the D2 exports |
| M14 | Engine `schema/commands.ts`, `events.ts`, `refusals.ts` | `spell.cast` command. `spellId` on `attack.resolved` and `check.resolved`. `half` on `hp.changed`. Refusals `SPELL_UNRESOLVED`, `SPELL_UNKNOWN`, `SPELL_NOT_PREPARED` | Append. `NOT_PROFICIENT` is refusal code #35 in `contracts/refusals.md` |
| M15 | `execute.test.ts` counts | 23 commands, 18 events, 34 refusal codes | Move to 24, 20 and 35. Adds `execute.test.ts` to Phase 1 |
| M16 | `catalog.test.ts` counts | 18 mechanics, 37 total (spec 083 added no event) | Unchanged plan: 20 and 39 |
| M17 | `coverage.test.ts` | `PLAN_GATE_ONLY` adds the two plan-gate spell codes | No change. `help.test.ts` asserts `NOT_PROFICIENT` with `expectRefusal` |
| M18 | `facts.ts` `FactChange` | Adds `spell-slot`. `renderChangeLine` returns null for every kind but `hp` and `death-saves` | Append `assist`. `renderChangeLine` needs no edit |
| M19 | `fallback.ts` | `changeSentence` has a `spell-slot` case. TASK-0204 and TASK-0171 merged ahead. `factualSummary` voices the scene-start party and NPCs | Append the `assist` case. No fallback-order conflict remains before TASK-0214 |
| M20 | `prompts/narrate.ts` `describeChange` | Has a `spell-slot` case. `openingSection` is new | Append the `assist` case |
| M21 | `seed/schema.ts` `groupChecks` comment | Still "read by nothing until TASK-0128". The orchestrator carded OQ-5 as TASK-0232 | The comment names TASK-0232 instead of the OQ |
| M22 | `test/dm/world.ts` | `spellStep()` builder after `attackStep()` | Append `helpStep()` after `spellStep()` |
| M23 | Wiki size budget | `dnd5e-engine.md` and `dm-failure-and-gates.md` already carry `size_budget_exempt` (TASK-0105). TASK-0231 cards the split | Phase 4 extends each exemption reason to name TASK-0128 and TASK-0231. Do not split the notes here |

## Seams checked and unchanged

- `check.roll` and `handleCheckRoll` order (D4): unchanged since spec 082.
- `handleAttackRoll` derived path (D5): unchanged. Only the two helper exports moved (M11).
- `commands/encounter.ts` `expiring` and `handleEncounterEnd` (D7), `evolve.ts`,
  `schema/state.ts`, `seed/combatants.ts` `statsFromSrd` (D8): untouched by the four merges.
- `first-stage.ts`, `stakes.ts`, `resume.ts` (R9): no change reaches the check step's
  `difficulty`.

## Open questions

- OQ-1 to OQ-6: defaults (a) accepted by the operator. OQ-2 is noted on TASK-0224. OQ-5 is
  carded as TASK-0232.
