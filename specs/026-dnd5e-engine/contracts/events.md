# Contract: engine events (the roll ledger)

`EngineEventSchema` is a `z.discriminatedUnion("type", [...])` of the 18 events below. Every
event carries:

- `v: z.literal(1)` — the event schema version (constitution IV). A breaking change to one
  event's shape bumps that event's `v`, and `evolve` keeps handling the old version.
- `reason: string` — copied from the command (decision-0021 idea 2).

Every **state-change** event also carries `combatantId` (where it concerns one combatant) and
`before` and `after` values of exactly the slice it changed. `evolve` sets that slice to
`after` and does nothing else, so replay needs no rules and no RNG. The four **marker** events
(`dice.rolled`, `attack.resolved`, `check.resolved`, `rest.completed`) change no state.

Events reference an earlier roll in the same result through `rollIndex: number | null`: the
index, within that `execute` result's `events` array, of the `dice.rolled` event that produced
the number. TASK-0046's audit node uses it to tie narration to dice.

## Marker events

```ts
const DiceTermResult = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("dice"),
    sign: z.union([z.literal(1), z.literal(-1)]),
    count: z.number().int(), sides: z.number().int(),
    keep: z.object({ mode: z.enum(["highest", "lowest"]), n: z.number().int() }).nullable(),
    faces: z.array(z.number().int()),     // every face rolled, in draw order
    kept: z.array(z.boolean()),           // parallel to faces
    subtotal: z.number().int(),           // sign * sum(kept faces)
  }),
  z.object({ kind: z.literal("modifier"), value: z.number().int() }),
]);

z.object({
  type: z.literal("dice.rolled"), v: z.literal(1), reason: Reason,
  expression: z.string(),                 // as given, trimmed
  mode: z.enum(["normal", "advantage", "disadvantage"]),
  purpose: z.enum(["roll", "attack", "check", "save", "damage", "healing", "temp-hp",
                   "initiative", "death-save", "hit-die"]),
  critical: z.boolean(),                  // true when the dice layer doubled the dice
  combatantId: Id.nullable(),             // whose roll, when the command names one
  terms: z.array(DiceTermResult),
  total: z.number().int(),
  natural: z.number().int().nullable(),   // the kept d20 face when the expression has one
                                          // 1d20 term (advantage included); else null
});

z.object({
  type: z.literal("attack.resolved"), v: z.literal(1), reason: Reason,
  attackerId: Id.nullable(), targetId: Id,
  rollIndex: z.number().int(),            // its dice.rolled event
  ac: z.number().int(), acSource: z.enum(["command", "record"]),
  total: z.number().int(), natural: z.number().int(),
  outcome: z.enum(["hit", "miss", "critical-hit"]),
  reaction: z.boolean().optional(),       // Amended by spec 079 (TASK-0208): present and true only on a reaction attack
});

z.object({
  type: z.literal("check.resolved"), v: z.literal(1), reason: Reason,
  combatantId: Id.nullable(),
  kind: z.enum(["ability-check", "saving-throw"]),
  ability: z.enum(["str", "dex", "con", "int", "wis", "cha"]), skill: z.string().nullable(),
  rollIndex: z.number().int().nullable(),      // null when autoFail
  dc: z.number().int(),
  total: z.number().int().nullable(),          // null when autoFail
  natural: z.number().int().nullable(),        // null when autoFail
  autoFail: z.object({ reason: Reason }).nullable(),
  outcome: z.enum(["success", "failure"]),     // always "failure" when autoFail
  margin: z.number().int().nullable().optional(), // Amended by specs/070-stakes-before-dice: total minus dc; null with no roll
  band: OutcomeBand.optional(),                  // Amended by specs/070-stakes-before-dice: absent on rows written before it
});

z.object({
  type: z.literal("rest.completed"), v: z.literal(1), reason: Reason,
  kind: z.enum(["short", "long"]),
  participants: z.array(Id),
});
```

Under advantage or disadvantage, the d20 term shows `count: 1`, two `faces` and one `true` in
`kept`. `purpose` names the command that rolled: `roll` for the free-standing `roll`
command, `attack` for `attack.roll`, `check` or `save` for `check.roll`. With `critical: true`
the dice terms show the doubled `count` (a `2d6` crit shows `count: 4` and four faces), and
`expression` stays the expression as given.

## State-change events

