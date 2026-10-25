# Contract: engine commands

`EngineCommandSchema` is a `z.discriminatedUnion("type", [...])` of the 19 commands below.
Every command carries `reason: z.string().min(1).max(500)` — the ledger reason copied onto
every event it produces (decision-0021 idea 2). Commands carry no actor; the gate knows who
asked.

Shared fragments:

```ts
const Reason = z.string().min(1).max(500);
const Id = CombatantIdSchema;
const RollMode = z.enum(["normal", "advantage", "disadvantage"]).default("normal");
const Amount = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("fixed"), value: z.number().int().min(0).max(10000) }),
  z.object({ kind: z.literal("roll"), expression: z.string().min(1).max(200) }),
]);
const SlotLevel = z.number().int().min(1).max(9);
```

"Common refusals" below means the two every command can return: `INVALID_COMMAND` (schema
parse failure) and `INVALID_STATE` (state parse failure). Each table lists only the further
codes. Codes are defined in [refusals.md](refusals.md); events in [events.md](events.md).

## Dice

| Command | Fields | Events (in order) | Refusals |
|---|---|---|---|
| `roll` | `expression`, `mode: RollMode`, `reason` | `dice.rolled` | `INVALID_DICE_EXPRESSION`, `DICE_LIMIT_EXCEEDED`, `ADVANTAGE_NOT_APPLICABLE` |

A free-standing roll: attack rolls, checks, saves, any number the DM needs. It changes no
state. Advantage and disadvantage require exactly one dice term with `count 1`, `sides 20`,
no keep and a positive sign; the engine rolls it twice and keeps one.

## Combatants

| Command | Fields | Events | Refusals |
|---|---|---|---|
| `combatant.add` | `combatant: CombatantInit`, `reason` | `combatant.added` | `DUPLICATE_COMBATANT` |
| `combatant.remove` | `combatantId`, `reason` | `combatant.removed` | `UNKNOWN_COMBATANT`, `COMBATANT_IN_ENCOUNTER` |

```ts
const CombatantInit = z.object({
  id: Id,
  name: z.string().min(1).max(100),
  hp: z.object({
    max: z.number().int().min(1).max(10000),
    current: z.number().int().min(0).optional(),   // default max; refine <= max
    temp: z.number().int().min(0).optional(),      // default 0
  }),
  zeroHpRule: z.enum(["death-saves", "dies"]),
  initiativeBonus: z.number().int().min(-10).max(30).default(0),
  conModifier: z.number().int().min(-5).max(10).default(0),
  hitDice: z.array(z.object({
    die: z.union([z.literal(6), z.literal(8), z.literal(10), z.literal(12)]),
    total: z.number().int().min(0).max(40),
    remaining: z.number().int().min(0).optional(),  // default total
  })).default([]),
  spellSlots: z.object({
    standard: z.record(z.enum(["1","2","3","4","5","6","7","8","9"]),
                       z.number().int().min(0).max(10)).default({}),   // max per level
    pact: z.object({ level: z.number().int().min(1).max(5),
                     count: z.number().int().min(1).max(4) }).nullable().default(null),
  }).default({ standard: {}, pact: null }),
});
```

A combatant added with `current: 0` starts `unconscious` (death-saves rule) or `dead` (dies
rule); otherwise it starts `conscious`. Slots start unexpended; conditions start empty.

## Hit points

| Command | Fields | Events | Refusals |
|---|---|---|---|
| `damage.apply` | `targetId`, `amount: Amount`, `damageType?: string`, `critical: boolean = false`, `reason` | `dice.rolled`?, `hp.changed`, then any of `life-state.changed`, `death-saves.changed`, `condition.applied` | `UNKNOWN_COMBATANT`, `TARGET_DEAD`, dice codes |
| `healing.apply` | `targetId`, `amount: Amount`, `reason` | `dice.rolled`?, `hp.changed`, then any of `life-state.changed`, `death-saves.changed`, `condition.removed` | `UNKNOWN_COMBATANT`, `TARGET_DEAD`, dice codes |
| `temp-hp.grant` | `targetId`, `amount: Amount`, `reason` | `dice.rolled`?, `hp.changed` | `UNKNOWN_COMBATANT`, `TARGET_DEAD`, `TEMP_HP_NOT_HIGHER`, dice codes |

"Dice codes" are `INVALID_DICE_EXPRESSION` and `DICE_LIMIT_EXCEEDED`, possible only when
`amount.kind` is `roll`. A rolled amount is `max(0, total)`. The engine parses the expression
before it rolls, so a bad expression refuses with zero dice drawn.

`damageType` is recorded in the ledger only; resistance and vulnerability are adjudicated
before the command is built.

**Damage rules** (in order):

