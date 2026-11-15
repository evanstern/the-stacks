# Implementation Plan: Engine action economy and Dodge

**Spec**: `specs/117-action-economy-dodge/spec.md` | **Card**: TASK-0304 | **Branch**: `task-0304-action-economy`
**Authored against**: `origin/main` `b7102dc0`.

## Summary

The engine gains an `economy` record for the active turn (the `movement` pattern), an
`action.spend` command and the `ACTION_SPENT` refusal. It gains a `dodging` list (the
`reactionsSpent` pattern), a `dodge` command, `isDodging`, and four roll mode sources. `SPELLS`
entries gain `castingTime`. The planner gains a cost table, refuses `NO_ACTION_LEFT` and
`NO_BONUS_ACTION_LEFT` before the handler, appends `action.spend` as the last command of a costed
plan, and serves `dodge`. Two tests replay the hosted double attack. No migration, no new dependency,
no new event type, no prompt change, no Intent schema change.

## Constitution Check (3.0.0)

| Principle | Verdict |
|---|---|
| I Agent-operable | Pass. The refusal is a structured code on the existing `intent` request. |
| II One Intent vocabulary | Pass. `packages/intent` changes one engine-status string. Both refusal codes already exist. |
| III Event-sourced, server authority | Pass. Every change rides `encounter.changed`. `evolve` and `replay` need no new case. |
| IV Three data planes | Pass. No plane touched. |
| V Many views, one state | Pass. No view change. TASK-0275 reads `economy` for pips. |
| VI Engine owns the numbers | Pass, strengthened. The engine owns the per-turn limit and Dodge's modes. Scripted-dice tests pin each. |
| VII Narration around facts | Pass. A refused Intent writes nothing to narrate. |
| VIII Campaign is data | Pass. Seeds unchanged. |
| IX UX quality bar | Pass. A second attack is refused at once with a reason. |
| X Grounded claims carry citations | Pass. Each rule cites its SRD 5.2.1 record. |
| XI Operator-owned content | Pass. |
| XII Self-hostable | Pass. |
| XIII Plan just-in-time | Pass. Extra Attack, Multiattack and the one-slot rule wait for a trigger (spec OQ-1, OQ-2). |

## Design

### D1 — Engine state (`src/schema/state.ts`)

In `EncounterSchema`, after `movement`:

```ts
// Spec 117: the active combatant's Action and Bonus Action this turn. A record whose round or
// combatantId differs from the active turn reads as nothing used.
economy: z
  .object({
    combatantId: CombatantIdSchema,
    round: z.number().int().min(1),
    actionUsed: z.boolean(),
    bonusActionUsed: z.boolean(),
  })
  .optional(),
// Spec 117: combatants that took the Dodge action, until the start of their next turn
// (SRD 5.2.1 playing-the-game.actions).
dodging: z.array(CombatantIdSchema).optional(),
```

`encounter.changed` carries the whole `Encounter` in `before` and `after`, so `evolve` needs no
change.

### D2 — Commands and refusal (`src/schema/commands.ts`, `src/schema/refusals.ts`)

Add two members to `EngineCommandSchema`, after `movement.action`:

```ts
z.object({
  // Spec 117: spend the active combatant's Action or Bonus Action. The planner adds it last.
  type: z.literal("action.spend"),
  combatantId: Id,
  cost: z.enum(["action", "bonus-action"]),
  reason: Reason,
}),
z.object({
  // Spec 117: the Dodge action. It spends nothing; the planner appends action.spend.
  type: z.literal("dodge"),
  combatantId: Id,
  reason: Reason,
}),
```

Append `"ACTION_SPENT"` to `RefusalCodeSchema`.

### D3 — Handlers (`src/commands/economy.ts`, new)

One new module holds `actionsLeft`, `isDodging`, `handleActionSpend` and `handleDodge`. It imports
`isUnable`/`actorUnable` from `./attacks.js` and `effectiveSpeed` from `./move.js`. `attacks.ts` and
`spells.ts` import `isDodging` from it. The import cycle is function-only, like the existing
`sides.ts` ↔ `attacks.ts` pair.