| Event | Slice | `before` | `after` | Extra fields |
|---|---|---|---|---|
| `combatant.added` | `combatants[id]` | `null` | `Combatant` | `combatantId` |
| `combatant.removed` | `combatants[id]` | `Combatant` | `null` | `combatantId` |
| `hp.changed` | `hp.current`, `hp.temp` | `{ current, temp }` | `{ current, temp }` | `combatantId`, `cause: "damage" \| "healing" \| "temp-hp" \| "death-save" \| "rest"`, `amount: int` (the total applied before the temp/HP split and caps), `rawAmount: int \| null` (damage only: the total before defenses), `components` (damage only, else `null`; see below), `defensesSource: "command" \| "record" \| null` (damage only), `critical: boolean`, `rollIndex` (healing and temp HP: the roll, or `null`; damage: `null`, see `components`) |
| `life-state.changed` | `lifeState` | `LifeState` | `LifeState` | `combatantId` |
| `death-saves.changed` | `deathSaves` | `{ successes, failures }` | `{ successes, failures }` | `combatantId`, `rollIndex` |
| `condition.applied` | one instance; `conditionSeq` | `null` | `ConditionInstance` | `combatantId`, `conditionSeq: { before, after }` |
| `condition.changed` | one instance (exhaustion level) | `ConditionInstance` | `ConditionInstance` | `combatantId` |
| `condition.removed` | one instance | `ConditionInstance` | `null` | `combatantId`, `cause: "command" \| "expired" \| "healed" \| "encounter-ended" \| "rest"` |
| `hit-dice.changed` | one pool's `remaining` | `{ die, remaining }` | `{ die, remaining }` | `combatantId` |
| `spell-slots.changed` | one slot's `expended` | `{ pool, level, expended }` | `{ pool, level, expended }` | `combatantId` |
| `encounter.started` | `encounter` | `null` | `Encounter` | — |
| `encounter.changed` | `encounter` | `Encounter` | `Encounter` | `combatantId` (the joiner, the leaver, the reactor that spent its Reaction, or the incoming combatant whose Reaction reset). Amended by spec 079 (TASK-0208): `Encounter.reactionsSpent` rides `before` and `after` |
| `turn.advanced` | `encounter.round`, `encounter.turnIndex` | `{ round, turnIndex, combatantId }` | `{ round, turnIndex, combatantId }` | `skipped: Id[]` (dead combatants passed over) |
| `encounter.ended` | `encounter` | `Encounter` | `null` | — |

Damage components on `hp.changed` (one per command component, in order):

```ts
z.object({
  damageType: DamageTypeSchema,
  raw: z.number().int().min(0),
  applied: z.number().int().min(0),
  adjustment: z.enum(["none", "immune", "resisted", "vulnerable", "resisted-and-vulnerable"]),
  rollIndex: z.number().int().nullable(),   // null for a fixed component
});
```

Notes:

- `hp.changed.amount` is the amount after the roll, the 0 floor and (for damage) defenses:
  for 12 applied damage against 5 temp HP and 4 HP, `amount` is 12, `before` is `{4, 5}` and
  `after` is `{0, 0}`. `rawAmount` is the sum of `components[].raw`; `amount` is the sum of
  `components[].applied`.
- `condition.removed` for `exhaustion` at level 0 uses `cause: "command"` or `"rest"`.
- `turn.advanced.after.combatantId` is the new active combatant. TASK-0045 reads it for
  turn-mode commit authority.
- The ordering of events within one result is part of the contract (see commands.md). A
  projection may rely on it.

## Example: damage that drops a PC

Command: `{ type: "damage.apply", targetId: "pc-ana", components: [{ amount: { kind: "roll",
expression: "2d6+2" }, damageType: "slashing" }], critical: false, defenses: null, reason:
"goblin scimitar hit" }`. Scripted faces: 4, 3. Ana has 7 HP, 0 temp, max 12, no defenses.

```json
[
  { "type": "dice.rolled", "v": 1, "reason": "goblin scimitar hit", "expression": "2d6+2",
    "mode": "normal", "purpose": "damage", "critical": false, "combatantId": "pc-ana",
    "terms": [
      { "kind": "dice", "sign": 1, "count": 2, "sides": 6, "keep": null,
        "faces": [4, 3], "kept": [true, true], "subtotal": 7 },
      { "kind": "modifier", "value": 2 }],
    "total": 9, "natural": null },
  { "type": "hp.changed", "v": 1, "reason": "goblin scimitar hit", "combatantId": "pc-ana",
    "cause": "damage", "amount": 9, "rawAmount": 9, "defensesSource": "record",
    "components": [{ "damageType": "slashing", "raw": 9, "applied": 9,
                     "adjustment": "none", "rollIndex": 0 }],
    "critical": false, "rollIndex": null, "before": { "current": 7, "temp": 0 }, "after": { "current": 0, "temp": 0 } },
  { "type": "life-state.changed", "v": 1, "reason": "goblin scimitar hit",
    "combatantId": "pc-ana", "before": "conscious", "after": "unconscious" },
  { "type": "condition.applied", "v": 1, "reason": "goblin scimitar hit",
    "combatantId": "pc-ana", "conditionSeq": { "before": 0, "after": 1 }, "before": null,
    "after": { "instanceId": "pc-ana#1", "condition": "unconscious", "level": null,
               "source": "hp-zero", "expiresAt": null } }
]
```

(Remaining damage after 0 HP is 2, below max 12, so no massive-damage death.)

## Amendment 2026-11-02 (specs/070-stakes-before-dice, TASK-0127): outcome bands

Amended by specs/070-stakes-before-dice. `OutcomeBand` is `success | success-at-cost | failure |
severe-failure`. `check.resolved` gains optional `margin` and `band`; `v` stays 1 and old rows parse
without them. `outcome` stays the two-value result: `success-at-cost` reads `success`, `severe-failure`
reads `failure`. An auto-fail row carries band `failure`; an auto-success row carries band `success`.

## Amended by specs/082-engine-derived-numbers (TASK-0104)

`check.resolved` gains optional `difficulty`. `attack.resolved` gains optional `attack` (the entry
name). `combatant.added`'s `after` carries optional `stats`. `v` stays 1; old rows parse.

## Amended by specs/083-spells-by-srd-id (TASK-0105)

`attack.resolved` and `check.resolved` gain optional `spellId` (the SRD spell id of a `spell.cast`).
`hp.changed` gains optional `half: true` (the damage was halved, rounded down, before defenses).
`v` stays 1; old rows parse. `spell.cast` emits only existing event types.
