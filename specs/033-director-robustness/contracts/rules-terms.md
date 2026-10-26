# Contract: rules terms a model can emit, and their gates

Added by the 2026-10-26 amendment (operator ruling on TASK-0102). Amends
`specs/026-dnd5e-engine/contracts/commands.md` (`check.roll` `skill`),
`specs/031-dm-runtime/contracts/nodes.md` (step schema `skill`) and
`specs/031-dm-runtime/contracts/scene-seed.md` (`skills`, clue `check.skill`).

**Operator requirement (2026-10-26, verbatim):** "Conditions, spells, and other "rules" with
definitions absolutely need to be deterministically defined and resolvable. It should not be
possible for the AI to "invent" a condition without it being rejected by a gating mechanism."

A **rules term** is a value with a rules definition that a model writes into interpret,
adjudicate or director output. A **gate** is a closed list or a data lookup that rejects a term
outside it, before the term reaches the engine or the log. A gate never maps, coerces or drops a
mechanics term to make output pass (TASK-0042 R8; `interpret-output.md` invariants).

## Gate audit

| Rules term | Emitted by | Gate today | Status |
|---|---|---|---|
| Condition (`effect.condition`) | interpret, adjudicate (`EffectSchema`) | `ConditionKeySchema`, derived in `apps/server/src/dm/nodes/schemas.ts` from the engine's `condition.apply` command (engine enum, exhaustion excluded) | Gated ✓ |
| Damage type (`components[].damageType`) | interpret, adjudicate | `DamageTypeSchema`, imported from `@the-stacks/dnd5e-engine` | Gated ✓ |
| Ability (`check.ability`) | interpret, adjudicate | `AbilitySchema`, derived from the engine's `check.roll` command | Gated ✓ |
| SRD citation (`citations[]` with `source: "srd"`) | adjudicate | `SrdKind` enum in the schema; `srd.getById(kind, id)` in `nodes/adjudicate.ts`; an unknown id is dropped and counted in `dropped` | Gated ✓ |
| Library citation (`citations[]` with `source: "library"`) | adjudicate | `verifyLibrary` checks the quote against the passages sent; an unverified quote is dropped and counted | Gated ✓ |
| Skill (`check.skill`) | interpret, adjudicate; the scene seed | Free string today: engine `check.roll` (`packages/dnd5e-engine/src/schema/commands.ts`), `StepSchema` check (`schemas.ts`), seed `skills` keys and clue `check.skill` (`apps/server/src/dm/seed/schema.ts`) | **Gated by this amendment** (below) |
| Spell | interpret (`intent: "spell"`), adjudicate | None. No spell id exists in any output schema. A spell plays as model-written check, attack and effect steps. | **NOT gated.** Out of scope for TASK-0102. Follow-up: card TASK-0105 ("Rules gate: spells resolve by SRD id through the engine", m-3, depends on TASK-0104) |
| Dice expression, modifier and DC (`expression`, `dc`, `targetAc`, `Amount`) | interpret, adjudicate | The engine parses each expression and refuses a bad one (`INVALID_DICE_EXPRESSION`, `D20_TERM_REQUIRED`). The schema bounds `dc` and `targetAc` to 1–40. The model still chooses the modifier inside the expression and the DC. Neither is derived from the character sheet or the seed. | **NOT gated.** Out of scope for TASK-0102. Follow-up: card TASK-0104 ("Rules gate: check, attack and save modifiers and DCs derive from combatant stats, not model text", m-3) |

The two NOT-gated rows are recorded, not fixed, here. Decision-0020 forbids a deferral without
a card; TASK-0104 and TASK-0105 are those cards. Operator ruling 2026-10-26: both are milestone
m-3 and do not block the M2 demo.

## The skill gate

### Key list

The 18 skills of SRD 5.2.1, as lowercase kebab-case keys:

```
acrobatics, animal-handling, arcana, athletics, deception, history, insight, intimidation,
investigation, medicine, nature, perception, performance, persuasion, religion,
sleight-of-hand, stealth, survival
```

Spelling rule: lowercase; a space becomes `-`. This matches the shipped Greyhollow Ford seed
(all single-word keys, already lowercase) and the existing `sleight-of-hand` example in
`specs/029-proposal-gate/quickstart.md`.

### Where it is defined

