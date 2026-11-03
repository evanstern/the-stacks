# Contract: engine API, state and RNG

Package: `@the-stacks/dnd5e-engine` (`packages/dnd5e-engine`). This file is binding for
TASK-0044 (session events), TASK-0045 (gate) and TASK-0046 (DM runtime). A change to any
exported name or schema below is a contract change: update this file in the same PR.

Sibling contracts: [commands.md](commands.md), [events.md](events.md),
[refusals.md](refusals.md), [boundary-rule.md](boundary-rule.md).

## Public surface (`src/index.ts`)

```ts
// The one command entry point (AC #1).
export function execute(state: EngineState, command: unknown, rng: Rng): EngineResult;

// Event folding (the decide/evolve pair). TASK-0044 projections call these.
export function evolve(state: EngineState, event: EngineEvent): EngineState;
export function replay(events: readonly EngineEvent[], initial?: EngineState): EngineState;
export function emptyState(): EngineState;

// Read-only selectors (queries, not commands).
export function conditionsOf(state: EngineState, combatantId: string): ConditionInstance[];
export function activeCombatant(state: EngineState): Combatant | null;

// Dice: parse without rolling, so a caller can validate an expression early.
export function parseDiceExpression(expression: string): DiceParseResult;

// RNG.
export interface Rng { rollDie(sides: number): number; }
export function seededRng(seed: number): Rng;
export function scriptedRng(faces: readonly number[]): ScriptedRng;

// Schemas and inferred types.
export {
  EngineStateSchema, CombatantSchema, ConditionInstanceSchema, EncounterSchema,
  DamageTypeSchema, DefenseSetSchema,
  EngineCommandSchema, EngineEventSchema, RefusalSchema, RefusalCodeSchema,
  EngineResultSchema, ENGINE_SCHEMA_VERSION,
};
export type {
  EngineState, Combatant, ConditionInstance, Encounter, EngineCommand, EngineEvent,
  Refusal, RefusalCode, EngineResult, DamageType, DefenseSet,
};
```

`execute` takes `command: unknown` on purpose: it parses with `EngineCommandSchema` itself, so
a gate that forwards an LLM proposal cannot skip validation. A parse failure is refusal
`INVALID_COMMAND`, not a throw. `execute` also parses `state` with `EngineStateSchema`; a
failure is refusal `INVALID_STATE`.

## Result

```ts
export const EngineResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), events: z.array(EngineEventSchema).min(1) }),
  z.object({ ok: z.literal(false), refusal: RefusalSchema }),
]);
```

## Invariants (each one has a test)

1. **Purity.** `execute` never mutates `state`, `command` or anything they reference. Tests
   deep-freeze the inputs.
2. **Determinism.** Equal `state`, equal `command` and two `seededRng(s)` with equal `s` give
   deeply equal results.
3. **Refuse before draw.** A refusal draws zero dice. Every precondition is checked before
   the first `rng.rollDie` call. A test wraps the RNG in a counter and asserts 0.
4. **Replay equivalence.** For `{ ok: true, events }`, `replay(events, state)` equals the
   state the command intends, and `evolve` uses only the event's `after` values (it never
   recomputes a rule). Projections can therefore rebuild state from the log without the RNG.
5. **Non-empty success.** A successful command yields at least one event.
6. **Throws are bugs.** `execute` throws only when the RNG misbehaves (a scripted RNG out of
   faces or out of range, or a `rollDie` result outside `1..sides`). Every illegal input is
   a refusal.

## RNG

```ts
export interface Rng {
  /** Returns an integer face in 1..sides inclusive. sides is an integer in 1..1000. */
  rollDie(sides: number): number;
}
```

- `seededRng(seed)` — `seed` is an integer in `0..2^32-1`. The generator is mulberry32 (see
  research R2). Faces use rejection sampling, so every face of an `n`-sided die is equally
  likely. The engine validates every face it receives and throws `RngContractError` on a
  face outside `1..sides`.
