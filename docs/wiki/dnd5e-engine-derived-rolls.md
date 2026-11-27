---
name: dnd5e-engine-derived-rolls
description: Derived rolls in the 5e engine (spec 082, TASK-0105, TASK-0128; condition auto-fail and auto-crit, spec 119) - stats-derived check and attack rolls, the spell.cast command with its engine spell table, the opposition and help assists with their expiry rules, and the Dodge sources and `castingTime` (spec 117). Read before touching derive.ts, spell or help commands, or assist state.
kind: concept
sources:
  - packages/dnd5e-engine/src/derive.ts
  - packages/dnd5e-engine/src/spells.ts
  - packages/dnd5e-engine/src/commands/spells.ts
  - packages/dnd5e-engine/src/commands/attacks.ts
  - packages/dnd5e-engine/src/commands/economy.ts
  - packages/dnd5e-engine/src/commands/help.ts
  - packages/dnd5e-engine/src/sides.ts
  - packages/dnd5e-engine/src/schema/state.ts
  - packages/dnd5e-engine/src/schema/events.ts
verified_against: e4fe74b76c2ed90656971d1204def9a1b8b7d2f1
---

# 5e engine: derived rolls

Part of the 5e engine ([[dnd5e-engine]]); the command entry point and refusal rules are there.

## Stats and derived rolls

Spec 082. A `Combatant` may carry `stats`; `src/derive.ts` derives rolls from them. `check.roll` takes `dc` or a `difficulty` tier; `attack.roll` takes `expression` or an `attack` entry name. A missing stat refuses `STAT_UNDEFINED`. `Combatant.stats.abilityScores` (optional, scores not modifiers) feeds the `influence` rule.

**Spells** (spec 083, TASK-0105). `spell.cast` (`src/commands/spells.ts`) resolves eight SRD spells (`fire-bolt`, `sacred-flame`, `inflict-wounds`, `ray-of-sickness`, `cure-wounds`, `healing-word`, `bless`, `guidance`) from the engine-held `SPELLS` table (`src/spells.ts`; no SRD import, a server test checks it against the records, [[srd-data]]). It rolls the attack or save (`spellcastingModifier`, `spellSaveDc`), damage (half on a save, rounded down before defenses), healing and conditions, and spends the slot (`slotExpendEvent`; `NO_SLOT_AVAILABLE`). An unknown spell or bad slot level refuses `SPELL_UNRESOLVED`. Each `SPELLS` entry carries `castingTime`, `action` or `bonus-action` (`healing-word` is the only Bonus Action spell); the planner reads it to cost a cast ([[planner]]). A spell attack roll is an attack roll, so it takes attack assists (below). `bless` and `guidance` (spec 124) are `effect` entries, a concentration roll bonus with `moreTargetIds` and `skill` on the command; derived rolls add held bonus dice to the d20 expression: [[dnd5e-engine-concentration]].

**Opposition and Help** (spec 084, TASK-0128). `check.roll` takes a third DC source, `opposition: { opponentId, rule }`; exactly one of `dc`, `difficulty`, `opposition` (else `INVALID_COMMAND`). `oppositionCovers` limits each rule to the checks the SRD names; the opponent cannot be the checker. `unarmed-strike` derives 8 + the opponent's Strength modifier + proficiency bonus (DC 9 for Snag) on a save; an escape check uses a stated escape DC first (spec 120); `influence` derives the higher of 15 and its Intelligence score. A missing stat refuses `STAT_UNDEFINED`. `check.resolved` records `opposition`. `help.grant` (`src/commands/help.ts`) writes `assist.granted` on the holder (`Combatant.assists`, at most one per helper): the ally for an ability-check assist (the helper needs the skill in `stats.skills`, else `NOT_PROFICIENT`), or the distracted enemy for an attack assist. The holder's next derived `check.roll` with that skill, or `attack.roll` / spell attack against that enemy by anyone but the helper, gains advantage and emits `assist.ended` (`used`). A new grant by the same helper ends the old one (`replaced`). `encounter.end` ends all (`encounter-ended`). An assist expires at the start of its helper's next turn (`helperExpiry`; `expired`), checked beside condition expiry in the turn-advance path; outside an encounter it lasts until used.

Spec 094 adds optional `reachFt` and `rangeFt` (`normal`, `long`) to an attack entry in `stats.attacks`. Melee reach defaults to 5 ft; the zone band checks read both ([[dnd5e-engine-reactions]], [[space]]).