1. `packages/dnd5e-engine/src/schema/state.ts` defines `SkillSchema = z.enum([...18 keys])` beside
   `ConditionKeySchema`, and the type `Skill`. This is the only literal list.
2. `packages/dnd5e-engine/src/schema/commands.ts` `check.roll` uses
   `skill: SkillSchema.nullable().default(null)`.
3. `packages/dnd5e-engine/src/index.ts` exports `SkillSchema` and `type Skill`.
4. `apps/server/src/dm/nodes/schemas.ts` derives `SkillSchema` from the engine's `check.roll`
   command shape, the way it derives `AbilitySchema`. It unwraps the default and the nullable,
   and throws at load when the inner schema is not an enum.
5. `StepSchema` check uses `skill: SkillSchema.nullable()`.
6. `apps/server/src/dm/seed/schema.ts` uses the server's derived `SkillSchema` for clue
   `check.skill` (`SkillSchema.nullable()`) and for character `skills` keys
   (`z.partialRecord(SkillSchema, …)`). It imports it from `../nodes/schemas.js`.
7. The prompts render the list from the enum's options at runtime. No hand-typed list exists
   outside `state.ts`.

### Engine events stay as they are

`check.resolved.skill` in `packages/dnd5e-engine/src/schema/events.ts` stays
`z.string().nullable()`. The event records what the command validated, so new events carry a
key from the list. Narrowing the event would break the read of existing logs:

- No production deployment exists, so no production log holds a skill.
- Local development stacks hold scripted-run events with title-case skills (`"Investigation"`,
  `"Persuasion"`, from `apps/server/test/dm/scripts/greyhollow-ford-full.json`).
- Tracked files hold such events too: `specs/031-dm-runtime/evidence/full-turn.json`
  (`"Investigation"`) and, on the TASK-0048 branch,
  `apps/server/test/playtest/fixtures/doctored/{ledger.json,transcript.jsonl}` (`"Investigation"`,
  `"Persuasion"`).
- `packages/session-model/src/events/mechanics.ts` parses stored mechanics events with
  `EngineEventSchema`. Constitution IV requires events to carry a schema version, so narrowing
  needs an event `v` bump and a migration path. That is not this task.

### Files whose skill values change

Title case becomes the kebab key. `null` values stay.

| File | Value today | Value after |
|---|---|---|
| `apps/server/test/dm/interpret.test.ts` (line ~28) | `"Sleight of Hand"` | `"sleight-of-hand"` |
| `apps/server/test/dm/world.ts` (~226) | `"Athletics"` | `"athletics"` |
| `apps/server/test/dm/beat.integration.test.ts` (~58) | `"Athletics"` | `"athletics"` |
| `apps/server/test/dm/resolve.integration.test.ts` (~385) | `"Athletics"` | `"athletics"` |
| `apps/server/test/dm/adjudicate.integration.test.ts` (~90) | `"Athletics"` | `"athletics"` |
| `apps/server/test/dm/scripts/greyhollow-ford-full.json` (~103, ~202) | `"Investigation"`, `"Persuasion"` | `"investigation"`, `"persuasion"` |
| `apps/server/test/dm/scripts/exploration-check.json` (~59) | `"Investigation"` | `"investigation"` |
| `apps/server/test/dm/scripts/social-adjudicated.json` (~73) | `"Persuasion"` | `"persuasion"` |
| `apps/server/test/dm/scripts/audit-regenerate.json` (~51) | `"Athletics"` | `"athletics"` |
| `apps/server/test/dm/scripts/audit-fallback.json` (~51) | `"Athletics"` | `"athletics"` |

A test assertion that reads one of these values back (for example a `check.resolved` event's
`skill`) moves with it.

Already conforming, no change: `apps/server/seeds/greyhollow-ford.json`,
`specs/031-dm-runtime/data/greyhollow-ford.seed.json`,
`packages/dnd5e-engine/test/commands/attacks.test.ts` (`"perception"`), and every `skill: null`
in `packages/session-model/src/fixtures/`, `packages/session-model/test/`,
`apps/server/test/gate.integration.test.ts` and `apps/server/test/dm/facts.test.ts`.

Not changed (not model output, not an engine command): `apps/server/src/library/ddb/`, the
D&D Beyond import. Committed evidence under `specs/*/evidence/` is a historical record and is
never rewritten.
