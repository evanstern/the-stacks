# Contract: engine events (the roll ledger)

`EngineEventSchema` is a `z.discriminatedUnion("type", [...])` of the 16 events below. Every
event carries:

- `v: z.literal(1)` — the event schema version (constitution IV). A breaking change to one
  event's shape bumps that event's `v`, and `evolve` keeps handling the old version.
- `reason: string` — copied from the command (decision-0021 idea 2).

Every **state-change** event also carries `combatantId` (where it concerns one combatant) and
`before` and `after` values of exactly the slice it changed. `evolve` sets that slice to
`after` and does nothing else, so replay needs no rules and no RNG. The two **marker** events
(`dice.rolled`, `rest.completed`) change no state.

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
  purpose: z.enum(["check", "damage", "healing", "temp-hp", "initiative",
                   "death-save", "hit-die"]),
  combatantId: Id.nullable(),             // whose roll, when the command names one
  terms: z.array(DiceTermResult),
  total: z.number().int(),
  natural: z.number().int().nullable(),   // the kept d20 face when the expression has one
                                          // 1d20 term (advantage included); else null
});

z.object({
  type: z.literal("rest.completed"), v: z.literal(1), reason: Reason,
  kind: z.enum(["short", "long"]),
  participants: z.array(Id),
});
```

Under advantage or disadvantage, the d20 term shows `count: 1`, two `faces` and one `true` in
`kept`. `purpose: "check"` is the `roll` command's purpose (attacks, checks and saves alike).

## State-change events

| Event | Slice | `before` | `after` | Extra fields |
|---|---|---|---|---|
| `combatant.added` | `combatants[id]` | `null` | `Combatant` | `combatantId` |
| `combatant.removed` | `combatants[id]` | `Combatant` | `null` | `combatantId` |
| `hp.changed` | `hp.current`, `hp.temp` | `{ current, temp }` | `{ current, temp }` | `combatantId`, `cause: "damage" \| "healing" \| "temp-hp" \| "death-save" \| "rest"`, `amount: int` (the applied amount before temp/HP split and caps), `damageType: string \| null`, `critical: boolean`, `rollIndex` |
| `life-state.changed` | `lifeState` | `LifeState` | `LifeState` | `combatantId` |
| `death-saves.changed` | `deathSaves` | `{ successes, failures }` | `{ successes, failures }` | `combatantId`, `rollIndex` |
| `condition.applied` | one instance; `conditionSeq` | `null` | `ConditionInstance` | `combatantId`, `conditionSeq: { before, after }` |
| `condition.changed` | one instance (exhaustion level) | `ConditionInstance` | `ConditionInstance` | `combatantId` |
| `condition.removed` | one instance | `ConditionInstance` | `null` | `combatantId`, `cause: "command" \| "expired" \| "healed" \| "encounter-ended" \| "rest"` |
| `hit-dice.changed` | one pool's `remaining` | `{ die, remaining }` | `{ die, remaining }` | `combatantId` |
| `spell-slots.changed` | one slot's `expended` | `{ pool, level, expended }` | `{ pool, level, expended }` | `combatantId` |
| `encounter.started` | `encounter` | `null` | `Encounter` | — |
| `encounter.changed` | `encounter` | `Encounter` | `Encounter` | `combatantId` (the joiner) |
| `turn.advanced` | `encounter.round`, `encounter.turnIndex` | `{ round, turnIndex, combatantId }` | `{ round, turnIndex, combatantId }` | `skipped: Id[]` (dead combatants passed over) |
| `encounter.ended` | `encounter` | `Encounter` | `null` | — |

Notes:

- `hp.changed.amount` is the requested amount after the roll and the 0 floor: for damage of
  12 against 5 temp HP and 4 HP, `amount` is 12, `before` is `{4, 5}` and `after` is `{0, 0}`.
- `condition.removed` for `exhaustion` at level 0 uses `cause: "command"` or `"rest"`.
- `turn.advanced.after.combatantId` is the new active combatant. TASK-0045 reads it for
  turn-mode commit authority.
- The ordering of events within one result is part of the contract (see commands.md). A
  projection may rely on it.

## Example: damage that drops a PC

Command: `{ type: "damage.apply", targetId: "pc-ana", amount: { kind: "roll", expression:
"2d6+2" }, critical: false, damageType: "slashing", reason: "goblin scimitar hit" }`.
Scripted faces: 4, 3. Ana has 7 HP, 0 temp, max 12.

```json
[
  { "type": "dice.rolled", "v": 1, "reason": "goblin scimitar hit", "expression": "2d6+2",
    "mode": "normal", "purpose": "damage", "combatantId": "pc-ana",
    "terms": [
      { "kind": "dice", "sign": 1, "count": 2, "sides": 6, "keep": null,
        "faces": [4, 3], "kept": [true, true], "subtotal": 7 },
      { "kind": "modifier", "value": 2 }],
    "total": 9, "natural": null },
  { "type": "hp.changed", "v": 1, "reason": "goblin scimitar hit", "combatantId": "pc-ana",
    "cause": "damage", "amount": 9, "damageType": "slashing", "critical": false,
    "rollIndex": 0, "before": { "current": 7, "temp": 0 }, "after": { "current": 0, "temp": 0 } },
  { "type": "life-state.changed", "v": 1, "reason": "goblin scimitar hit",
    "combatantId": "pc-ana", "before": "conscious", "after": "unconscious" },
  { "type": "condition.applied", "v": 1, "reason": "goblin scimitar hit",
    "combatantId": "pc-ana", "conditionSeq": { "before": 0, "after": 1 }, "before": null,
    "after": { "instanceId": "pc-ana#1", "condition": "unconscious", "level": null,
               "source": "hp-zero", "expiresAt": null } }
]
```

(Remaining damage after 0 HP is 2, below max 12, so no massive-damage death.)
