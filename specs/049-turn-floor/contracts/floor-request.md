# Contract: the `floor` gate request and the stall override

Binding for spec 049. It amends `specs/029-proposal-gate/contracts/` (frozen) under the
operator ruling of 2026-10-27 (FT-1, FT-2, FT-4, FT-5). Shapes: `../data-model.md`.

## Request

Sent like every gate request: `send` with `eventType: "floor"`, `payloadVersion: 1`.

```json
{ "kind": "floor", "op": "end", "turn": { "round": 2, "combatantId": "c-bram" },
  "reason": "Bram ends his turn." }
```

## Who may send it

| Proposer | `end` | `take` | `return` |
|---|---|---|---|
| The active actor (human or companion) | yes | `NOT_DM` | `NOT_DM` |
| Another party member | `FLOOR_NOT_HELD` | `NOT_DM` | `NOT_DM` |
| The seated human DM | yes (Pass) | yes | yes |
| `ai:dm` | only for an absent active human, else `NOT_AUTHORIZED` | `NOT_AUTHORIZED` | `NOT_AUTHORIZED` |
| Anyone else | `NOT_AUTHORIZED` | `NOT_AUTHORIZED` | `NOT_AUTHORIZED` |

Routing: humans and companions `direct`; `ai:dm` by policy (`ask` under a human seat, `auto`
under an AI seat).

## Checks (before any die; a refusal appends nothing)

1. Not turn mode, or no active encounter: `NOT_TURN_MODE`.
2. `turn` ≠ `{ encounter.round, encounter.activeCombatantId }`: `TURN_MOVED`, details
   `{ expected, actual }`.
3. Proposer rules above (`FLOOR_NOT_HELD` carries `details: { holder }`).
4. `take` while held, or `return` while not held: `INVALID_PROPOSAL`.
5. Engine refusal of `turn.advance` or a settling command: source `engine`, its code.

## Rows

| Op | Rows, in one append |
|---|---|
| `end` (human or companion) | mechanics batch (`turn.advance`, then each settling step) → `table-mode.changed` (after = `activeActorFor(next)`) |
| `end` (`ai:dm`) | `presence.recorded` (`purpose: "floor"`, `present`) → the same rows |
| `take` | `table-mode.changed` (after = `{ mode: "turn", activeActor: <DM user id>, activeCharacterId: null }`) |
| `return` | `table-mode.changed` (after = `activeActorFor(encounter.activeCombatantId)`) |

Settling follows spec 046: a dying combatant rolls `death-save.roll`; unless a natural 20
revives it, `turn.advance` passes it; a stable or unable combatant passes unrolled; at most one
lap. The rule is `nextSettleStep` (pure), shared with resolve.

`reason` becomes the `table-mode.changed` row's `reason`.

## Stall override (`action.commit`, amends spec 044's gate-api text)

`action.commit` accepts `override: "stall"` from `ai:dm` only.

- Not `ai:dm`, not a party action, or fewer than two party humans: `INVALID_PROPOSAL`.
- Any quorum member's latest stance is `object` (against `PlanContext.present`):
  `GROUP_SIGNOFF_REQUIRED` with `details: { waiting, objecting }`.
- Else rows: `presence.recorded` (`purpose: "signoff"`, `actionId`, `present`) →
  `action.committed` (authority `dm`).

Every other `dm` commit is unchanged and writes no marker.

## Replay check (fixtures.md, SC-006)

- For a `dm` commit whose batch holds a `signoff` marker: `signoffState` against the marker's
  `present` has empty `objecting`.
- For a `table-mode.changed` row in a batch with a `floor` marker: the batch's `before.activeActor`
  is a user id absent from the marker's `present`.

## Fixture

New `turn-floor` fixture (`packages/session-model/src/fixtures/turn-floor.ts`): two humans
(Ana, Bram), one companion (Pip), one goblin. Steps: Ana ends her turn; Bram commits and the
turn advances; Pip's turn; the goblin's turn; round 2; the DM takes and returns the floor; an
AI DM absence pass with its `floor` marker; an AI DM stall override with its `signoff` marker.