```ts
type Cost = "action" | "bonus-action";

/** The economy record of the active turn, or null when it is stale or absent (the movement rule). */
function currentEconomy(state: EngineState, id: string) { /* mirror currentMovement in move.ts */ }

/** Spec 117 FR-005. null outside an encounter or for an id not in the order. */
export function actionsLeft(state, id): { action: boolean; bonusAction: boolean } | null;

/** Spec 117 FR-010. */
export function isDodging(state, id): boolean {
  const c = state.combatants[id];
  if (!c || !state.encounter?.dodging?.includes(id)) return false;
  // ponytail: the benefit is computed, not removed. If Incapacitated or Speed 0 ends before the
  // dodger's next turn, the benefit returns. Emit a removal when a condition hook exists.
  return !isUnable(c) && effectiveSpeed(c) !== 0;
}
```

- `handleActionSpend`: refusal order per spec FR-003. Use `actorUnable(state, id, "actor")`; widen
  the `role` union in `attacks.ts` with `"actor"`. The `ACTION_SPENT` message is
  `` `"${id}" has used its ${cost === "action" ? "Action" : "Bonus Action"} this turn` ``. On
  success emit one `encounter.changed` with `combatantId: id`, `before: enc`, and
  `after: { ...enc, economy: { ...base, [slot]: true } }`, where `base` is `currentEconomy(...)` or
  the fresh record, and `slot` is `actionUsed` or `bonusActionUsed`.
- `handleDodge`: refusal order per spec FR-008. On success emit one `encounter.changed` with
  `after: { ...enc, dodging: [...new Set([...(enc.dodging ?? []), id])] }`.
- Register both in `execute.ts` `handlers`: `"action.spend": handleActionSpend`, `dodge: handleDodge`.
- Export `actionsLeft` and `isDodging` from `src/index.ts`, plus `effectiveSpeed` if not already
  exported (it is, via `./commands/move.js`).

### D4 — Clears (`src/commands/encounter.ts`)

- Rename nothing. Extend `withoutSpent` to return both slices:
  `Pick<Encounter, "reactionsSpent" | "dodging">`, filtering each list that is present. The two
  callers (`leaveEvents`, `handleTurnAdvance`) then clear dodging with no other edit.
- In `handleTurnAdvance`, change the guard
  `if (enc.reactionsSpent?.includes(incoming.combatantId))` to also fire when
  `enc.dodging?.includes(incoming.combatantId)`. Update its comment: the Reaction returns and Dodge
  ends at the start of its owner's turn (SRD 5.2.1 p. 10; playing-the-game.actions).

### D5 — Roll sources (`src/commands/attacks.ts`, `src/commands/spells.ts`)

- `handleAttackRoll`, inside the `command.attack !== undefined` branch, add to the `foldMode` list:
  `...(isDodging(state, command.targetId) ? (["disadvantage"] as ModeSource[]) : [])`.
- `handleCheckRoll`, inside the derived branch, add:
  `...(command.kind === "saving-throw" && command.ability === "dex" && isDodging(state, command.combatantId) ? (["advantage"] as ModeSource[]) : [])`.
- `spells.ts` attack delivery (line ~131): add the same `disadvantage` source for `target.id`.
- `spells.ts` save delivery (line ~215): add `advantage` when `d.ability === "dex"` and
  `isDodging(state, target.id)`.

Do not touch `attackModeSources` or `checkModeSources` in `derive.ts`. They read one combatant, not
the encounter.

### D6 — Casting time (`src/spells.ts`)

Add `castingTime: z.enum(["action", "bonus-action"])` to `SpellMechanicsSchema` after `level`. Set
`healing-word` to `"bonus-action"` and the other five to `"action"`. In
`apps/server/test/dm/spell-mechanics.test.ts`, add
`expect(rec.castingTime).toBe(m.castingTime === "action" ? "Action" : "Bonus Action")`.

### D7 — Planner cost and check (`packages/planner/src/economy.ts`, new; `src/plan.ts`)

```ts
import { actionsLeft, SPELLS } from "@the-stacks/dnd5e-engine";
import type { Intent, IntentKind } from "@the-stacks/intent";

export type ActionCost = "action" | "bonus-action";

// Spec 117 "Cost table". ponytail: Utilize is an action; add a cost when a ruling plans commands
// for attempt or use_object.
const ACTION_KINDS = new Set<IntentKind>([
  "attack", "check", "contest", "dash", "disengage", "dodge",
  "grapple", "help", "hide", "search", "shove",
]);

export function actionCostOf(intent: Intent): ActionCost | null {
  if (intent.kind === "cast") return SPELLS[intent.params.spell]?.castingTime ?? "action";
  return ACTION_KINDS.has(intent.kind) ? "action" : null;
}
```

