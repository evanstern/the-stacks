# Data model: pure 5e engine package

The binding Zod shapes are in [contracts/engine-api.md](contracts/engine-api.md) (state),
[contracts/commands.md](contracts/commands.md) and [contracts/events.md](contracts/events.md).
This file explains the entities, their relationships and their state transitions.

## Entities

```
EngineState (v: 1)
 ├── combatants: Record<id, Combatant>
 │     ├── hp { current, max, temp }
 │     ├── ac: int | null                    (null: attacks must carry targetAc)
 │     ├── defenses { resistances, vulnerabilities, immunities }  (damage types)
 │     ├── zeroHpRule: death-saves | dies
 │     ├── lifeState: conscious | unconscious | stable | dead
 │     ├── deathSaves { successes 0..3, failures 0..3 }
 │     ├── conditions: ConditionInstance[]   (instanceId, condition, level, source, expiresAt)
 │     ├── conditionSeq                      (instance id counter)
 │     ├── hitDice: [{ die, total, remaining }]
 │     ├── spellSlots { standard: {"1".."9": {max, expended}}, pact: {level, slot} | null }
 │     ├── initiativeBonus
 │     └── conModifier
 └── encounter: { round, turnIndex, order: [{ combatantId, total, bonus }] } | null
```

- The state lives in the **session plane** (constitution III). TASK-0044 holds it as a
  projection built by `replay` over the engine events in the session log. The engine itself
  stores nothing.
- `Combatant` is a mechanical record, not a codex entity: it has no portrayal or hooks
  (constitution II does not apply). M4 sheets will build `combatant.add` commands from codex
  characters.
- A condition instance belongs to exactly one combatant. An expiry point names a round, a
  combatant whose turn boundary ends it, and the boundary.

## Damage pipeline (per component, research R8)

```
 Amount ──roll (dice doubled on critical)──▶ raw = max(0, total)
        ──defense set (command's, else record's)──▶ immune → 0
                                                     else resisted → floor(raw/2)
                                                     then vulnerable → ×2
        ──▶ applied ──sum over components──▶ temp HP first, then HP
```

## Life-state transitions

```
             damage to 0 (death-saves)                 3 failures / massive damage
 conscious ─────────────────────────────▶ unconscious ─────────────────────────────▶ dead
     ▲   ▲                                 │   ▲   │
     │   │      healing ≥1 / natural 20    │   │   │ 3 successes / stabilize
     │   └─────────────────────────────────┘   │   ▼
     │                                     damage stable
     │              healing ≥1                  │
     └──────────────────────────────────────────┘

 conscious ──damage to 0 (dies rule)──▶ dead
 any ──exhaustion level 6──▶ dead
```

- `dead` is terminal. No command leaves it; only `combatant.remove` and `condition.remove`
  accept a dead target.
- Entering `unconscious` from `conscious` applies an `unconscious` condition with source
  `"hp-zero"`. Leaving 0 HP removes it. An `unconscious` condition from another source (a
  sleep spell) is independent of life state and untouched.

## Encounter transitions

```
 null ──initiative.roll──▶ { round 1, turnIndex 0 } ──turn.advance──▶ next living entry
                                │                                      (round+1 on wrap)
                                ├──initiative.join──▶ order grows; active unchanged
                                └──encounter.end──▶ null (round-expiry conditions removed)
```

## Invariants the state schema enforces (INVALID_STATE)

Listed in contracts/engine-api.md, "State refinements". The key ones: HP within `0..max`;
`lifeState` agrees with HP; expended slots and remaining hit dice within their maxima;
encounter entries name existing combatants; `turnIndex` within the order.

## Event-to-slice map (what `evolve` writes)

| Event | Writes |
|---|---|
| `combatant.added` / `combatant.removed` | `combatants[id]` = `after` (or delete) |
| `hp.changed` | `hp.current`, `hp.temp` |
| `life-state.changed` | `lifeState` |
| `death-saves.changed` | `deathSaves` |
| `condition.applied` | push `after`; `conditionSeq` = `conditionSeq.after` |
| `condition.changed` | replace instance by `instanceId` |
| `condition.removed` | drop instance by `instanceId` |
| `hit-dice.changed` | the pool with `die` → `remaining` |
| `spell-slots.changed` | the slot at `pool`/`level` → `expended` |
| `encounter.started` / `encounter.changed` / `encounter.ended` | `encounter` = `after` |
| `turn.advanced` | `encounter.round`, `encounter.turnIndex` |
| `dice.rolled`, `attack.resolved`, `check.resolved`, `rest.completed` | nothing (markers) |