- `scriptedRng(faces)` returns a `ScriptedRng`:

```ts
export interface ScriptedRng extends Rng {
  /** Faces not yet consumed. */
  remaining(): number;
  /** Number of rollDie calls so far. */
  calls(): number;
}
```

  `rollDie(sides)` returns the next listed face. It throws `ScriptedDiceError` when the list
  is exhausted or the next face is outside `1..sides`. Tests assert `remaining() === 0` after
  a command, so an unused scripted face is a test failure, not silent slack.

- Where the seed comes from is the caller's decision (TASK-0045). The engine never reads a
  clock or a global random source.

## State

```ts
export const ENGINE_SCHEMA_VERSION = 1;

export const CombatantIdSchema = z.string().regex(/^[a-z0-9][a-z0-9_.:-]{0,63}$/);

export const LifeStateSchema = z.enum(["conscious", "unconscious", "stable", "dead"]);

export const ConditionKeySchema = z.enum([
  "blinded", "charmed", "deafened", "exhaustion", "frightened", "grappled",
  "incapacitated", "invisible", "paralyzed", "petrified", "poisoned", "prone",
  "restrained", "stunned", "unconscious",
]);

export const ExpiryPointSchema = z.object({
  round: z.number().int().min(1),
  combatantId: CombatantIdSchema,
  boundary: z.enum(["turn-start", "turn-end"]),
});

export const ConditionInstanceSchema = z.object({
  instanceId: z.string().min(1),            // "<combatantId>#<conditionSeq>"
  condition: ConditionKeySchema,
  level: z.number().int().min(1).max(6).nullable(), // exhaustion only; null otherwise
  source: z.string().min(1).max(200),       // free text, e.g. "spell:hold-person", "hp-zero"
  expiresAt: ExpiryPointSchema.nullable(),
});

export const DamageTypeSchema = z.enum([
  "acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic",
  "piercing", "poison", "psychic", "radiant", "slashing", "thunder",
]);

// Each list holds unique types. Immunity wins over resistance and vulnerability.
export const DefenseSetSchema = z.object({
  resistances: z.array(DamageTypeSchema),
  vulnerabilities: z.array(DamageTypeSchema),
  immunities: z.array(DamageTypeSchema),
});

export const HitDicePoolSchema = z.object({
  die: z.union([z.literal(6), z.literal(8), z.literal(10), z.literal(12)]),
  total: z.number().int().min(0),
  remaining: z.number().int().min(0),       // refine: remaining <= total
});

export const SlotSchema = z.object({
  max: z.number().int().min(0),
  expended: z.number().int().min(0),        // refine: expended <= max
});

export const SpellSlotsSchema = z.object({
  // Keys "1".."9". A missing key means the combatant has no slots of that level.
  standard: z.record(z.enum(["1","2","3","4","5","6","7","8","9"]), SlotSchema),
  pact: z.object({ level: z.number().int().min(1).max(5), slot: SlotSchema }).nullable(),
});

export const CombatantSchema = z.object({
  id: CombatantIdSchema,
  name: z.string().min(1).max(100),
  hp: z.object({
    current: z.number().int().min(0),       // refine: current <= max
    max: z.number().int().min(1),
    temp: z.number().int().min(0),
  }),
  zeroHpRule: z.enum(["death-saves", "dies"]),
  lifeState: LifeStateSchema,
  deathSaves: z.object({
    successes: z.number().int().min(0).max(3),
    failures: z.number().int().min(0).max(3),
  }),
  conditions: z.array(ConditionInstanceSchema),
  conditionSeq: z.number().int().min(0),    // last issued instance number
  hitDice: z.array(HitDicePoolSchema),      // one pool per die size; sizes unique
  spellSlots: SpellSlotsSchema,
  initiativeBonus: z.number().int().min(-10).max(30),
  conModifier: z.number().int().min(-5).max(10),
  ac: z.number().int().min(1).max(40).nullable(),   // null: AC must come with the attack
  defenses: DefenseSetSchema,
});

export const InitiativeEntrySchema = z.object({
  combatantId: CombatantIdSchema,
  total: z.number().int(),
  bonus: z.number().int(),
});

export const EncounterSchema = z.object({
  round: z.number().int().min(1),
  turnIndex: z.number().int().min(0),       // refine: < order.length
  order: z.array(InitiativeEntrySchema).min(1),
  reactionsSpent: z.array(CombatantIdSchema).optional(), // Amended by spec 079 (TASK-0208): Reaction spent until that combatant's next turn start; absent = none
});

export const EngineStateSchema = z.object({
  v: z.literal(ENGINE_SCHEMA_VERSION),
  combatants: z.record(CombatantIdSchema, CombatantSchema), // key === combatant.id
  encounter: EncounterSchema.nullable(),
});
```

