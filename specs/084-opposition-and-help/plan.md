# Implementation Plan: Opposition as a derived DC, and Help as advantage

**Branch**: `task-0128-opposition-and-help` | **Date**: 2026-11-03 | **Spec**: [spec.md](spec.md)

**Input**: `specs/084-opposition-and-help/spec.md`, TASK-0128, runbook B
(`docs/design/m3-runbook-b-resolution-quality.md`, lane B3, spine #15). Builds on merged TASK-0104
(spec 082, #123) and TASK-0105 (spec 083, #124). Written against every open-question default (a).
Amended after the Phase 0 seam check: see [deviations.md](deviations.md). Research, design and contracts
live in this file, as in specs 070 and 082. No separate research.md, data-model.md or
quickstart.md.

## Summary

The engine gains two SRD opposition rules (`unarmed-strike`, `influence`) that derive a check's DC
from the opponent's stats, and a `help.grant` command that records an assist on its holder. A
derived check or attack folds a matching assist in as an advantage source and ends it. An assist
also ends at the start of its helper's next turn, on replacement, and at encounter end. The step
contract gains an opposition form of the check's `difficulty` and a new `help` step. Resolve
submits both; the plan gate and `askUndeclared` treat the Help helper as the acting PC. Facts
carry an `assist` change so narration and the fallback can name a Help. Group checks stay off.

## Technical Context

**Language/Version**: TypeScript (Node 22), as the repo.
**Primary Dependencies**: Zod, Vitest. **No new runtime dependency.**
**Storage**: Postgres event log (JSON payloads). **No migration**: `abilityScores`, `assists` and
`opposition` are optional JSON fields; `assist.granted` and `assist.ended` join the mechanics
catalog through `EngineEventSchema` (`MECHANICS_EVENT_TYPES` is derived from it).
**Testing**: Vitest. Engine scripted-dice tests; server unit tests (schemas, plan gate, prompts,
facts, fallback); one DB integration test with `REQUIRE_DATABASE=1` on the worktree stack; the
fake gateway. No paid run.
**Target Platform**: `packages/dnd5e-engine` and the server DM pipeline.
**Constraints**: frozen contracts untouched (`docs/wiki/ws-protocol.md` frames,
`specs/029-proposal-gate/contracts/`, `specs/030-play-route/contracts/proposal-seam.md`). A
`mechanics` proposal carries any `EngineCommand`, so `help.grant` rides it unchanged. The engine
keeps importing only `zod` (purity test). `facts.ts` keeps importing no engine value.
**Scale/Scope**: 12 engine files (1 new) and 7 engine tests (1 new); 1 session-model test; 11
server source files; about 9 server tests (1 new); 7 contract files; the wiki.

## Constitution Check

Against `.specify/memory/constitution.md` 2.0.0. Re-checked after design: unchanged.

- [x] **I. Agent-operable**: `help.grant` and the `opposition` field are engine command fields; a
      human DM's `mechanics` request reaches them through the same gate.
- [x] **II. Content contract**: no seed field added. The `groupChecks` comment changes only.
- [x] **III. Data planes**: session plane only. SRD data is read as today.
- [x] **IV. Event sourcing**: two new engine events; `evolve` applies both; replay reproduces the
      assists. `check.resolved` gains an optional field.
- [x] **V. Citations**: each rule cites its SRD 5.2.1 record or page in a code comment
      (`rules-glossary.help-action`, `rules-glossary.influence-action`, Unarmed Strike p. 190).
- [x] **VI. 5e engine boundary**: the DC and the assist's advantage are computed in the engine and
      covered by scripted-dice tests. The model names an opponent and a rule, never a number.
- [x] **VII. Structured first**: opposition and assist are typed fields.
- [x] **VIII. Operator-owned content**: no book text.
- [x] **IX. Self-hostable**: no service or dependency.

**Stack conformance**: no departure. **Complexity Tracking**: none.

## Research

- **R1 — SRD opposition cases.** Searched `packages/srd/data/rule.json` (117 records) and
  `condition.json`. A DC derived from another creature's stats appears in: the Unarmed Strike
  grapple and shove save DC (8 + Strength modifier + PB), which is also the grapple escape DC; the
  Influence default DC (15 or the monster's Intelligence score, whichever is higher); the Hide
  total as the DC to find the hider; spell save DCs. Hide needs hidden state (TASK-0217). Spell
  DCs are spec 082's `spellSaveDc` (TASK-0105). The other two are this card's rules.
- **R2 — Monster escape DCs.** 38 SRD monster attacks carry "escape DC N" in `hitText`; 17 equal
  8 + Str + PB, 21 do not (aboleth 14 vs 17, kraken 20 vs 25). A stat-block DC is a monster
  feature DC: TASK-0224 owns it (spec OQ-2). No shipped seed monster has a grapple attack.
- **R3 — Ability scores.** `influence` needs the opponent's Intelligence score. Spec 082 stats carry
  modifiers only. SRD monsters carry `abilities.<a>.score`; seed sheets carry no scores. Stats gain
  optional `abilityScores`; `statsFromSrd` fills them; a PC opponent refuses `STAT_UNDEFINED`
  ("int score"). Influence targets monsters (SRD: "you urge a monster").
- **R4 — Help expiry.** SRD: "This benefit expires if the ally doesn't use it before the start of
  your next turn" (`rules-glossary.help-action`). The engine already expires conditions at an
  `ExpiryPoint {round, combatantId, boundary}` through `expiring()` in
  `commands/encounter.ts`, called by `turn.advance`, `initiative.leave` and dead-skip. The assist
  reuses `ExpiryPointSchema` and that function. The helper's next turn start is round R if the
  helper sits after the active index, else R + 1 (the active helper's next start is R + 1).
- **R5 — Where an assist lives.** On the holder, beside `conditions`: the ally for an
  ability-check assist, the distracted enemy for an attack assist. The roll handlers already load
  the checker, the attacker and the target, so the lookup is local. A helper holds at most one open
  assist (SRD "One Thing at a Time", `playing-the-game.actions.one-thing-at-a-time`), so the
  helper id identifies an assist on its holder. No instance id or sequence is needed.
- **R6 — Why not reuse a condition.** Conditions are a closed SRD enum
  (`ConditionKeySchema`); Help is not a condition, and "used by the next matching roll" is not a
  condition rule. A model-written `circumstance` cannot be consumed or expired. A separate `assists`
  list keeps both rules in the engine.
- **R7 — Spec 077's rule.** `askUndeclared` asks when an `ability-check` combatant or an
  `attackerId` names another human's PC. A Help is an act by its helper; the ally only receives
  advantage. So `helperId` joins the rule and `allyId`/`targetId` do not. A party-scope action
  skips the rule, as today.
- **R8 — Spec 079's rule.** `foreignActor` refuses an attack or move whose actor is not the
  action's. `helperId` joins it, so Tamsin's action cannot spend Kestrel's action on a Help.
- **R9 — Existing readers of the check step.** `first-stage.ts` compares kind, ability and skill;
  `stakes.ts` `isFreeRetry` reads kind, combatant, ability, skill, `newRisk` and `autoFail`;
  `effectsForBand` reads the effect lists. None reads `difficulty`, so OQ-1 (a) leaves all three
  untouched. A new step kind (OQ-1 (b)) would need a case in each.
- **R10 — Event consumers.** `MECHANICS_EVENT_TYPES` and the catalog derive from
  `EngineEventSchema`; `packages/session-model/test/catalog.test.ts` pins the counts (18
  mechanics, 37 total) and moves to 20 and 39. The play ledger renders any state-change row
  generically (`apps/web/app/play/ledger-format.ts`), so `apps/web` needs no change. `facts.ts`
  skips unknown change types until D9 adds the assist.
- **R11 — Prompt versions on `main` at the seam check**: interpret-v12, adjudicate-v9,
  narrate-v16, audit-v10. This card bumps them to interpret-v13, adjudicate-v10, narrate-v17 and
  audit-v11. Audit renders facts through narrate's `factEntries`, so the assist fact changes it too
  (deviations M4, M5).
- **R12 — Spell attacks (spec 083).** `handleSpellCast` rolls its own d20 attack with
  `attackModeSources`. A spell attack roll is an attack roll under `rules-glossary.help-action`, so
  an attack assist applies to it (deviations S1).

## Design

### D1 — Engine state (`packages/dnd5e-engine/src/schema/state.ts`)

```ts
// CombatantStatsSchema gains
abilityScores: z.partialRecord(AbilitySchema, z.number().int().min(1).max(30)).optional(),

export const AssistSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ability-check"), helperId: CombatantIdSchema, skill: SkillSchema,
             expiresAt: ExpiryPointSchema.nullable() }),
  z.object({ kind: z.literal("attack"), helperId: CombatantIdSchema,
             expiresAt: ExpiryPointSchema.nullable() }),
]);
// CombatantSchema gains   assists: z.array(AssistSchema).max(8).optional()
// superRefine: helper ids unique within one combatant's assists.
```

### D2 — Rules (`packages/dnd5e-engine/src/derive.ts`, pure, exported)

```ts
export const OppositionRuleSchema = z.enum(["unarmed-strike", "influence"]);
export function oppositionCovers(rule, kind, ability, skill): boolean;
  // unarmed-strike: ability-check str+athletics or dex+acrobatics; saving-throw str or dex.
  // influence: ability-check cha + deception|intimidation|performance|persuasion, or wis + animal-handling.
export function oppositionDc(opponent: Combatant, rule): Derived<number>;
  // unarmed-strike: 8 + abilityMods.str + proficiencyBonus   (Unarmed Strike, SRD p. 190)
  // influence: max(15, abilityScores.int)                     (rules-glossary.influence-action)
  // missing stats or field → { ok: false, missing }
export function checkAssists(c: Combatant, kind, skill): Assist[];
  // ability-check with a skill: the c.assists entries of kind ability-check with that skill.
export function attackAssists(target: Combatant | undefined, attackerId: string | null): Assist[];
  // the target's attack assists whose helperId ≠ attackerId.
  // ponytail: no factions; "one of your allies" is any attacker but the helper. Add with factions.
export function helperExpiry(enc: Encounter | null, helperId: string): ExpiryPoint | null;
  // R4: null without an encounter or with the helper outside the order.
```

`checkModeSources` and `attackModeSources` stay as merged. The handlers append one `"advantage"`
source when the assist list is non-empty, then call `foldMode`.

### D3 — Commands, events and refusals

- `check.roll` gains `opposition: z.object({ opponentId: Id, rule: OppositionRuleSchema }).optional()`.
- New command `help.grant`: `{ type, helperId: Id, assist: discriminatedUnion("kind",
  [{kind:"ability-check", allyId: Id, skill: SkillSchema}, {kind:"attack", targetId: Id}]),
  reason }`.
- `check.resolved` gains `opposition: { opponentId, rule }.optional()`.
- New events: `assist.granted { type, v, reason, combatantId /*holder*/, before: null, after:
  Assist }` and `assist.ended { type, v, reason, combatantId, cause: enum(["used", "expired",
  "replaced", "encounter-ended"]), before: Assist, after: null }`.
- Refusal enum gains `NOT_PROFICIENT`.

### D4 — `handleCheckRoll` (`packages/dnd5e-engine/src/commands/attacks.ts`)

Order, as merged, with these changes:

1. Exactly one of `dc`, `difficulty` and `opposition`, else `INVALID_COMMAND`.
2. With `opposition`: `opponentId === combatantId` or `!oppositionCovers(...)` → `INVALID_COMMAND`.
3. The named check covers `[combatantId, opposition?.opponentId]` (`UNKNOWN_COMBATANT`,
   `TARGET_DEAD`).
4. With `opposition`: `oppositionDc` `{ok:false}` → `STAT_UNDEFINED` `{ combatantId: opponentId,
   missing }`. DC = its value.
5. Derived path (no expression, non-null combatant): `assists = checkAssists(...)`; mode =
   `foldMode(command.mode, [...checkModeSources(...), ...(assists.length ? ["advantage"] : [])])`.
6. `check.resolved` base carries `opposition` when set. The auto paths emit no `assist.ended`.
7. After the roll: one `assist.ended` (cause `used`) per applied assist, after `check.resolved`.

### D5 — `handleAttackRoll` (same file)

On the derived path (`attack` set): `assists = attackAssists(target, attackerId)`; one more
`"advantage"` source when non-empty; after `attack.resolved` (and before the reaction's
`encounter.changed`), one `assist.ended` (`used`) per applied assist on the target. The
explicit-expression path is unchanged.

### D5a — Spell attacks (`packages/dnd5e-engine/src/commands/spells.ts`)

In the attack delivery of `handleSpellCast`: `assists = attackAssists(target, casterId)`; one more
`"advantage"` source in its `foldMode` when non-empty; after `attack.resolved`, one `assist.ended`
(`used`) per applied assist, before any damage event. The save and healing deliveries are
unchanged.

### D6 — `handleHelpGrant` (new `packages/dnd5e-engine/src/commands/help.ts`)

1. Named ids: helper, then ally or target (`UNKNOWN_COMBATANT`, `TARGET_DEAD`).
2. Ally or target equals the helper → `INVALID_COMMAND`.
3. Helper unable → `actorUnable(state, helperId, "helper")` (exported from `attacks.ts` by spec 083;
   widen its `role` type to add `"helper"`) → `ACTOR_UNABLE` role `helper`. Step 1 uses the
   exported `checkNamed`.
4. Ability-check assist: helper without stats → `STAT_UNDEFINED`; `stats.skills[skill]` undefined
   → `NOT_PROFICIENT` `{ combatantId: helperId, skill }`.
   `// ponytail: tool proficiencies are not modelled; add when sheets carry them (TASK-0058).`
5. Events: `assist.ended` (`replaced`) for the helper's open assist on any holder, then
   `assist.granted` on the holder with `expiresAt: helperExpiry(state.encounter, helperId)`.

Attack assist: no proficiency or distance check.
`// ponytail: no positions; "an enemy within 5 feet of you" is not checked. Add with positions.`

### D7 — Expiry (`commands/encounter.ts`, `evolve.ts`)

- `expiring(state, point, reason)` also emits `assist.ended` (`expired`) for every assist whose
  `expiresAt` equals the point. Every caller (turn advance, leave, dead-skip) gets it unchanged.
- `handleEncounterEnd` emits `assist.ended` (`encounter-ended`) for every open assist, beside its
  condition removals.
- `evolve`: `assist.granted` appends `after` to `assists` (creating the list); `assist.ended`
  filters out the entry with `before.helperId`.

### D8 — SRD stats (`apps/server/src/dm/seed/combatants.ts`)

`statsFromSrd` sets `abilityScores` from `monster.abilities[a].score` for all six.
`statsFromCharacter` sets none (the seed sheet has no scores).

### D9 — Step contract (`apps/server/src/dm/nodes/schemas.ts`)

```ts
const OppositionSchema = z.strictObject({ opposedBy: CombatantIdSchema, rule: OppositionRuleSchema });
// check step:  difficulty: z.union([DifficultySchema, OppositionSchema])
// new step:
z.strictObject({
  step: z.literal("help"), reason: Reason, helperId: CombatantIdSchema,
  assist: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("ability-check"), allyId: CombatantIdSchema, skill: SkillSchema }),
    z.strictObject({ kind: z.literal("attack"), targetId: CombatantIdSchema }),
  ]),
}),
```

`refineSteps` adds: an opposition whose `opposedBy` equals the check's `combatantId`
(`difficulty.opposedBy`); an opposition the rule does not cover (`difficulty.rule`); a help whose
`allyId` or `targetId` equals `helperId` (`assist`).

### D10 — Prompts

- `prompts/step-grammar.ts`: the check line shows `"difficulty":difficulty tier|{"opposedBy":id,
  "rule":opposition rule}`. A new line lists each opposition rule and the checks it covers, and
  says: "When the check is against a creature's own effort (escaping or resisting a grapple or
  shove, urging a monster), name the creature in opposedBy instead of a tier." The help step line:
  `{"step":"help","reason":str,"helperId":id,"assist":{"kind":"ability-check","allyId":id,"skill":skill
  key}|{"kind":"attack","targetId":id}}  (the helper takes the Help action: the ally gets advantage on its
  next check with that skill, or on the next attack against that target; the engine applies and ends it.
  The helper is the declaring character)`.
- `prompts/interpret.ts`: version to `dm.interpret-v13`. `OUTPUT_SHAPE`'s step rules gain: "When a
  character helps another, plan one help step for the helper and no check for the ally."
- `prompts/adjudicate.ts`: version to `dm.adjudicate-v10` (it renders the grammar).
- Placement (deviations M3): the opposition-rules line goes right after the difficulty-tier line.
  The help line goes after the two spell lines.

### D11 — Resolve (`apps/server/src/dm/nodes/resolve.ts`)

- `case "check"`: when `typeof step.difficulty === "string"`, submit `difficulty` as merged; else
  submit `opposition: { opponentId: step.difficulty.opposedBy, rule: step.difficulty.rule }` and
  no `difficulty`. Nothing else in the case changes.
- New `case "help"`: `take(await run.mech(key, { type: "help.grant", helperId, assist: { kind,
  allyId | targetId, skill } }, step.reason, actionId))`. No effects follow.
- `presenceTargets` is unchanged (a help step carries no presence effect).

### D12 — Plan gate (`apps/server/src/dm/gates/plan-gate.ts`)

- `stepIds`: `case "check"` adds `{ field: "difficulty.opposedBy", id }` for an opposition. New
  `case "help"`: `helperId`, then `assist.allyId` or `assist.targetId`. A pulled NPC opponent is
  pulled in, as any named id.
- `stepTexts`: `case "help"` returns its `reason`.
- `foreignActor`: a help step's `helperId` is checked like an `attackerId`.
- `statGap`: an opposition runs `oppositionDc` on the opponent (joining ids skipped);
  `{ok:false}` → `field: "difficulty.opposedBy"`. An ability-check help whose helper has no
  stats → `field: "helperId"`. Proficiency is left to the engine's `NOT_PROFICIENT` refusal.
- `askUndeclared`: the other-player id is `step.helperId` for a help step, beside the attack,
  spell and check cases. It calls `otherPlayerQuestion(name, declarerName)` as merged by TASK-0204.
  The manner rule is unchanged.
- `foreignActor` order (deviations M8): `attackerId`, `casterId`, `helperId`, then a move's
  `combatantId`. `spellGap` is unchanged.

### D13 — Facts, narrate and fallback (OQ-4 (a))

- `apps/server/src/dm/facts.ts`: `FactChange` gains `{ kind: "assist"; helper: string; target:
  string; assist: "ability-check" | "attack" }`, built from an `assist.granted` change row
  (`target` is the holder's name; `helper` from `after.helperId`). `assist.ended` builds no fact.
- `apps/server/src/dm/prompts/narrate.ts`: `describeChange` renders "`<helper>` helps `<target>`"
  or "`<helper>` distracts `<target>`". Version to `dm.narrate-v17`.
- `apps/server/src/dm/prompts/audit.ts`: version to `dm.audit-v11` (it renders facts through
  `factEntries`; deviations M5).
- `apps/server/src/dm/fallback.ts`: `changeSentence` renders "`<helper>` lends `<target>` a hand."
  or "`<helper>` distracts `<target>`." `renderChangeLine` (`facts.ts`) returns null for it, so no
  dice line is added.

### D14 — Group checks (OQ-5 (a))

`apps/server/src/dm/seed/schema.ts`: the comment "groupChecks is read by nothing until
TASK-0128." becomes "groupChecks has no behaviour yet: SRD 5.2.1 has no group-check rule
(TASK-0232)."

## Files the build touches

Every path below is the full list. A build that needs another file stops and amends this list.

**Phase 1 — Engine**
- `packages/dnd5e-engine/src/schema/state.ts` (D1)
- `packages/dnd5e-engine/src/schema/commands.ts` (D3)
- `packages/dnd5e-engine/src/schema/events.ts` (D3)
- `packages/dnd5e-engine/src/schema/refusals.ts` (D3)
- `packages/dnd5e-engine/src/derive.ts` (D2)
- `packages/dnd5e-engine/src/commands/attacks.ts` (D4, D5; widen `actorUnable`'s `role`)
- `packages/dnd5e-engine/src/commands/spells.ts` (D5a)
- `packages/dnd5e-engine/src/commands/help.ts` (new, D6)
- `packages/dnd5e-engine/src/commands/encounter.ts` (D7)
- `packages/dnd5e-engine/src/evolve.ts` (D7)
- `packages/dnd5e-engine/src/execute.ts` (register `help.grant`)
- `packages/dnd5e-engine/src/index.ts` (exports)
- `packages/dnd5e-engine/README.md`
- `packages/dnd5e-engine/test/derive.test.ts`
- `packages/dnd5e-engine/test/commands/attacks.test.ts`
- `packages/dnd5e-engine/test/commands/spells.test.ts` (D5a)
- `packages/dnd5e-engine/test/commands/help.test.ts` (new)
- `packages/dnd5e-engine/test/execute.test.ts` (counts 23/18/34 → 24/20/35)
- `packages/dnd5e-engine/test/commands/encounter.test.ts`
- `packages/dnd5e-engine/test/replay.test.ts` (an assist survives replay)
- `packages/session-model/test/catalog.test.ts` (counts 18 → 20, 37 → 39)
- `specs/026-dnd5e-engine/contracts/commands.md`, `events.md`, `refusals.md`, `engine-api.md`
  (each amendment marked "Amended by specs/084-opposition-and-help")

**Phase 2 — Step contract, prompts, plan gate and resolve**
- `apps/server/src/dm/seed/combatants.ts` (D8)
- `apps/server/src/dm/seed/schema.ts` (D14, one comment)
- `apps/server/src/dm/nodes/schemas.ts` (D9)
- `apps/server/src/dm/prompts/step-grammar.ts` (D10)
- `apps/server/src/dm/prompts/interpret.ts` (D10)
- `apps/server/src/dm/prompts/adjudicate.ts` (D10, version only)
- `apps/server/src/dm/gates/plan-gate.ts` (D12)
- `apps/server/src/dm/nodes/resolve.ts` (D11)
- `apps/server/test/dm/seed-stats.test.ts`
- `apps/server/test/dm/world.ts` (a `helpStep()` builder)
- `apps/server/test/dm/interpret.test.ts`
- `apps/server/test/dm/interpret-prompt.test.ts` (versions, grammar lines, inline snapshot)
- `apps/server/test/dm/plan-gate.test.ts`
- `specs/031-dm-runtime/contracts/nodes.md`, `resolve.md`, `scene-seed.md`
- `specs/058-roll-reason-plan-gate/contracts/plan-reason-gate.md`

**Phase 3 — Narration facts and end-to-end test**
- `apps/server/src/dm/facts.ts` (D13)
- `apps/server/src/dm/prompts/narrate.ts` (D13)
- `apps/server/src/dm/prompts/audit.ts` (D13, version only)
- `apps/server/src/dm/fallback.ts` (D13)
- `apps/server/test/dm/facts.test.ts`
- `apps/server/test/dm/fallback.test.ts`
- `apps/server/test/dm/narrate.test.ts` (narrate and audit versions)
- `apps/server/test/dm/opposition-and-help.integration.test.ts` (new; US1–US3 end to end)

**Phase 4 — Re-ground**
- `docs/wiki/dnd5e-engine.md`, `dm-runtime.md`, `dm-failure-and-gates.md`,
  `dm-narration-quality.md`
- Re-pins of every other note listing a touched source: expected `srd-data.md`,
  `seed-npc-presence.md`, `dm-turn-jobs.md`, `party-panel.md`, `proposal-gate.md`,
  `turn-floor.md`, `output-claim-gate.md`, `dm-talk-triggers.md`
- `docs/wiki/CAPSULES.md`, `docs/wiki/INDEX.md`
- the runbook B file (execution-log row)

**Not touched**: `apps/web/` (R10), `packages/srd/` (read only), `packages/session-model/src/`
(the catalog derives the new types), `first-stage.ts`, `stakes.ts`, `resume.ts` (R9; resume
re-parses with the widened `StepSchema`), `apps/server/seeds/`, every DM script and fixture (a
tier string still parses, SC-004), 
every frozen contract.

**Migrations**: none. **New runtime dependencies**: none.

## Overlap with TASK-0105 (spec 083, spells by SRD id)

**Superseded by the seam check.** TASK-0105 merged as #124. The table below is the authoring-time
forecast. [deviations.md](deviations.md) records the hunks as merged.

Spec 083 adds a spell step. Its expected footprint (runbook overlap table): engine,
`packages/srd`, `nodes/schemas.ts`, `prompts/{interpret,adjudicate}.ts`, `nodes/resolve.ts`. The
two plans share **files**, so by runbook B's "Rule at dispatch" this card draft-holds behind 0105
unless the orchestrator compares hunks and rules otherwise. This card's hunks in each shared
file:

| Shared file | This card's hunks | Likely 0105 hunk |
|---|---|---|
| `nodes/schemas.ts` | check step `difficulty` field; a `help` option appended to the `StepSchema` union; `refineSteps` opposition and help branches | a `spell` option in the same union; maybe a `refineSteps` branch |
| `prompts/step-grammar.ts` | check line `difficulty`; one opposition-rules line; one help line | one spell line |
| `prompts/interpret.ts` | `PROMPT_VERSION`; one `OUTPUT_SHAPE` sentence | `PROMPT_VERSION`; spell rules |
| `prompts/adjudicate.ts` | `PROMPT_VERSION` only | `PROMPT_VERSION` |
| `nodes/resolve.ts` | `case "check"` submission (`difficulty`/`opposition`); new `case "help"` in `runSteps` | new `case "spell"` in `runSteps` |
| `gates/plan-gate.ts` | `stepIds`, `stepTexts`, `foreignActor`, `statGap`, `askUndeclared` (help and opposition branches) | likely `stepIds`/`stepTexts`/`statGap` spell cases |
| engine `schema/commands.ts` | `check.roll.opposition`; `help.grant` option | a spell command or `check.roll`/`attack.roll` fields |
| engine `schema/events.ts` | `check.resolved.opposition`; two new event options | possibly a spell event |
| engine `schema/state.ts` | `abilityScores`; `assists` | possibly none |
| engine `schema/refusals.ts` | `NOT_PROFICIENT` | possibly a spell refusal code |
| engine `derive.ts`, `commands/attacks.ts`, `execute.ts`, `index.ts` | D2, D4, D5, one handler line, exports | likely spell exports and a handler line |
| `seed/combatants.ts` | `statsFromSrd` `abilityScores` | possibly spell lists |
| `packages/session-model/test/catalog.test.ts` | counts | counts, if 0105 adds an event |

Every shared hunk is an append to a union, an enum, a switch or an export list, or a version
string. A textual conflict there is mechanical; the later merge re-bumps prompt versions and the
catalog counts.

## Risks

- **Model adoption.** A model may keep writing a tier for an opposed effort. The grammar line
  states when to use `opposedBy`; watch the next playtest. A tier is still legal, so nothing breaks.
- **Assist lifetime out of combat (OQ-3 (a)).** An assist granted out of combat lasts until used.
  A forgotten Help can surface many beats later. The next matching check names it in the ledger.
- **Catalog counts.** Any card adding an engine event in parallel collides on the two counts in
  `catalog.test.ts` and the three in `execute.test.ts`. Mechanical.
