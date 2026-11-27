# Feature Specification: Concentration and roll-bonus spells (Bless, Guidance)

**Feature Branch**: `task-0226-spell-concentration`
**Card**: TASK-0226 (milestone m-12). Depends on TASK-0105 (spec 083, Done). D24 control arm (decision-0032).
**Status**: Draft
Source: `specs/083-*` OQ-2 — spells that grant roll bonuses or need concentration are refused `SPELL_UNRESOLVED`. Odo's Bless and Guidance are refused in play.
Scope: `packages/dnd5e-engine` only (plus the one server test that pins the table to SRD records). No Intent, planner, seed or web change.

## SRD 5.2.1 sources

- `spell.json` `bless` (p. 113, level 1, Concentration up to 1 minute): "You bless up to three creatures within range. Whenever a target makes an attack roll or a saving throw before the spell ends, the target adds 1d4 to the attack roll or save." Higher level: "one additional creature for each spell slot level above 1."
- `spell.json` `guidance` (p. 138, cantrip, Concentration up to 1 minute): "You touch a willing creature and choose a skill. Until the spell ends, the creature adds 1d4 to any ability check using the chosen skill."
- Rules glossary, Concentration (SRD 5.2.1): one Concentration spell at a time; casting another Concentration spell ends the first; Concentration ends if you have the Incapacitated condition or die; when you take damage you make a Constitution saving throw, DC 10 or half the damage taken, whichever is higher (max DC 30), one save per source of damage; failure ends the spell. (`condition.json` also names the "No Concentration" effect.)
- Rules glossary, Combining Magical Effects: the same spell cast more than once does not stack; the most potent applies. Different spells stack.

## Requirements

- **FR-001** `spell.cast` resolves `bless` and `guidance` through the engine. `SPELL_UNRESOLVED` no longer fires for them.
- **FR-002** Bless: `targetId` plus optional `moreTargetIds`; at most `3 + (slotLevel - 1)` distinct creatures. Each gets a +1d4 bonus on attack rolls and saving throws.
- **FR-003** Guidance: one willing target and a required `skill`; +1d4 on ability checks using that skill only.
- **FR-004** A combatant holds at most one concentration. Casting another concentration spell ends the first (cause `replaced`), removing its bonuses.
- **FR-005** Concentration ends when its caster takes damage and fails the Constitution save (DC `min(30, max(10, floor(damage/2)))`; one save per damage instance; Con save modifier from `checkModifier`; no save when damage drops the caster to 0 HP — that ends it outright (cause `incapacitated`/`died`)).
- **FR-006** Concentration ends when the caster gains Incapacitated, paralyzed, petrified, stunned or unconscious (all grant Incapacitated), and on the 1-minute duration (10 rounds, expiring at the caster's turn start) when an encounter is running.
- **FR-007** While active, the bonus die is appended to the target's derived d20 expression for attack rolls (`attack.roll`, spell attacks), saving throws (`check.roll`, spell saves) and ability checks (Guidance skill only). One die per distinct spell id.
- **FR-008** Events are replayable: `concentration.changed`, `roll-bonus.granted`, `roll-bonus.ended`. `evolve` writes their `after` slices. No new command, no new refusal code.

## Out of scope (recorded)

- Departing/removed casters leave stale bonuses (no event hooks on `combatant.removed`).
- Spell range and "willing creature" are not modelled (same as spec 083 for every spell).
- Dispel and Bless on creatures the caster cannot see are the DM's call.

## Acceptance

- AC #1 (card): Bless and Guidance resolve with concentration tracked (one at a time) and broken per SRD 5.2.1; the bonus die applies to the target's rolls; engine tests cover all of it.