Spec 109 (TASK-0223): `findAttack` derives an `Unarmed Strike` entry (name matched case-insensitively) when `stats.attacks` holds none; a stored entry wins. It is melee, `toHit` is Strength modifier + proficiency bonus, and damage is fixed bludgeoning `max(0, 1 + Strength modifier)` (SRD 5.2.1). A missing Strength modifier refuses `STAT_UNDEFINED` (`str modifier`). `firstMeleeAttack` does not derive it.

Spec 099 (TASK-0274) adds the close-combat source to derived rolls: a derived `attack.roll` and a `spell.cast` attack spell fold `disadvantage` when the attack is ranged and `closeCombatFoes` (`src/sides.ts`) finds an opposed, conscious, able, sighted combatant in a melee pair with the attacker (spec 101, TASK-0306: sharing a zone alone no longer counts; see [[dnd5e-engine-sides]]). A melee-or-ranged entry is ranged only outside the engaged band. A combatant with no side, or a state with no placements, never triggers it. It stacks with the other sources through `foldMode` (advantage and disadvantage cancel). Selectors and sides: [[dnd5e-engine]].

Spec 117 (TASK-0304) adds Dodge sources ([[dnd5e-engine-economy]]). When `isDodging` holds for the target, a derived `attack.roll` (a reaction attack too) and a `spell.cast` attack spell fold `disadvantage`. When it holds for the checker or the spell's target, a `check.roll` with `kind: "saving-throw"` and `ability: "dex"` and a `spell.cast` Dexterity save fold `advantage`. Other saves, such as Con, are unaffected. All of these stack through `foldMode`.

## Monster-feature DCs (spec 120)

`Combatant.stats.featureDcs` (`FeatureDcSchema` in `src/schema/state.ts`, optional, at most 12, in record order) holds the DCs a stat block states. It has two kinds: `save` (`feature`, `ability`, `dc`) and `escape` (`feature`, `dc`). `check.roll` takes a fourth DC source, `feature: { sourceId, name }`; exactly one of `dc`, `difficulty`, `opposition` and `feature` (else `INVALID_COMMAND`). `findFeatureDc` (`src/derive.ts`) matches the `save` entry by name, trimmed and case-insensitive. The feature DC applies to saving throws only, and the checker cannot be the source; either case refuses `INVALID_COMMAND`. A dead source is allowed. Refusals: unknown source `UNKNOWN_COMBATANT`; no stats or no such save feature `STAT_UNDEFINED`; a checker `ability` that differs from the feature's save ability `INVALID_COMMAND`. `check.resolved` records `feature: { sourceId, name }`, with the name as stored. `oppositionDc` takes the check kind: for `unarmed-strike` on an ability check (the escape check) it uses the first `escape` entry, else the formula above. A grapple or shove save keeps the formula. The first escape DC applies even to a grapple made by Unarmed Strike (ponytail in `derive.ts`; TASK-0320).

## Condition auto-fail and auto-crit (spec 119)

Spec 119 (TASK-0222) derives two SRD 5.2.1 condition rules in `src/derive.ts`: `autoFailCondition` and `autoCritCondition` (both exported from `src/index.ts`).

**Auto-fail.** `autoFailCondition(combatant, kind, ability)` returns the first of `paralyzed`, `petrified`, `stunned`, `unconscious` the combatant holds, but only for a `saving-throw` on `str` or `dex`; any other kind or ability returns null. `check.roll` and a `spell.cast` save both use it. A derived failure resolves with no die: `check.resolved` carries `autoFail: { reason: "<name> is <condition>" }`, `outcome` and `band` `failure`, `total` and `natural` null, and the spell save deals full damage. A command `autoFail` wins over the derived reason. In `check.roll` the failure branch runs before `autoSuccess`, so a derived failure beats `autoSuccess`. It also applies on the explicit-expression path, not only the derived path. A combatant-less check never derives one. Advantage and disadvantage still pick the kept face on a save that does roll; they do not matter once the save auto-fails.

**Auto-crit.** In a derived `attack.roll` (a reaction attack too), a target holding `paralyzed` or `unconscious` turns a hit into `critical-hit` when the use is melee (not `isRangedUse`; a reach weapon in the engaged band counts). Ranged uses stay a plain `hit`. A `spell.cast` attack stays a plain `hit` too (marked `ponytail:` in `src/commands/spells.ts`). A natural 20 is still a `critical-hit` and a miss stays a miss. An attack with an explicit `expression` and no `attack` entry takes no auto-crit.