In `planCtx`, after the `!handler` refusal:

```ts
const cost = actionCostOf(c.intent);
const spender = cost ? activeSpender(c) : null; // the actor's combatantId when it is the active combatant, else null
if (cost && spender) {
  const left = actionsLeft(c.state.engine, spender);
  if (left && !(cost === "action" ? left.action : left.bonusAction)) {
    return refuse(
      cost === "action" ? "NO_ACTION_LEFT" : "NO_BONUS_ACTION_LEFT",
      cost === "action" ? "no Action left this turn" : "no Bonus Action left this turn",
      { combatantId: spender, cost },
    );
  }
}
const result = handler(c);
if (!cost || !spender || result.kind !== "commands") return result;
return {
  ...result,
  commands: [
    ...result.commands,
    { command: { type: "action.spend", combatantId: spender, cost, reason: c.reason } },
  ],
};
```

`activeSpender(c)`: `actorIdOf(c.intent)` → `c.state.actors[id]?.combatantId`; return it when
`c.state.engine.encounter` exists and
`encounter.order[encounter.turnIndex]?.combatantId === combatantId`, else `null`. Put it in
`economy.ts`. Export `actionCostOf` and `ActionCost` from `src/index.ts`.

A ruling replans through `c.replan`, which is `planCtx`, so the stored Intent is costed (FR-017).
The `ruling` kind itself costs nothing, so the spend is counted once.

### D8 — Planner Dodge (`src/kinds.ts`, `src/movement.ts`, `src/plan.ts`)

- `kinds.ts`: move `"dodge"` from `unserved` to `served`.
- `movement.ts`: add
  ```ts
  export const dodge: Handler = (c) => {
    const who = resolveActor(c);
    if (!who.ok) return who.result;
    return commands(
      [{ type: "dodge", combatantId: who.value.combatantId, reason: c.reason }],
      who.value.facts,
    );
  };
  ```
- `plan.ts`: register `dodge` in `HANDLERS`.
- `packages/intent/src/kinds.ts`: `dodge` → `engine("served", "dodge")`.

### D9 — Gate (`packages/session-model`)

No code change. `planIntent` already maps a planner refusal to `source: "gate"` and runs commands in
order. `action.spend` is the last command, so a refused first command still writes nothing, and the
spend's `encounter.changed` becomes a mechanics row before the carrier.

### D10 — Tests

- `packages/dnd5e-engine/test/commands/economy.test.ts` (new): SC-001 and SC-002. Use the
  `reactions.test.ts` helpers (`stateWith`, `makeCombatant`, `run`, `settle`, `expectOk`,
  `expectRefusal`, `expectRefusedBeforeDraw`). Golden dice: give the dodger AC 13 and the attacker a
  `+4` entry; faces `[18, 5]` under disadvantage keep 5 (miss), and the same first face `18` on a
  non-dodger hits. For the Dex save use faces `[3, 17]` under advantage (keeps 17). Give the attacker
  and dodger `stats` so the derived paths run. Use `speed: 30` on the dodger for the Speed 0 case
  and apply `grappled`.
- `packages/planner/test/economy.test.ts` (new): SC-003. Build the "used" state by setting
  `encounter.economy` directly with `inEncounter` plus a spread.
- `packages/planner/test/refusals.test.ts`: add `NO_ACTION_LEFT` and `NO_BONUS_ACTION_LEFT` to
  `PLANNER` with golden cases.
- `packages/planner/test/kinds.test.ts`: counts 29 and 11; drop the `PLAN_KINDS.dodge.owner`
  assertion; add the SC-006 dodge plans.
- `packages/planner/test/legality.test.ts`, `combat.test.ts`, `movement.test.ts`, `checks.test.ts`,
  `rulings.test.ts`, `determinism.test.ts`: update any exact command-list assertion whose state has
  an encounter on the actor's turn, by appending the expected `action.spend`. Do not change states to
  dodge the spend.
- `packages/session-model/test/gate-intents.test.ts`: the `KIND_UNSERVED` test uses
  `intent({ kind: "delay" })`; update the "settled kinds" row-type lists if `world()` puts Ana on
  her turn (append `"encounter.changed"` before `"intent.recorded"`); add the FR-023 replay as its
  own `describe("hosted finding 5: one Action per turn")`. Parse with `parse` from
  `@the-stacks/intent`.