1. Temporary HP absorb damage first; the rest reduces `hp.current`, floored at 0.
2. Target `conscious`, HP reaches 0:
   - `zeroHpRule: "dies"` → `life-state.changed` to `dead`.
   - `death-saves` and the damage left over after reaching 0 is at least `hp.max` (massive
     damage) → `life-state.changed` to `dead`.
   - otherwise → `life-state.changed` to `unconscious`, then `condition.applied`
     (`unconscious`, source `"hp-zero"`) unless an `unconscious` instance already exists.
3. Target already at 0 HP (`unconscious` or `stable`), death-saves rule:
   - damage at least `hp.max` → `life-state.changed` to `dead`.
   - otherwise `death-saves.changed` adds 1 failure (2 if `critical`). A `stable` target
     first gets `life-state.changed` to `unconscious`. Reaching 3 failures →
     `life-state.changed` to `dead`.
4. An `amount` of 0 still emits `hp.changed` with equal before and after (the ledger shows
   the zero).

**Healing rules:** HP rise to at most `hp.max`; temporary HP are untouched. A target at 0 HP
that regains at least 1 HP gets `life-state.changed` to `conscious`, `death-saves.changed` to
0/0 (only if not already 0/0), and `condition.removed` for every `unconscious` instance with
source `"hp-zero"`.

**Temporary HP:** temporary HP never stack; the higher value wins.

- A `fixed` amount not strictly greater than the current `hp.temp` is refused with
  `TEMP_HP_NOT_HIGHER` (zero dice drawn).
- A `roll` amount cannot be compared before the draw, so it never refuses on that ground. The
  engine emits `dice.rolled`, then `hp.changed` with `after.temp = max(before.temp, rolled)`.
  When the roll is not higher, before and after are equal and the ledger shows the kept value.

## Conditions

| Command | Fields | Events | Refusals |
|---|---|---|---|
| `condition.apply` | `targetId`, `condition: ConditionKey` (not `exhaustion`), `source`, `expiresAt: ExpiryPoint \| null = null`, `reason` | `condition.applied` | `UNKNOWN_COMBATANT`, `TARGET_DEAD`, `CONDITION_ALREADY_PRESENT` |
| `condition.remove` | `targetId`, `condition: ConditionKey` (not `exhaustion`), `reason` | `condition.removed` (one per matching instance) | `UNKNOWN_COMBATANT`, `CONDITION_NOT_PRESENT` |
| `exhaustion.adjust` | `targetId`, `delta: int, -6..6, ≠ 0`, `reason` | `condition.applied`, `condition.changed` or `condition.removed`; then `life-state.changed` to `dead` at level 6 | `UNKNOWN_COMBATANT`, `TARGET_DEAD`, `EXHAUSTION_OUT_OF_RANGE` |

- `condition.apply` refuses a second instance of the same condition (conditions do not
  stack). Passing `condition: "exhaustion"` to `condition.apply` or `condition.remove` is
  `INVALID_COMMAND` (a schema refinement); exhaustion moves only through
  `exhaustion.adjust`.
- `condition.remove` on a dead target is allowed (cleanup).
- `exhaustion.adjust`: the new level is current level (0 if absent) plus `delta`. A result
  below 0 or above 6 is `EXHAUSTION_OUT_OF_RANGE`. 0 removes the instance; from 0 it applies
  one; otherwise it changes the level.
- Instance ids are `"<combatantId>#<n>"`, where `n` is `conditionSeq + 1`; the event carries
  the counter's before and after.

## Initiative and turns

| Command | Fields | Events | Refusals |
|---|---|---|---|
| `initiative.roll` | `participants: [{ combatantId, mode: RollMode }]` (1..50, unique), `reason` | one `dice.rolled` per participant in list order, then `encounter.started` | `ENCOUNTER_ACTIVE`, `UNKNOWN_COMBATANT`, `DUPLICATE_PARTICIPANT`, `TARGET_DEAD` |
| `initiative.join` | `combatantId`, `mode: RollMode`, `reason` | `dice.rolled`, `encounter.changed` | `NO_ACTIVE_ENCOUNTER`, `UNKNOWN_COMBATANT`, `ALREADY_IN_ENCOUNTER`, `TARGET_DEAD` |
| `turn.advance` | `reason` | `condition.removed` for each `turn-end` expiry of the outgoing turn, `turn.advanced`, `condition.removed` for each `turn-start` expiry of the incoming turn | `NO_ACTIVE_ENCOUNTER`, `NO_ELIGIBLE_COMBATANT` |
| `encounter.end` | `reason` | `condition.removed` for each instance with `expiresAt`, then `encounter.ended` | `NO_ACTIVE_ENCOUNTER` |

- Each participant rolls `1d20 + initiativeBonus` with its mode. Order: total descending,
  then bonus descending, then `combatantId` ascending. The encounter starts at round 1,
  `turnIndex` 0.
