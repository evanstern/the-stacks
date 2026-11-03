# Implementation Plan: Spells resolve by SRD id through the engine

**Branch**: `task-0105-spells-by-srd-id` | **Date**: 2026-11-03 | **Spec**: [spec.md](spec.md)

**Input**: `specs/083-spells-by-srd-id/spec.md`, TASK-0105, runbook B
(`docs/design/m3-runbook-b-resolution-quality.md`, lane B3, spine #14, re-split R2). Written against
merged TASK-0104 (spec 082, PR #123, merged into this branch at authoring). Each open question is
planned at its default.

Research, design and contracts live in this file, as in specs 070, 079 and 082. No separate
research.md, data-model.md or quickstart.md.

## Summary

The engine gains one command, `spell.cast`, and a hand-authored spell mechanics table keyed by SRD
spell id. A cast resolves in one engine result: spend the slot, roll the spell attack or the
target's save, apply damage (half on a save where the record says so), healing or a condition.
Every number comes from the table and the stats spec 082 put on combatants. The model writes a
`spell` step that names the caster, the SRD spell id, the slot level and the target. The plan gate
refuses an unknown, unprepared or unresolvable spell before any step runs. A server test checks
each table entry clause by clause against the SRD record text. Prompts render the step; the actor
sheet lists the caster's spells.

## Technical Context

**Language/Version**: TypeScript (Node 22), as the repo.
**Primary Dependencies**: Zod, Vitest. **No new runtime dependency.**
**Storage**: Postgres event log (JSON payloads). **No migration**: `spell.cast` rides the
`mechanics` proposal like any `EngineCommand`; its events are existing types, two with one new
optional field each.
**Testing**: Vitest. Engine scripted-dice tests; pure unit tests (table-vs-record, plan gate,
schemas, prompts, snapshot render); DB integration tests with `REQUIRE_DATABASE=1` on the worktree
stack; the fake gateway. No paid run.
**Target Platform**: `packages/dnd5e-engine` and the server DM pipeline. `packages/srd` is read only.
**Constraints**: frozen contracts untouched (`docs/wiki/ws-protocol.md` frames,
`specs/029-proposal-gate/contracts/`, `specs/030-play-route/contracts/proposal-seam.md`). The engine
keeps importing only `zod` (purity test). `packages/srd` keeps importing no engine (biome rule).
**Scale/Scope**: 7 engine source files (1 new) and 2 engine tests (1 new); 7 server source files;
3 seed JSON files; 1 new server unit test, 1 new DB test, 5 edited tests; 4 engine and 3 runtime
contract files; the wiki.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable**: no human-only path. The table is code; the gate and the engine refuse
      with codes.
- [x] **II. Content contract**: the scene seed's existing `spells` list gains `cure-wounds` for
      Odo. No new seed field.
- [x] **III. Data planes**: session plane only. SRD data is read as today.
- [x] **IV. Event sourcing**: `spell.cast` emits existing event types (`spell-slots.changed`,
      `dice.rolled`, `attack.resolved`, `check.resolved`, `hp.changed`, `life-state.changed`,
      `condition.applied`, `condition.removed`). Two gain one optional field. Replay reproduces
      state.
- [x] **V. Citations**: each table entry names its SRD record id and page; the rules it uses cite
      `playing-the-game.damage-and-healing.saving-throws-and-damage.half-damage` and the class
      spellcasting rule.
- [x] **VI. 5e engine boundary**: spell attack, spell save DC, dice, half damage, healing and slot
      spending are computed in the engine and covered by scripted-dice tests. This card removes the
      last model-written spell numbers.
- [x] **VII. Structured first**: the spell step and the table are typed.
- [x] **VIII. Operator-owned content**: the table restates SRD 5.2.1 mechanics (CC-BY, already
      shipped and attributed). No book text.
- [x] **IX. Self-hostable**: no service, purpose or dependency.

**Stack conformance**: no departure. **Complexity Tracking**: none.

## Research

- **R1 — Spec 082 seams (merged, read at authoring).** `CombatantStatsSchema` carries
  `spellcastingAbility` (null for monsters, the SRD class value for PCs). `derive.ts` exports
  `spellSaveDc(stats)`, `spellAttackBonus(stats)`, `checkModifier`, `attackModeSources`,
  `checkModeSources`, `foldMode` and `d20Expression`. `attackModeSources(attacker, target, entry)`
  reads only `entry.range`. `check.roll` takes `dc` or `difficulty`; `attack.roll` takes `attack` or
  `expression`. The plan gate has `combatants`, `statGap` and `STAT_REFUSAL_CODE`. Prompt versions
  on main: interpret-v11, adjudicate-v8, narrate-v14, audit-v9.
- **R2 — The SRD spell record is prose.** `packages/srd/src/schema/spell.ts` has level, school,
  classes, casting time, range, components, concentration, duration, `text` and `higherLevels`. No
  structured mechanics. 339 records.
- **R3 — Where the table lives (spec OQ-3).** The engine must resolve from it, and the engine may
  import only `zod` (`test/purity.test.ts`). So the table lives in the engine as data keyed by SRD
  id. The server, which may import both packages, holds the test that checks each entry against its
  SRD record text. Rejected: SRD schema fields (the engine cannot read them; the converter reruns
  from Open5e); runtime prose parsing (brittle).
- **R4 — One command, not a chain.** A spell resolves as one `spell.cast`. Reasons: (1) the save DC
  and to-hit are derived inside the engine, so no number crosses the command boundary from the
  runtime; (2) the slot, roll and effects land atomically, so a refused slot never leaves a roll, and
  a human DM approves one spell, not four proposals; (3) half damage needs the save outcome and the
  damage roll in one place. The handler reuses the existing roll, damage, healing and condition
  rules by extracting their event builders, not by calling `execute` recursively.
- **R5 — First table entries** (SRD 5.2.1 page in brackets). Each is single-target, instantaneous,
  no concentration, no repeat save, no roll rider:

  | Id | Lvl | Delivery | Effect | Scaling |
  |---|---|---|---|---|
  | `fire-bolt` [132] | 0 | ranged spell attack | 1d10 fire | cantrip d10 |
  | `sacred-flame` [159] | 0 | Dex save, none on success | 1d8 radiant | cantrip d8 |
  | `inflict-wounds` [143] | 1 | Con save, half on success | 2d10 necrotic | +1d10 per slot level |
  | `ray-of-sickness` [158] | 1 | ranged spell attack | 2d8 poison; poisoned to the end of the caster's next turn | +1d8 per slot level |
  | `cure-wounds` [121] | 1 | automatic | heal 2d8 + spellcasting mod | +2d8 per slot level |
  | `healing-word` [139] | 1 | automatic | heal 2d4 + spellcasting mod | +2d4 per slot level |

  Sacred Flame's "no benefit from cover" has no engine effect (no cover modelled). Ray of
  Sickness gives the condition on the attack's hit, as the text says. Excluded with reasons (spec
  OQ-2): `bless`, `guidance` (concentration, roll rider); `burning-hands`, `color-spray`,
  `magic-missile` (area or several targets); `hold-person`, `sleep` (repeat save, concentration);
  `guiding-bolt`, `shocking-grasp`, `ray-of-frost`, `starry-wisp` (roll or movement rider);
  `command`, `charm-person` (no engine effect for the outcome).
- **R6 — Slot spending (spec OQ-1 (a)).** `spell-slots.ts` holds `slotOf` and `preflight` privately.
  Exporting a `slotExpendEvent(state, casterId, level, reason)` builder lets `spell.cast` reuse the
  exact rules and refusals. Pool: `standard` when the caster has a standard slot of the level, else
  `pact` when its pact slot has that level. The seed already gives Odo `standard: { "1": 2 }`.
- **R7 — Turn-bound expiry.** `ExpiryPointSchema` is `{round, combatantId, boundary}`; `encounter.ts`
  removes matching conditions at each turn boundary. "The end of your next turn": if the caster is
  the active combatant, the point is `{round + 1, caster, turn-end}`; otherwise `{round, caster,
  turn-end}` when the caster's turn is still ahead in this round, else `round + 1`. Outside an
  encounter there is no point; the condition is skipped (spec OQ-4) and the damage still lands.
- **R8 — Half damage.** `adjust()` in `hit-points.ts` halves for resistance after the raw roll. The
  SRD half-damage rule halves the damage that would be dealt (rounded down) before defenses. The
  damage builder gains a `half` option: `raw = floor(rolled / 2)` per component, then defenses as
  today. `hp.changed` gains optional `half: true`.
- **R9 — Cantrip scaling.** The record's `higherLevels` names levels 5, 11 and 17. The engine needs
  the caster's character level; the engine combatant has none. `spell.cast` carries `casterLevel`
  (1–20), set by resolve from the seed character's `identity.level` (1 for a non-PC caster). Dice
  count = base × (1 + [≥5] + [≥11] + [≥17]).
- **R10 — Spell list and slot level (spec OQ-5).** The seed `identity.spells` list is checked by the
  loader against the SRD today (`seed/load.ts`). The plan gate reads it from the seed for the
  caster's character; a caster with no seed character has no list. Odo's list is
  `sacred-flame, guidance, healing-word, bless`; this card adds `cure-wounds` to the four shipped
  greyhollow seeds that list Odo.
- **R11 — Refusal codes.** New engine codes: `SPELL_UNRESOLVED` (no table entry, or an invalid slot
  level); the engine asserts it by test. New plan-gate-only codes: `SPELL_UNKNOWN` (no SRD record),
  `SPELL_NOT_PREPARED` (not on the seed list). Both join the enum and `PLAN_GATE_ONLY` in
  `coverage.test.ts`, like `STEP_ACTOR_MISMATCH`. The gate reuses `STAT_UNDEFINED`.
- **R12 — Facts and narration.** `facts.ts` links an outcome row to its roll by
  `batchId` + `rollIndex`, and reads `hp.changed` and condition rows as changes. A `spell.cast`
  batch holds the same rows a check or attack plus `damage.apply` produce, in one batch, so
  rolls, outcomes and changes are found as today. The spell attack's dice row shows
  `purpose: "attack"`, the save `purpose: "save"`. Narrate and audit are not touched. A test in
  Phase 2 pins the fallback's sentences for one cast of each delivery.
- **R13 — The DM seat.** `spell.cast` is a `mechanics` proposal like `attack.roll`. The policy table
  routes `mechanics` by kind, not by command type, so no gate change is needed.

## Design

### D1 — Spell table (`packages/dnd5e-engine/src/spells.ts`, new, pure)

```ts
const DiceSchema = z.string().regex(/^\d+d\d+$/);
export const SpellMechanicsSchema = z.strictObject({
  id: z.string(), level: z.number().int().min(0).max(9),
  srdPage: z.number().int(),                       // SRD 5.2.1 page, for the citation
  delivery: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("attack"), range: z.enum(["melee", "ranged"]) }),
    z.strictObject({ kind: z.literal("save"), ability: AbilitySchema,
                     onSuccess: z.enum(["none", "half"]) }),
    z.strictObject({ kind: z.literal("auto") }),
  ]),
  damage: z.array(z.strictObject({ dice: DiceSchema, damageType: DamageTypeSchema })).max(2),
  healing: z.strictObject({ dice: DiceSchema, addModifier: z.boolean() }).nullable(),
  condition: z.strictObject({ key: ConditionKeySchema,
                              ends: z.literal("caster-next-turn-end") }).nullable(),
  scaling: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("cantrip"), die: DiceSchema }),   // "1d10"
    z.strictObject({ kind: z.literal("slot"), die: DiceSchema }),      // per level above
    z.strictObject({ kind: z.literal("none") }),
  ]),
});
export const SPELLS: Readonly<Record<string, SpellMechanics>>;   // R5's six entries, parsed at load
export function spellDice(m, slotLevel: number | null, casterLevel: number): { damage, healing };
```

An entry with neither damage, healing nor condition is refused at load (a test asserts it).

### D2 — Command, events and refusals (`schema/commands.ts`, `events.ts`, `refusals.ts`)

```ts
z.object({
  type: z.literal("spell.cast"),
  casterId: Id, spellId: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  targetId: Id, slotLevel: SlotLevel.nullable(), casterLevel: z.number().int().min(1).max(20),
  houseRules: z.object({ outcomeBands: z.boolean(), naturals: z.boolean() }).optional(),
  reason: Reason,
})
```

`attack.resolved` gains `spellId: z.string().optional()`; `check.resolved` gains `spellId: z.string().optional()`;
`hp.changed` gains `half: z.literal(true).optional()`. Refusal enum gains `SPELL_UNRESOLVED`,
`SPELL_UNKNOWN`, `SPELL_NOT_PREPARED`.

### D3 — Handler (`packages/dnd5e-engine/src/commands/spells.ts`, new)

`handleSpellCast` order, every refusal before any draw:

1. `SPELLS[spellId]` missing → `SPELL_UNRESOLVED` `{spellId, reason: "no-mechanics"}`. A cantrip
   with a slot level, or a leveled spell with a slot level below its level →
   `SPELL_UNRESOLVED` `{reason: "slot-level"}`.
2. `checkNamed([targetId, casterId])`, `actorUnable(caster)`, `TARGET_DEAD` on the target.
3. Caster `stats` with a spellcasting ability modifier, else `STAT_UNDEFINED`. A save spell's
   target needs a derivable save (`checkModifier`), else `STAT_UNDEFINED`.
4. Leveled: `slotExpendEvent` (R6) or its refusal (`SLOT_LEVEL_UNAVAILABLE`, `NO_SLOT_AVAILABLE`).
5. Dice preflight (doubled limits for an attack's damage).

Then:

- **attack**: roll `d20Expression(spellAttackBonus − exhaustion)` at
  `foldMode("normal", attackModeSources(caster, target, {range}))`; `attack.resolved` with `ac`
  from the target, `spellId`. On `hit`/`critical-hit`: damage events (critical doubles dice), then
  the condition (R7).
- **save**: roll the target's derived save (`checkModifier(target, "saving-throw", ability, null)`
  at `foldMode("normal", checkModeSources(...))`) against `spellSaveDc`; `check.resolved` with `dc`,
  `spellId`, band by `bandOf` (saves have no bands, as today). On failure: full damage, then the
  condition. On success: half damage (`onSuccess: "half"`) or none.
- **auto**: healing events with `dice` + modifier (`addModifier`), through the healing builder
  (a downed target wakes via `leaveZero`).

Event builders: `hit-points.ts` exports `damageEvents(target, components, {critical, half, reason},
rng, events)` and `healingEvents(...)`, extracted from `handleDamageApply` and `handleHealingApply`
with no behaviour change; `conditions.ts` exports `appliedEvent`; `spell-slots.ts` exports
`slotExpendEvent`; `attacks.ts` exports `checkNamed` and `actorUnable`. `execute.ts` registers the
handler. `derive.ts` gains `spellcastingModifier(stats)`, used by both spell functions.

Each new rule cites its SRD record in a comment. The OQ-4 skip carries a `ponytail:` comment.

### D4 — Step contract (`apps/server/src/dm/nodes/schemas.ts`)

```ts
z.strictObject({
  step: z.literal("spell"),
  reason: Reason,
  casterId: CombatantIdSchema,
  spellId: RecordId,                     // @the-stacks/srd's id grammar
  slotLevel: z.number().int().min(1).max(9).nullable(),
  targetId: CombatantIdSchema,
})
```

`first-stage.ts` needs no change (a spell is not a check).

### D5 — Resolve (`apps/server/src/dm/nodes/resolve.ts`)

`case "spell"`: submit `{ type: "spell.cast", casterId, spellId, targetId, slotLevel, casterLevel,
houseRules }` with `casterLevel` from the seed character whose `identity.combatant.id` is the
caster (else 1). `take(sub)` as an attack. No effects run after it: the engine applied them.
`stepIds`-style walks in resolve (`presenceTargets`) gain no case (a spell carries no presence
effect).

### D6 — Plan gate (`apps/server/src/dm/gates/plan-gate.ts`)

- `PlanInput` gains `spellLists: ReadonlyMap<string, readonly string[]>` (combatant id → seed
  spell ids) and `srdSpell: (id) => { level: number } | undefined`. Resolve builds both from the
  seed and `deps.srd`.
- `stepIds`: `spell` names `casterId` and `targetId` (pull-in as for an attack).
- `foreignActor`: `spell`'s `casterId` is checked like an attacker.
- `stepTexts`: the spell's `reason`.
- New `spellGap(steps, ...)`, after `statGap`: `SPELL_UNKNOWN` (no SRD record), `SPELL_NOT_PREPARED`
  (caster not in `spellLists`, or the id not on its list), `SPELL_UNRESOLVED` (no `SPELLS` entry,
  or the slot-level rule of D3 step 1), `STAT_UNDEFINED` (no caster spellcasting modifier; a save
  spell's target with no derivable save). Joining ids are skipped as in `statGap`. A group whose
  reading has intent `spell` and holds no spell step is refused `SPELL_UNRESOLVED` (field
  `intent`), unless it is a clarify. This is the "refused, not improvised" rule of card AC #3: a
  spell rebuilt from check, attack or effect steps never runs.
- `PlanVerdict` gains the three spell codes on the `PlanFailure` arm. `PlanFailureReason` gains
  `"spell-unknown" | "spell-not-prepared" | "spell-unresolved"`.
- `askUndeclared` treats a spell like an attack for another human's PC.

### D7 — Prompts and snapshot

- `prompts/step-grammar.ts`: the spell line of spec US5, and the rule sentence: "Name the caster,
  the SRD spell id from the caster's spell list, the slot level (null for a cantrip) and one target.
  The engine resolves the spell's attack or save, DC, damage, healing and conditions from the SRD
  record and the caster's stats. A spell the engine cannot resolve is refused; never rebuild it from
  check, attack or effect steps."
- `prompts/interpret.ts` and `prompts/adjudicate.ts`: version one past `main` (interpret-v12,
  adjudicate-v9 at authoring).
- `snapshot/render.ts` `sheetText`: append ` spells ${spells.join(",")}` when non-empty (the sheet
  already carries `spells`; the line does not render them today).

### D8 — Seeds

Add `"cure-wounds"` to Odo's `identity.spells` in `greyhollow-ford.json`, `-duo`, `-trio` and
`-reed-camp`.

## Files the build touches

Every path below is the full list. A build that needs another file stops and amends this list.

**Phase 1 — Engine spell resolution**
- `packages/dnd5e-engine/src/spells.ts` (new)
- `packages/dnd5e-engine/src/commands/spells.ts` (new)
- `packages/dnd5e-engine/src/commands/hit-points.ts` (extract `damageEvents`, `healingEvents`; `half`)
- `packages/dnd5e-engine/src/commands/spell-slots.ts` (export `slotExpendEvent`)
- `packages/dnd5e-engine/src/commands/conditions.ts` (export `appliedEvent`)
- `packages/dnd5e-engine/src/commands/attacks.ts` (export `checkNamed`, `actorUnable`)
- `packages/dnd5e-engine/src/derive.ts` (`spellcastingModifier`)
- `packages/dnd5e-engine/src/schema/commands.ts`
- `packages/dnd5e-engine/src/schema/events.ts`
- `packages/dnd5e-engine/src/schema/refusals.ts`
- `packages/dnd5e-engine/src/execute.ts`
- `packages/dnd5e-engine/src/index.ts`
- `packages/dnd5e-engine/README.md`
- `packages/dnd5e-engine/test/commands/spells.test.ts` (new)
- `packages/dnd5e-engine/test/commands/hit-points.test.ts` (half damage)
- `packages/dnd5e-engine/test/coverage.test.ts` (`PLAN_GATE_ONLY`)
- `specs/026-dnd5e-engine/contracts/commands.md`, `events.md`, `refusals.md`, `engine-api.md`
  (each amendment marked "Amended by specs/083-spells-by-srd-id")
- `apps/server/test/dm/spell-mechanics.test.ts` (new; the table checked against the SRD records)

**Phase 2 — Step, gate, resolve, prompts, snapshot, seeds**
- `apps/server/src/dm/nodes/schemas.ts`
- `apps/server/src/dm/gates/plan-gate.ts`
- `apps/server/src/dm/nodes/resolve.ts`
- `apps/server/src/dm/prompts/step-grammar.ts`
- `apps/server/src/dm/prompts/interpret.ts`
- `apps/server/src/dm/prompts/adjudicate.ts`
- `apps/server/src/dm/snapshot/render.ts`
- `apps/server/seeds/greyhollow-ford.json`, `greyhollow-ford-duo.json`, `greyhollow-ford-trio.json`,
  `greyhollow-ford-reed-camp.json`
- `apps/server/test/dm/world.ts` (`spellStep()` helper)
- `apps/server/test/dm/interpret.test.ts`
- `apps/server/test/dm/plan-gate.test.ts`
- `apps/server/test/dm/interpret-prompt.test.ts`
- `apps/server/test/dm/snapshot-render.test.ts`
- `apps/server/test/dm/fallback.test.ts` (one sentence per delivery; edit only the cases added)
- `apps/server/test/dm/spells.integration.test.ts` (new)
- `specs/031-dm-runtime/contracts/nodes.md` (the spell step)
- `specs/031-dm-runtime/contracts/resolve.md` (`case "spell"`)
- `specs/058-roll-reason-plan-gate/contracts/plan-reason-gate.md` (spell codes)

**Phase 3 — Re-ground**
- `docs/wiki/dnd5e-engine.md`, `srd-data.md`, `dm-runtime.md`, `dm-failure-and-gates.md`
- Re-pins of every other note listing a touched source: expected `actor-snapshot.md`,
  `dm-narration-quality.md`, `seed-npc-presence.md`, `playtest-harness.md`, `output-claim-gate.md`
- `docs/wiki/CAPSULES.md`, `docs/wiki/INDEX.md`
- the runbook B file (execution-log row, orchestrator)

**Not touched**: `packages/srd/` (read only; the test lives in the server), `packages/session-model/`
(a `mechanics` proposal carries any `EngineCommand`), `facts.ts`, `fallback.ts`, `narrate.ts`,
`audit.ts`, `first-stage.ts`, `seed/schema.ts`, `seed/load.ts` (spell ids already checked),
`apps/web/` (`ledger-format.ts` renders the existing event types), every frozen contract.

`fallback.test.ts` is touched only to pin the current output for spell rows; if a spell row renders
wrongly there, stop and report rather than edit `fallback.ts` (that would be scope for narration).

**Migrations**: none. **New runtime dependencies**: none.

## The TASK-0105 / TASK-0211 split

- **This card delivers** TASK-0211 AC #2 (Cure Wounds `2d8 + modifier` from the SRD record): spec
  US2, engine `spells.test.ts` Cure Wounds cases, and the DB test.
- **This card also delivers** the slot spend and the no-slot refusal of TASK-0211 AC #1 (OQ-1 (a)):
  `spell.cast` spends the slot, and the DB test casts Cure Wounds until the slots run out.
- **TASK-0211 keeps**: AC #1's replay test over run 1 seq 204–210, and AC #3 (narration never states
  a slot was spent unless the engine spent it). It needs no engine change.
- Under OQ-1 (b), T006, T011 and T029's slot case move to TASK-0211.

## Overlap

- **TASK-0104 (spec 082), merged**: this card reads its stats and derive functions and extends its
  plan gate. No spec 082 behaviour changes.
- **TASK-0128 (opposition and Help)**: also edits `schemas.ts`, `plan-gate.ts`, `resolve.ts`,
  `step-grammar.ts` and the prompt versions. Runbook B runs it beside this card only if disjoint;
  it is not. Whichever merges second rebases and takes the next prompt version.
- **TASK-0211**: rebases on this card (spine #16).
- **TASK-0219** (spell and trait reactions): out of scope; nothing here models a reaction spell.

## Risks

- **Coverage.** Six spells resolve; the rest are refused. A model may keep choosing an excluded
  spell and get "cannot do that here." The prompt names the caster's list, and every refusal is
  visible in the debug view. The OQ-2 follow-up cards widen the table.
- **Strict step.** A model that writes dice on a spell step fails the parse and costs one re-ask.
- **Extracted builders.** Phase 1 moves damage and healing event building into shared functions.
  The existing `hit-points.test.ts` and `replay.test.ts` must stay green unchanged, which pins the
  extraction as behaviour-free.
- **Live sessions.** Odo's added `cure-wounds` reaches only scenes started after deploy.