- `apps/server/test/gate.intent.integration.test.ts`: the FR-024 `describe`, gated by
  `describe.skipIf(!db)`. Use `w.as(tamsin, …)` as the ruling tests do; the dice are
  `DICE` from the file head.
- Every other suite that settles two costed Intents for one combatant in one turn: fix the
  fixture per spec OQ-4 and list it in the commit message. Search first:
  `apps/server/test/dm/companion-turn-intents.integration.test.ts`,
  `ai-actor-parity.integration.test.ts`, `intent-runner.integration.test.ts`,
  `resolve.integration.test.ts`, `deed-mid-narration.integration.test.ts`, and
  `test/playtest/playtest.integration.test.ts` (the CI scenario run).

### D11 — Contracts

- `specs/026-dnd5e-engine/contracts/commands.md`: rows for `action.spend` and `dodge`, "Amended by spec 117 (TASK-0304)".
- `specs/026-dnd5e-engine/contracts/refusals.md`: an "Amended by specs/117-action-economy-dodge (TASK-0304)" section with row `| 36 | ACTION_SPENT | … | action.spend |`.
- `specs/026-dnd5e-engine/contracts/engine-api.md`: `EncounterSchema` gains `economy` and `dodging`; exports `actionsLeft`, `isDodging`.
- `specs/026-dnd5e-engine/contracts/events.md`: the `encounter.changed` row names the spender and the dodger as subjects and lists `economy` and `dodging`.
- `specs/097-planner/contracts/planner.md`: section 6 raises both codes; the served-kinds count; the economy rule (check before the handler, `action.spend` last, active combatant only).
- `specs/092-intent-contract/contracts/intent-schema.md`: the `dodge` row.

## Files

| File | Change |
|---|---|
| `packages/dnd5e-engine/src/schema/state.ts` | `economy`, `dodging` |
| `packages/dnd5e-engine/src/schema/commands.ts` | `action.spend`, `dodge` |
| `packages/dnd5e-engine/src/schema/refusals.ts` | `ACTION_SPENT` |
| `packages/dnd5e-engine/src/commands/economy.ts` (new) | `actionsLeft`, `isDodging`, two handlers |
| `packages/dnd5e-engine/src/commands/encounter.ts` | `withoutSpent` clears `dodging`; turn-advance guard |
| `packages/dnd5e-engine/src/commands/attacks.ts` | attack and Dex-save sources; `role` gains `"actor"` |
| `packages/dnd5e-engine/src/commands/spells.ts` | spell attack and Dex-save sources |
| `packages/dnd5e-engine/src/spells.ts` | `castingTime` |
| `packages/dnd5e-engine/src/execute.ts`, `src/index.ts` | registration, exports |
| `packages/planner/src/economy.ts` (new) | `actionCostOf`, `activeSpender` |
| `packages/planner/src/plan.ts`, `kinds.ts`, `movement.ts`, `index.ts` | check, spend, `dodge` |
| `packages/intent/src/kinds.ts` | `dodge` engine status |
| tests | D10 |
| contracts | D11 |
| wiki | Phase 3 |

Not edited: `packages/session-model/src`, `apps/server/src`, `apps/web`, the harness, the seeds, the
prompts, `dm/monster-policy.ts`.

## Concurrency

TASK-0222, TASK-0224 and TASK-0215 follow this card on the engine spine (runbook wave 3). They will
touch `attacks.ts`, `spells.ts` and `state.ts`. Merge `origin/main` before Phase 2 and before the
PR. TASK-0275 reads `economy` and must merge after this card.

## Migrations, prompts, dependencies

- Migrations: none. Stored events carry the whole `Encounter`; old rows lack the two optional fields.
- Prompts: none.
- Dependencies: none.

## Flags

- The coverage meta-test needs `type: "action.spend"` and `type: "dodge"` in a command test file,
  and an `expectRefusal(…"ACTION_SPENT")` call. `economy.test.ts` provides all three.
- `action.spend` adds one `encounter.changed` mechanics row to every costed turn-mode Intent. Any
  test that asserts an exact row-type list for such an Intent gains it. The playtest auditor counts
  no `encounter.changed` row, but re-run the CI scenario and update its segment or row counts if
  they move. Say so in the commit message.
- If a DM-seat test plans a costed Intent for the active combatant twice in one turn, it now
  refuses. That is the rule (spec OQ-4).
