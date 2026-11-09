# Contract: engine encounter surface (spec 099)

The additive engine surface TASK-0274 ships. Minor and additive: no existing command, event or
refusal changes shape. The planner (TASK-0267, spec 097) and the session-model gate read it.

## Schema additions (`src/schema/state.ts`)

```ts
export const SideSchema = z.enum(["party", "hostile", "neutral"]);
export type Side = z.infer<typeof SideSchema>;

// CombatantSchema: new optional field
side: SideSchema.optional(),
```

`CombatantInit` (`src/schema/commands.ts`) gains the same optional `side`.

## Commands (`src/schema/commands.ts`)

| type | fields | refusals | events |
|---|---|---|---|
| `combatant.side` | `combatantId: Id`, `side: Side`, `reason` | `UNKNOWN_COMBATANT`; `INVALID_COMMAND` (no change) | `combatant.sided` |
| `combatant.depart` | `combatantId: Id`, `reason` | `UNKNOWN_COMBATANT`; `INVALID_COMMAND` (not in order, not placed) | the `initiative.leave` events, or the `encounter.end` events when no living combatant would remain; then `combatant.placed` (`after: null`) when placed |
| `stand` | `combatantId: Id`, `reason` | `UNKNOWN_COMBATANT`; `CONDITION_NOT_PRESENT`; in an encounter: `MOVE_OFF_TURN`, `STAT_UNDEFINED`, `MOVE_OVER_SPEED` | `condition.removed` (cause `command`) per prone instance; in an encounter, then `encounter.changed` (movement cost) |

No command draws dice.

## Events (`src/schema/events.ts`)

```ts
z.object({
  type: z.literal("combatant.sided"),
  v: V,
  reason: Reason,
  combatantId: Id,
  before: SideSchema.nullable(),
  after: SideSchema,
}),
```

`evolve`: `combatants[id].side = after`. The session-model catalog derives the new type from the
engine schema (mechanics count +1, catalog count +1). Visibility `any`.

## Selectors (new `src/sides.ts`, exported from `src/index.ts`)

```ts
/** party vs hostile, either way round. Neutral or missing sides oppose no one. */
export function areHostile(a: Combatant, b: Combatant): boolean;

/** Hostile combatants in the encounter order with lifeState "conscious", in order. [] with no encounter. */
export function hostilesStanding(state: EngineState): string[];

/** Active encounter, at least one sided combatant in the order, no hostile standing. */
export function encounterOver(state: EngineState): boolean;

/**
 * SRD 5.2.1 playing-the-game.combat.ranged-attacks.ranged-attacks-in-close-combat.
 * Combatants in the attacker's zone that oppose it, are conscious, not unable (isUnable),
 * and not blinded. [] when the attacker is invisible, unplaced or sideless.
 * ponytail: "within 5 feet" is "same zone" (spec 094 band engaged); grid mode (R5) measures feet.
 */
export function closeCombatFoes(state: EngineState, attackerId: string): string[];
```

## The planner seam (TASK-0267)

- The planner reads `closeCombatFoes` and `foldMode` from `@the-stacks/dnd5e-engine`. It owns no
  hostility logic of its own.
- An `attack` Intent whose resolved entry is ranged (FR-022) gets
  `mode = foldMode(intent.mode, closeCombatFoes(state, actor).length ? ["disadvantage"] : [])`.
- A `stand` Intent maps to `{ type: "stand", combatantId: actor, reason }`.
- If the operator rules OQ-1 for the engine, the rule moves into `attackModeSources` and the
  planner adds nothing for AC #4. The selector signature does not change.

## The session-model seam (`gate/plan.ts`, `scene-presence`)

| new presence | condition | command |
|---|---|---|
| `absent` (`left`, `fled`, `removed`) | combatant in the order or placed | `combatant.depart` |
| `yielded` (`surrendered`, `conceded`) | combatant side is `hostile` | `combatant.side` `neutral` |
| `present` (`arrived`) | encounter active, not in order, combatant exists | `initiative.join` (unchanged) |