`emptyState()` returns `{ v: 1, combatants: {}, encounter: null }`.

State refinements (`superRefine`) that `INVALID_STATE` enforces: `hp.current <= hp.max`;
`remaining <= total`; `expended <= max`; unique hit-die sizes; record key equals
`combatant.id`; every encounter entry names an existing combatant; `turnIndex <
order.length`; each defense list holds unique damage types; `lifeState` is consistent with HP (`conscious` implies `hp.current > 0`;
`unconscious` and `stable` imply `hp.current === 0`).

## Dice parse result

```ts
export type DiceTerm =
  | { kind: "dice"; sign: 1 | -1; count: number; sides: number;
      keep: { mode: "highest" | "lowest"; n: number } | null }
  | { kind: "modifier"; value: number };            // value carries its sign

export type DiceParseResult =
  | { ok: true; terms: DiceTerm[] }
  | { ok: false; code: "INVALID_DICE_EXPRESSION" | "DICE_LIMIT_EXCEEDED"; message: string };
```

Grammar (whitespace ignored, case-insensitive `d`, `kh`, `kl`):

```
expression := term (("+" | "-") term)*      ; a leading "-" is allowed on the first term
term       := dice | integer
dice       := [integer] "d" integer [keep]
keep       := ("kh" | "kl") integer
```

Critical doubling lives in the dice layer: the internal roller takes
`{ mode, critical }`, and `critical: true` doubles every dice term's `count` (and its keep
`n`) before rolling. Modifiers are not doubled. The doubled expression must pass the limits
below; the check runs before any draw.

Limits (`DICE_LIMIT_EXCEEDED`): count 1..100, sides 1..1000, keep `n` 1..count, at most 20
terms, expression length at most 200 characters, each modifier at most 1000 in absolute
value. `0d6`, `1d0` and a keep `n` of 0 are `INVALID_DICE_EXPRESSION`.

## Consumer notes

- **TASK-0044** stores each engine event inside the mechanics envelope (version 1) of
  `specs/028-session-model/contracts/session-events.md` and rebuilds `EngineState` with
  `replay`. The engine event's `v` travels inside the envelope; the payload version is the
  envelope's own. The session row adds actor, seq, timestamp and visibility; the engine knows
  none of them. One `execute` result is appended atomically through `appendMechanicsBatch`.
- **TASK-0045** calls `execute` once per approved proposal and appends every returned event
  in order, or nothing on a refusal. It returns the refusal's `code` to the proposer.
- **TASK-0046** `adjudicate` supplies data only (expression, AC, DC, damage types, a
  defense set, a roll mode, a condition record); it never supplies a hit/miss verdict, a
  success/failure or an adjusted damage amount (orchestrator ruling 2026-10-25, research R8).
  `resolve` builds commands; `narrate` and `audit` read the ledger fields
  (`reason`, faces, `total`, `before`, `after`) and never call `execute` themselves.
