# Implementation Plan: Engine-derived numbers — modifiers, DCs and AC from combatant stats

**Branch**: `task-0104-engine-derived-numbers` | **Date**: 2026-11-03 | **Spec**: [spec.md](spec.md)

**Input**: `specs/082-engine-derived-numbers/spec.md`, TASK-0104 and its research notes, runbook B
(`docs/design/m3-runbook-b-resolution-quality.md`, lane B3, spine #13, re-split R3). The operator
ruled OQ-1 to OQ-7 at (a) on 2026-11-02. It builds on merged TASK-0127 (spec 070), TASK-0170
(spec 080) and TASK-0207 (spec 081). The T001 seam check is in `deviations.md`.

Research, design and contracts live in this file, as in specs 064, 070 and 079. No separate
research.md, data-model.md or quickstart.md.

## Summary

Engine combatants gain `stats`. The DM runtime fills them at `combatant.add`: PCs from the seed
sheet, monsters and pulled-in NPCs from their SRD record. A new pure engine module derives the
check and save modifier, the attack's to-hit and damage, the roll mode from SRD conditions, the DC
from a difficulty tier, and a caster's spell save DC and spell attack bonus. `check.roll` takes a
`difficulty`; `attack.roll` takes an `attack` name. The model's check and attack steps lose every
number: they name the ability, skill, tier, attack and target. Resolve applies the attack entry's
damage on a hit. The plan gate refuses a step the stats cannot derive with `STAT_UNDEFINED`. Spec
079's opportunity attack reads the same stats. Every script and fixture is migrated.

## Technical Context

**Language/Version**: TypeScript (Node 22), as the repo.
**Primary Dependencies**: Zod, Vitest. **No new runtime dependency** (checkpoint C5 not reached).
**Storage**: Postgres event log (JSON payloads). **No migration**: stats ride the `combatant.added`
`after` payload; new event fields are optional.
**Testing**: Vitest. Engine scripted-dice tests; pure unit tests (seed stats, plan gate, schemas,
prompts); DB integration tests with `REQUIRE_DATABASE=1` on the worktree stack; the fake gateway and
DM scripts (spec 053). No paid run.
**Target Platform**: `packages/dnd5e-engine` and the server DM pipeline.
**Constraints**: frozen contracts untouched (`docs/wiki/ws-protocol.md` frames,
`specs/029-proposal-gate/contracts/`, `specs/030-play-route/contracts/proposal-seam.md`). A
`mechanics` proposal carries any `EngineCommand`, so the new command fields ride it unchanged. The
engine keeps importing only `zod` (purity test). `facts.ts` keeps importing no engine value.
**Scale/Scope**: 9 engine files (1 new) and 3 engine tests (1 new), 10 server source files, 2 new server
tests, about 25 TS test files, 21 JSON scripts and fixtures, 8 contract files, the wiki.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable**: no human-only path. Stats are set by code from seed and SRD data.
- [x] **II. Content contract**: the scene seed gains loader checks on data it already carries. No
      new seed field.
- [x] **III. Data planes**: session plane only. SRD data is read as today.
- [x] **IV. Event sourcing**: no new event type. `combatant.added` carries stats in its `after`
      slice; `check.resolved` and `attack.resolved` gain optional fields. Replay reproduces state.
- [x] **V. Citations**: each derivation cites its SRD 5.2.1 record id in a code comment
      (`playing-the-game.d20-tests.*`, the condition records).
- [x] **VI. 5e engine boundary**: modifiers, DCs, roll modes and spell numbers are computed in the
      engine and covered by scripted-dice tests. This card removes the last model-written numbers
      from check and attack steps.
- [x] **VII. Structured first**: tier, attack name and circumstance are typed fields.
- [x] **VIII. Operator-owned content**: no book text. SRD data is CC-BY and already shipped.
- [x] **IX. Self-hostable**: no service, purpose or dependency.

**Stack conformance**: no departure. **Complexity Tracking**: none.

## Research

- **R1 — Where derivation lives.** In the engine. Constitution VI says the engine owns every number,
  and spec 070 already computes margin and band there. The engine holds no stats today; it gains
  them on the combatant (state), so a derived roll is `(state, command, rng)` like every other
  command and a human DM's paused proposal resolves the same way. The DM runtime only builds the
  stats once, at `combatant.add`. Rejected: deriving in resolve and sending an expression. It keeps
  the numbers outside the engine and gives the plan gate and the engine two copies of the rule.
- **R2 — Stats sources.** Seed `identity` (`apps/server/src/dm/seed/schema.ts`) carries
  `abilityMods` (all six for every shipped PC), `proficiencyBonus`, `saves` and `skills` as totals,
  and `attacks` as `{name, expression "1d20+N", damage[{dice, damageType}]}`. SRD monsters
  (`packages/srd/src/schema/monster.ts`) carry `abilities.<a>.{mod, save}`, `pb`, `skills` as
  title-case totals, and `actions[].attack.{type, bonus, hit[]}`. Across all 331 SRD monsters,
  skill and save totals equal mod + k × pb except two Stealth totals (giant-frog, shambling-mound);
  storing totals, not proficiency flags, derives both exactly.
- **R3 — Seed attack ranges.** Seed attacks carry no range. Every shipped seed attack name is an
  SRD weapon by name (Longsword, Light crossbow, Mace, Shortbow, Shortsword;
  `getByName("equipment", name)`, which lowercases through `normalizeName`), whose `rangeType` gives the range. A thrown melee weapon keeps
  `melee`. The loader refuses a seed attack that is no SRD weapon (spec FR-011); a homebrew attack
  needs a seed field later (TASK-0058).
- **R4 — Spellcasting ability.** The SRD class record has `spellcastingAbility` (cleric `wis`). The
  seed `identity.class` is the class name. Monsters get null (their spellcasting is per-feature,
  OQ-7). TASK-0105 reads `spellSaveDc` and `spellAttackBonus`; this card only exports and tests them
  (Odo: Wis +3, PB +2 → DC 13, attack +5).
- **R5 — SRD condition rules** (records in `packages/srd/data/condition.json`). Checks: poisoned and
  frightened give disadvantage on ability checks. Saves: restrained gives disadvantage on Dexterity
  saves. Attacker: blinded, frightened, poisoned, prone and restrained give disadvantage; invisible
  gives advantage. Target: blinded, paralyzed, petrified, restrained, stunned and unconscious give
  advantage; invisible gives disadvantage; prone gives advantage to a melee entry and disadvantage
  to a ranged one. Exhaustion: each level is −2 to every d20 test. Fold by
  `playing-the-game.d20-tests.advantage-disadvantage.they-dont-stack`: any advantage and any
  disadvantage give normal. Not derived (spec OQ-2, OQ-6): automatic save failures, automatic
  critical hits, grappled, frightened's line of sight, blinded's "requires sight" auto-fail.
- **R6 — The reaction path (spec 079, merged).** `reactions.ts` `meleeAttackOf(monster)` turns the
  first SRD melee action into `1d20±bonus` and damage components, skipping parts with a
  `condition`. This plan moves that conversion into `statsFromSrd` (one SRD-to-entry rule), adds the
  engine helper `firstMeleeAttack(stats)`, and makes the reaction submit `attack: <entry name>`. Its
  numbers are unchanged for every SRD monster (`reactions.test.ts` keeps its goblin assertions).
- **R7 — Explicit-number callers.** `packages/session-model/src/fixtures/recipes.ts`,
  `dm-approvals.ts`, `proposal-examples.ts` and their tests send `check.roll` with `expression` and
  `dc`, and `attack.roll` with `expression`. Keeping both fields valid (optional, with an
  exactly-one rule) leaves them and every recorded row unchanged. No model-facing step reaches
  them.
- **R8 — Command schema shape.** `nodes/schemas.ts` reads `ability` and `skill` from the
  `check.roll` option's `.shape`, so the option stays a plain `z.object`. The exactly-one rules run
  in the handlers (`INVALID_COMMAND`), not as a `superRefine` on the option. New command fields are
  `.optional()`, not `.default()`: spec 070's deviations record that a default breaks the typed
  literal commands in session-model recipes.
- **R9 — Script migration.** 21 JSON files carry check or attack steps (list below). Attack to-hits
  in every script already equal the derived to-hit (Tamsin Longsword +5, Odo Mace +3, Kestrel
  Shortbow and Shortsword +5, goblin-warrior Scimitar +4, goblin-minion Dagger +4), and every
  scripted damage expression equals the entry's damage. Checks differ:

  | Check (combatant, ability, skill) | Old expressions in scripts | Derived | Old DCs |
  |---|---|---|---|
  | tamsin wis perception | `1d20` | `1d20+3` | 12, 13 |
  | tamsin int investigation | `1d20` | `1d20` | 13 |
  | tamsin cha persuasion | `1d20`, `1d20-1` | `1d20-1` | 12, 13 |
  | tamsin dex sleight-of-hand | `1d20` | `1d20+2` | 12 |
  | tamsin str athletics | `1d20+4` | `1d20+5` | 12 |
  | kestrel dex stealth | `1d20`, `1d20+5` | `1d20+5` | 12, 13 |
  | odo dex stealth | `1d20` | `1d20` | 12 |
  | odo cha persuasion | `1d20+2` | `1d20+3` | 12 |

  Tier DCs are 5, 10, 15 and so on, so no old DC of 12 or 13 survives. Each migrated check picks the
  tier that keeps the scripted outcome and spec 070 band. Where no tier does, the scripted die
  changes. Any test asserting a dice line or a DC changes with it.

  Re-checked at T001 against the scripts after specs 070, 080 and 081 merged: the same 21 files,
  and each row above holds. Those specs added stakes, `onCost`, `onSevere`, `newRisk` and
  `reveals` to each check and changed no expression, DC or mode. Ledger fixtures with `dc` on
  `check.resolved` rows (`stakes-capture-*`, `claw-marks-*`, `playtest/fixtures/doctored/`) are
  engine rows and are not migrated.
- **R10 — Dice-count shifts.** A derived mode can draw a second d20 where the script drew one. Every
  attack on a downed PC (lifeState `unconscious` carries the `unconscious` condition,
  `hit-points.ts`) and every attack by or on a prone, restrained or poisoned combatant now rolls with
  a mode. The migration lists each such roll and inserts the extra scripted die. This is the main
  source of migration effort. At T001 the scripts' only condition effects are Pell's `restrained`
  removal (`free-pell.json`, `runbook-a-reed-camp.json`) and Tamsin's `prone`
  (`human-dm-roll-chain.json`, with no later attack on her); the downed-PC attacks remain the
  likely shifts.
- **R11 — `downed-seat.json`.** Its Snag attack drops Tamsin (13 HP) with a fixed 13 damage in
  `onHit`, which the attack step no longer allows. The migrated script scripts a natural 20: the
  critical Scimitar deals `2d6+2`, and dice 6 and 5 give 13.
- **R12 — Paused plans (OQ-5).** `findResumedPlans` (`resume.ts`) returns a checkpointed reading
  typed as `InterpretReading` without parsing it. A pre-card checkpoint holds old-shape steps that
  would reach resolve with `undefined` fields. The plan re-parses each resumed reading and ruling
  with the step schemas and drops a plan that fails, so the action is interpreted again.
- **R13 — Plan gate inputs.** `checkPlan` sees S0 (`ActorSnapshot`), which carries no stats. It
  gains the engine combatants (`assembled.projections.engine.combatants`). Joining combatants (the
  Director's opening adds them this turn) are skipped, as their ids are today.
- **R14 — Prompt versions.** On main at T001: interpret-v10, adjudicate-v7, narrate-v13, audit-v9.
  This card bumps interpret to v11 and adjudicate to v8. Narrate and audit are not touched.

## Design

### D1 — Engine stats (`packages/dnd5e-engine/src/schema/state.ts`)

```ts
export const SKILL_ABILITY: Record<Skill, Ability> = { athletics: "str", acrobatics: "dex", ... };
// SRD 5.2.1 playing-the-game.proficiency.skill-proficiencies (Skills table). One table.
export const AmountSchema = /* moved here from commands.ts, unchanged */;
export const AttackEntrySchema = z.object({
  name: z.string().min(1).max(60),
  range: z.enum(["melee", "ranged", "melee-or-ranged"]),
  toHit: z.number().int().min(-5).max(30),
  damage: z.array(z.object({ amount: AmountSchema, damageType: DamageTypeSchema })).max(4),
});
export const CombatantStatsSchema = z.object({
  abilityMods: z.partialRecord(AbilitySchema, z.number().int().min(-5).max(10)),
  proficiencyBonus: z.number().int().min(0).max(9),
  saves: z.partialRecord(AbilitySchema, z.number().int().min(-5).max(20)),
  skills: z.partialRecord(SkillSchema, z.number().int().min(-5).max(20)),
  attacks: z.array(AttackEntrySchema).max(12),
  spellcastingAbility: AbilitySchema.nullable(),
});
// CombatantSchema gains   stats: CombatantStatsSchema.optional()
// combatant.add CombatantInit gains   stats: CombatantStatsSchema.optional()
```

`AbilitySchema` moves to `state.ts`; `commands.ts` and `events.ts` import it instead of their two
local copies. `handleCombatantAdd` copies `init.stats` when present. Old rows parse with no stats.

### D2 — Derivation (new `packages/dnd5e-engine/src/derive.ts`, pure, exported)

```ts
export const DifficultySchema = z.enum(["very-easy","easy","medium","hard","very-hard","nearly-impossible"]);
export const DIFFICULTY_DC: Record<Difficulty, number> = { "very-easy": 5, easy: 10, medium: 15,
  hard: 20, "very-hard": 25, "nearly-impossible": 30 };   // SRD p.6 Typical Difficulty Classes
type Derived<T> = { ok: true; value: T } | { ok: false; missing: string };
export function checkModifier(c: Combatant, kind, ability, skill): Derived<number>;
  // ability-check: abilityMods[ability] + (skills[skill] − abilityMods[SKILL_ABILITY[skill]] if listed, else 0)
  // saving-throw: saves[ability] ?? abilityMods[ability]
  // both: − 2 × exhaustion level. Missing stats or ability modifier → { ok: false }.
export function findAttack(c: Combatant, name: string): Derived<AttackEntry>;   // case-insensitive
export function firstMeleeAttack(stats: CombatantStats): AttackEntry | null;   // melee or melee-or-ranged
export function checkModeSources(c, kind, ability): ("advantage"|"disadvantage")[];
export function attackModeSources(attacker, target, entry): ("advantage"|"disadvantage")[];
export function foldMode(base: RollMode, sources): RollMode;   // they-don't-stack rule
export function d20Expression(modifier: number): string;      // "1d20", "1d20+5", "1d20-1"
export function spellSaveDc(stats): number | null;            // 8 + mod + PB; null without an ability
export function spellAttackBonus(stats): number | null;       // mod + PB
```

Frightened, prone-by-range and the 5-foot proxy carry `ponytail:` comments (OQ-6).

### D3 — Commands, events and refusals

`check.roll`: `expression` and `dc` become `.optional()`; add `difficulty: DifficultySchema.optional()`.
`attack.roll`: `expression` becomes `.optional()`; add `attack: z.string().min(1).max(60).optional()`.
Refusal enum gains `STAT_UNDEFINED`. `check.resolved` gains `difficulty: DifficultySchema.optional()`;
`attack.resolved` gains `attack: z.string().optional()`.

`handleCheckRoll` order, before any draw (merged spec 070 order, with derivation in the
expression parse's slot):
1. Exactly one of `difficulty` and `dc`, else `INVALID_COMMAND`. DC = `DIFFICULTY_DC[difficulty]`
   or `dc`.
2. With `expression`: parse it and require a plain d20, as today. Its roll uses `command.mode`
   (no condition folding).
3. Existing named and unable checks.
4. Without `expression`: `combatantId` null → `1d20` at `command.mode`. Else `checkModifier`;
   `{ok:false}` → `STAT_UNDEFINED` with `{ combatantId, missing }`. The roll is
   `d20Expression(mod)` at `foldMode(command.mode, checkModeSources(...))`.
5. Spec 070's `check.resolved` base (now with the resolved DC and `difficulty`), the
   `autoFail`+`autoSuccess` refusal, the auto paths, the roll, and `bandOf({ total, dc, natural,
   kind, houseRules })` follow unchanged.

`handleAttackRoll`: exactly one of `attack` and `expression`, else `INVALID_COMMAND`. With `attack`:
`attackerId` non-null (else `INVALID_COMMAND`), `findAttack` (else `STAT_UNDEFINED`), roll
`d20Expression(entry.toHit − 2 × exhaustion)` at `foldMode(command.mode, attackModeSources(...))`.
AC stays `targetAc ?? target.ac`. Spec 079's reaction checks are unchanged.

### D4 — Stats builders (`apps/server/src/dm/seed/combatants.ts`)

- `statsFromSrd(monster)`: `abilityMods` and `saves` from `abilities`, `proficiencyBonus` from `pb`,
  `skills` mapped from title case to kebab keys (unknown names skipped), `attacks` from every action
  with an `attack` (the R6 rule: parts with a `condition` skipped; dice lose spaces; no dice → fixed
  `average`), `spellcastingAbility: null`. `combatantFromSrd` sets `stats`.
- `statsFromCharacter(character, srd)`: `abilityMods`, `proficiencyBonus`, `saves`, `skills` copied;
  each attack's `toHit` parsed from `1d20±N`, `range` from the SRD weapon's `rangeType`, damage dice
  to `{kind:"roll"}` amounts; `spellcastingAbility` from the SRD class record or null.
- Resolve's PC `combatant.add` (scene start) sends `{ ...init, stats: statsFromCharacter(c, srd) }`.
  Its two SRD paths (encounter start, pull-in) get stats through `combatantFromSrd`.
- `seed/load.ts` adds three issues (FR-011): an attack expression not `1d20±N`, an attack name that
  is no SRD weapon, an `identity.combatant` with `stats`.

### D5 — Reaction reuse (`apps/server/src/dm/reactions.ts`, `nodes/resolve.ts` `case "move"`)

`meleeAttackOf` is deleted; its rule lives in `statsFromSrd`. `case "move"` reads the reactor's
`stats` from the fresh projections, takes `firstMeleeAttack(stats)` (null → the existing
`dm.reaction.skipped` log), submits `attack.roll` with `attack: entry.name` and no expression, and
applies `entry.damage` through the shared hit-damage helper (D7). `reactors()` is unchanged.

### D6 — Step contract (`apps/server/src/dm/nodes/schemas.ts`)

```ts
export const DifficultySchema = /* the engine's, imported */;
const Circumstance = z.object({ mode: z.enum(["advantage","disadvantage"]), reason: Reason })
  .nullable().default(null);
// check step: z.strictObject; removes expression, dc, mode; adds
//   difficulty: DifficultySchema, circumstance: Circumstance
//   (spec 070 and 0170 fields unchanged)
// attack step: z.strictObject; removes expression, targetAc, mode; attackerId non-null; adds
//   attack: z.string().min(1).max(60), circumstance: Circumstance,
//   onHit: z.array(EffectSchema).max(4)   (min 1 dropped)
// spec 080's reveals, stakes (success required), onCost, onSevere, newRisk stay as merged.
```

The `onHit` damage refusal joins spec 070's shared `requireAbilityStakes(steps, ctx, base)`
helper (renamed `refineSteps`), so `InterpretReadingSchema` and `AdjudicateModelOutput` both
enforce it. The discriminated-union options stay plain strict objects.

`Step` type follows. `first-stage.ts` compares kind, ability and skill only, so it needs no change.

### D7 — Resolve (`apps/server/src/dm/nodes/resolve.ts`)

- `case "check"`: submit `{ type: "check.roll", combatantId, kind, ability, skill, difficulty, mode:
  circumstance?.mode ?? "normal", autoFail, houseRules, autoSuccess }`. No expression, no DC. Keep
  as merged: `houseRules` from `seed.tableRules`, `autoSuccess` from `isFreeRetry(step,
  fresh.ledger)`, `step.stakes` as `run.mech`'s fifth argument, the spec 080 `sub.reveals` /
  `sub.revealedText` / `dm.reveals.unknown` block, and `effectsForBand(step, sub.band ??
  sub.outcome)`.
- `case "attack"`: submit `{ type: "attack.roll", attackerId, targetId, attack: step.attack, mode:
  circumstance?.mode ?? "normal", targetAc: null }`. On `hit` or `critical-hit`, read the attacker's
  entry (fresh projections, `findAttack`) and submit `damage.apply` at key `${key}:dmg` with its
  components and `critical`, then run `onHit` as today. A new `hitDamage(entry, targetId, critical)`
  helper builds that command for both this case and D5.
- `presenceTargets` and the reclaim key scheme are unchanged; `${key}:dmg` is new and stable.

### D8 — Plan gate (`apps/server/src/dm/gates/plan-gate.ts`)

`PlanInput` gains `combatants: Readonly<Record<string, Combatant>>`. After the id walk, for each
check with a non-null combatant and each attack, skipping joining ids: `checkModifier` or
`findAttack` → `{ok:false}` refuses the group with code `STAT_UNDEFINED` and a `PlanFailure`
(`field` `ability`, `skill` or `attack`; `reason: "stat-undefined"`). `stepTexts` adds
`circumstance.reason` when non-null, beside spec 070's `stakeTexts`. `stepIds`'s `attack` case
drops its null-`attackerId` guard (dead after FR-014). `STAT_UNDEFINED` is an engine code, so the coverage meta-test
needs no `PLAN_GATE_ONLY` entry. Resolve passes `assembled.projections.engine.combatants`.

### D9 — Prompts

- `prompts/step-grammar.ts`: the check and attack lines show the D6 shapes. The tier line renders
  `DifficultySchema.options` with each DC. The modifier sentence becomes: "Name the ability, skill,
  difficulty and attack only. The engine derives every modifier, DC, AC and damage from the
  combatant's stats, and advantage or disadvantage from conditions. Add a circumstance only for a
  source no condition states." A damage effect is no longer listed for `onHit`.
- `prompts/interpret.ts`: `EXAMPLE_OUTPUT`'s check uses `difficulty: "medium"`, `circumstance: null`.
  `OUTPUT_SHAPE` keeps its other rules. Version bumps one past `main`.
- `prompts/adjudicate.ts`: version bump only (it renders the grammar).

### D10 — Resume (`apps/server/src/dm/resume.ts`)

`findResumedPlans` parses the found reading with `InterpretReadingSchema` and the ruling's steps
with `StepSchema`. A failure skips the plan (OQ-5 (a)).

## Files the build touches

Every path below is the full list. A build that needs another file stops and amends this list.

**Phase 1 — Engine derivation**
- `packages/dnd5e-engine/src/schema/state.ts`
- `packages/dnd5e-engine/src/schema/commands.ts`
- `packages/dnd5e-engine/src/schema/events.ts`
- `packages/dnd5e-engine/src/schema/refusals.ts`
- `packages/dnd5e-engine/src/derive.ts` (new)
- `packages/dnd5e-engine/src/commands/attacks.ts`
- `packages/dnd5e-engine/src/commands/combatants.ts`
- `packages/dnd5e-engine/src/index.ts`
- `packages/dnd5e-engine/README.md`
- `packages/dnd5e-engine/test/derive.test.ts` (new)
- `packages/dnd5e-engine/test/commands/attacks.test.ts`
- `packages/dnd5e-engine/test/commands/combatants.test.ts`
- `specs/026-dnd5e-engine/contracts/commands.md`, `events.md`, `refusals.md`, `engine-api.md`
  (each amendment marked "Amended by specs/082-engine-derived-numbers")

**Phase 2 — Stats on combatants and the reaction path**
- `apps/server/src/dm/seed/combatants.ts`
- `apps/server/src/dm/seed/load.ts`
- `apps/server/src/dm/reactions.ts`
- `apps/server/src/dm/nodes/resolve.ts` (PC `combatant.add`; `case "move"`; `hitDamage`)
- `apps/server/test/dm/seed-stats.test.ts` (new)
- `apps/server/test/dm/seed.test.ts`
- `apps/server/test/dm/reactions.test.ts`
- `apps/server/test/dm/opportunity-attack.integration.test.ts`
- `specs/031-dm-runtime/contracts/scene-seed.md` (stats from seed and SRD; loader checks)

**Phase 3 — Step contract, prompts, resolve and plan gate**
- `apps/server/src/dm/nodes/schemas.ts`
- `apps/server/src/dm/prompts/step-grammar.ts`
- `apps/server/src/dm/prompts/interpret.ts`
- `apps/server/src/dm/prompts/adjudicate.ts`
- `apps/server/src/dm/nodes/resolve.ts` (`case "check"`, `case "attack"`, `checkPlan` input)
- `apps/server/src/dm/gates/plan-gate.ts`
- `apps/server/src/dm/resume.ts`
- `apps/server/test/dm/world.ts` (`checkStep()`, `attackStep()`)
- `apps/server/test/dm/plan-reason-fixtures.ts`
- `apps/server/test/dm/interpret.test.ts`
- `apps/server/test/dm/interpret-prompt.test.ts`
- `apps/server/test/dm/plan-gate.test.ts`
- `apps/server/test/dm/first-stage.test.ts`
- `apps/server/test/dm/adjudicate.integration.test.ts`, `beat.integration.test.ts` (hand-built
  check steps)
- `apps/server/test/dm/interpret-capture.test.ts`, `stakes.test.ts` (edit only if red)
- `apps/server/test/dm/rules-terms.test.ts`
- `apps/server/test/dm/presence-effect.test.ts`
- `apps/server/test/dm/runner.test.ts`
- `apps/server/test/dm/resume.test.ts`
- `specs/031-dm-runtime/contracts/nodes.md` (check and attack steps)
- `specs/031-dm-runtime/contracts/resolve.md` (derived submissions, hit damage, reaction)
- `specs/058-roll-reason-plan-gate/contracts/plan-reason-gate.md` (`circumstance.reason` text;
  `STAT_UNDEFINED` rule)

**Phase 4 — Scripts, fixtures and integration tests**
- `apps/server/dm-scripts/greyhollow-human-dm.json`, `greyhollow-live.json`,
  `greyhollow-plan-approach.json`, `runbook-a-reed-camp.json`
- `apps/server/test/dm/scripts/approach-reed-camp.json`, `audit-advisory.json`,
  `audit-fallback.json`, `audit-regenerate.json`, `encounter-end-bargain.json`,
  `exploration-check.json`, `fight-round.json`, `free-pell.json`, `greyhollow-ford-full.json`,
  `human-dm-approval.json`, `human-dm-roll-chain.json`, `plan-approach.json`, `reveal-snag.json`,
  `shoot-snag.json`, `social-adjudicated.json`, `turn-floor-round.json`
- `apps/server/test/playtest/fixtures/downed-seat.json`
- Integration tests whose assertions read a migrated dice line, DC or die count, as found:
  `apps/server/test/dm/resolve.integration.test.ts`, `adjudicate.integration.test.ts`,
  `beat.integration.test.ts`, `scene.integration.test.ts`, `audit.integration.test.ts`,
  `clarify-keeps-turn.integration.test.ts`, `no-undeclared-method.integration.test.ts`,
  `noncombatant-targets.integration.test.ts`, `resolve.human-seat.integration.test.ts`,
  `human-dm-roll-resume.integration.test.ts`, `encounter-end-resolves.integration.test.ts`,
  `attack-anyone.integration.test.ts`, `revealed-npc.integration.test.ts`,
  `turn-floor-round.integration.test.ts`, `apps/server/test/playtest/harness.integration.test.ts`
- `apps/server/test/dm/derived-numbers.integration.test.ts` (new; US1–US3 end to end)
- `specs/082-engine-derived-numbers/deviations.md` (new; per-script tier and dice changes)

**Phase 5 — Re-ground**
- `docs/wiki/dnd5e-engine.md`, `dm-runtime.md`, `dm-failure-and-gates.md`, `srd-data.md`
- Re-pins of every other note listing a touched source: expected `seed-npc-presence.md`,
  `dm-turn-jobs.md`, `party-panel.md`, `turn-floor.md`, `output-claim-gate.md`,
  `dm-talk-triggers.md`
- `docs/wiki/CAPSULES.md`, `docs/wiki/INDEX.md`
- the runbook B file that dispatches this build (execution-log row)

**Not touched**: `packages/session-model/` (explicit commands stay valid, R7), `packages/srd/`
(read only), `apps/server/seeds/` (stats come from existing fields), `facts.ts`, `fallback.ts`,
`prompts/narrate.ts`, `prompts/audit.ts` (they read ledger rows, whose shape only gains optional
fields), `first-stage.ts`, `snapshot/` (the sheet render already shows attack names),
`apps/web/` (`check.resolved` keeps `dc`), every frozen contract.

**Migrations**: none. **New runtime dependencies**: none.

## What TASK-0105 and TASK-0128 build on

- TASK-0105 imports `spellSaveDc` and `spellAttackBonus` from the engine and reads the caster's
  `stats.spellcastingAbility`. A spell's save is a `check.roll` with explicit `dc` (the caster's
  DC) and no expression, so the target's save modifier is still derived. A spell attack uses an
  explicit `expression` built from `spellAttackBonus`, or a later `attack.roll` field.
- TASK-0128 adds an opposition DC (for example 8 + Strength modifier + PB) as an explicit `dc`
  computed by a new engine function from the opponent's stats, beside `difficulty`.

## Overlap

- **TASK-0127 (spec 070), merged**: the check step, `handleCheckRoll`, `case "check"`,
  `stepTexts` and the fixtures. Checked at T001; D3, D6, D7 and D8 follow its merged shape. The
  band rule is untouched.
- **TASK-0170 (spec 080), merged**: `stakes.success` required, `reveals`, `facts.ts`,
  `narrate.ts`, `audit.ts`. Checked at T001; D6 keeps every field.
- **TASK-0207 (spec 081), merged**: the reading's `say`, `fallback.ts`, `narrate.ts`. No seam with
  this card.
- **TASK-0208 (spec 079, merged)**: D5 replaces `meleeAttackOf`. Its tests move to `seed-stats` and
  `reactions` with the same expected numbers.
- **TASK-0105, 0128, 0211** later edit `schemas.ts` and `resolve.ts`. Each rebases on this
  card.

## Risks

- **Strict steps.** A model that still writes `dc` or `expression` now fails the parse and costs one
  repair re-ask. The prompt bump and the example remove the old fields; watch `invalid-output` on
  the next playtest.
- **Lost class damage (OQ-1).** Sneak Attack and similar bonuses stop applying until TASK-0225
  (after TASK-0058). The standing S-sneak-attack playtest row tracks it.
- **Dice-count shifts (R10).** Condition-derived modes change how many scripted dice each roll
  draws. Phase 4 walks every script once and records each change in deviations.md.
- **Live sessions (OQ-4).** A hosted session started before deploy refuses derived rolls until a new
  scene starts.