- `initiative.join` inserts by the same ordering. If the insert lands at or before the
  current `turnIndex`, `turnIndex` rises by 1, so the active combatant does not change.
- `turn.advance` moves to the next entry whose combatant is not `dead`, wrapping to a new
  round after the last entry. Turns skipped because the combatant is dead still cross that
  combatant's `turn-start` and `turn-end` expiry points. If every combatant in the order is
  dead, it refuses with `NO_ELIGIBLE_COMBATANT`.
- An expiry point matches when its `round`, `combatantId` and `boundary` equal the boundary
  being crossed.

## Life

| Command | Fields | Events | Refusals |
|---|---|---|---|
| `death-save.roll` | `targetId`, `mode: RollMode`, `reason` | `dice.rolled`, then `death-saves.changed` and any of `life-state.changed`, `hp.changed`, `condition.removed` | `UNKNOWN_COMBATANT`, `NOT_DYING` |
| `stabilize` | `targetId`, `reason` | `death-saves.changed`, `life-state.changed` | `UNKNOWN_COMBATANT`, `NOT_DYING` |

- "Dying" means `lifeState === "unconscious"` with `zeroHpRule: "death-saves"`. Anything
  else is `NOT_DYING` (including `TARGET_DEAD` cases: a dead target is not dying).
- `death-save.roll` rolls `1d20` with the mode. Natural 20: `hp.changed` 0→1,
  `death-saves.changed` to 0/0, `life-state.changed` to `conscious`, `condition.removed` for
  `hp-zero` unconscious instances. Natural 1: +2 failures. 10 or more: +1 success. Below 10:
  +1 failure. 3 successes → `death-saves.changed` to 0/0 and `life-state.changed` to
  `stable`. 3 failures → `life-state.changed` to `dead` (the tally keeps its 3).
- `stabilize` (a successful Medicine check or a spell, decided before the command):
  `death-saves.changed` to 0/0, `life-state.changed` to `stable`. The tally event is omitted
  when it is already 0/0.

## Rests

| Command | Fields | Events | Refusals |
|---|---|---|---|
| `rest.short` | `participants: [{ combatantId, spend: [{ die, count }] }]` (1..20, unique), `reason` | per participant: per die `dice.rolled`; `hit-dice.changed` per pool spent; `hp.changed` if any die was spent; `life-state.changed` and the healing side effects when HP leaves 0; `spell-slots.changed` for an expended pact slot. Last: `rest.completed` | `ENCOUNTER_ACTIVE`, `UNKNOWN_COMBATANT`, `DUPLICATE_PARTICIPANT`, `TARGET_DEAD`, `INSUFFICIENT_HIT_DICE` |
| `rest.long` | `participants: [combatantId]` (1..20, unique), `reason` | per participant, only for values that change: `hp.changed` (current to max, temp to 0), `death-saves.changed` to 0/0, `hit-dice.changed` per pool to `total`, `spell-slots.changed` per level and pool to 0 expended, exhaustion `condition.changed` or `condition.removed`. Last: `rest.completed` | `ENCOUNTER_ACTIVE`, `UNKNOWN_COMBATANT`, `DUPLICATE_PARTICIPANT`, `TARGET_DEAD`, `LONG_REST_REQUIRES_HP` |

- Short rest: each hit die heals `max(0, face + conModifier)`; the sum applies once as one
  `hp.changed` (cause `rest`), capped at max. `spend` with `count: 0` or an empty list is
  allowed (the rest still restores pact slots). A participant that changes nothing produces
  no per-participant events.
- Both rests end with one `rest.completed` event naming the rest kind and the participants.
  It changes no state; it marks the rest in the ledger and keeps the result non-empty when
  nothing else changed.
- Long rest requires `hp.current >= 1` (SRD 5.2.1). It restores all spent hit dice
  (SRD 5.2.1 rule; the 2014 rule restored half).

## Spell slots

| Command | Fields | Events | Refusals |
|---|---|---|---|
| `spell-slot.expend` | `targetId`, `pool: "standard" \| "pact"`, `level: SlotLevel`, `reason` | `spell-slots.changed` | `UNKNOWN_COMBATANT`, `TARGET_DEAD`, `SLOT_LEVEL_UNAVAILABLE`, `NO_SLOT_AVAILABLE` |
| `spell-slot.restore` | `targetId`, `pool`, `level`, `count: int 1..9 = 1`, `reason` | `spell-slots.changed` | `UNKNOWN_COMBATANT`, `TARGET_DEAD`, `SLOT_LEVEL_UNAVAILABLE`, `SLOT_NOT_EXPENDED` |

- `SLOT_LEVEL_UNAVAILABLE`: the combatant has no slot of that level in that pool (for
  `pact`, the pact pool is null or its level differs).
- `spell-slot.restore` refuses when `expended < count` (`SLOT_NOT_EXPENDED`); it never
  restores past max.
