---
name: dnd5e-engine-derived-rolls
description: Derived rolls in the 5e engine (spec 082, TASK-0105, TASK-0128) - stats-derived check and attack rolls, the spell.cast command with its engine spell table, and the opposition and help assists with their expiry rules. Read before touching derive.ts, spell or help commands, or assist state.
kind: concept
sources:
  - packages/dnd5e-engine/src/derive.ts
  - packages/dnd5e-engine/src/spells.ts
  - packages/dnd5e-engine/src/commands/spells.ts
  - packages/dnd5e-engine/src/commands/help.ts
  - packages/dnd5e-engine/src/sides.ts
  - packages/dnd5e-engine/src/schema/state.ts
  - packages/dnd5e-engine/src/schema/events.ts
verified_against: 6ae46ed20335a69754372878a551bd8ea3ceb1da
---

# 5e engine: derived rolls

Part of the 5e engine ([[dnd5e-engine]]); the command entry point and refusal rules are there.

## Stats and derived rolls

Spec 082. A `Combatant` may carry `stats`; `src/derive.ts` derives rolls from them. `check.roll` takes `dc` or a `difficulty` tier; `attack.roll` takes `expression` or an `attack` entry name. A missing stat refuses `STAT_UNDEFINED`. `Combatant.stats.abilityScores` (optional, scores not modifiers) feeds the `influence` rule.

**Spells** (spec 083, TASK-0105). `spell.cast` (`src/commands/spells.ts`) resolves six SRD spells (`fire-bolt`, `sacred-flame`, `inflict-wounds`, `ray-of-sickness`, `cure-wounds`, `healing-word`) from the engine-held `SPELLS` table (`src/spells.ts`; no SRD import, a server test checks it against the records, [[srd-data]]). It rolls the attack or save (`spellcastingModifier`, `spellSaveDc`), damage (half on a save, rounded down before defenses), healing and conditions, and spends the slot (`slotExpendEvent`; `NO_SLOT_AVAILABLE`). An unknown spell or bad slot level refuses `SPELL_UNRESOLVED`. A spell attack roll is an attack roll, so it takes attack assists (below).

**Opposition and Help** (spec 084, TASK-0128). `check.roll` takes a third DC source, `opposition: { opponentId, rule }`; exactly one of `dc`, `difficulty`, `opposition` (else `INVALID_COMMAND`). `oppositionCovers` limits each rule to the checks the SRD names; the opponent cannot be the checker. `unarmed-strike` derives 8 + the opponent's Strength modifier + proficiency bonus (DC 9 for Snag); `influence` derives the higher of 15 and its Intelligence score. A missing stat refuses `STAT_UNDEFINED`. `check.resolved` records `opposition`. `help.grant` (`src/commands/help.ts`) writes `assist.granted` on the holder (`Combatant.assists`, at most one per helper): the ally for an ability-check assist (the helper needs the skill in `stats.skills`, else `NOT_PROFICIENT`), or the distracted enemy for an attack assist. The holder's next derived `check.roll` with that skill, or `attack.roll` / spell attack against that enemy by anyone but the helper, gains advantage and emits `assist.ended` (`used`). A new grant by the same helper ends the old one (`replaced`). `encounter.end` ends all (`encounter-ended`). An assist expires at the start of its helper's next turn (`helperExpiry`; `expired`), checked beside condition expiry in the turn-advance path; outside an encounter it lasts until used.

Spec 094 adds optional `reachFt` and `rangeFt` (`normal`, `long`) to an attack entry in `stats.attacks`. Melee reach defaults to 5 ft; the zone band checks read both ([[dnd5e-engine-reactions]], [[space]]).

Spec 099 (TASK-0274) adds the close-combat source to derived rolls: a derived `attack.roll` and a `spell.cast` attack spell fold `disadvantage` when the attack is ranged and `closeCombatFoes` (`src/sides.ts`) finds an opposed, conscious, able, sighted combatant in the attacker's zone. A melee-or-ranged entry is ranged only outside the engaged band. A combatant with no side, or a state with no placements, never triggers it. It stacks with the other sources through `foldMode` (advantage and disadvantage cancel). Selectors and sides: [[dnd5e-engine]].
