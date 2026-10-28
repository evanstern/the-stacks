---
name: turn-floor
description: Turn-mode floor passing (TASK-0050, specs/049-turn-floor) - the `floor` proposal (end, take, return) and its planner refusals, the shared turn rules in gate/turn.ts, the AI DM stall override, the code-only `floor` job (absence pass after 30 s, stall commit after 120 s) with its arming and reconcile, migration 0007, and the play-route floor controls, turn-order strip and floor lines.
kind: pipeline
sources:
  - packages/session-model/src/gate/turn.ts
  - packages/session-model/src/gate/plan.ts
  - packages/session-model/src/gate/permissions.ts
  - packages/session-model/src/gate/proposals.ts
  - packages/session-model/src/fixtures/turn-floor.ts
  - apps/server/src/dm/floor.ts
  - apps/server/src/dm/floor-state.ts
  - apps/server/src/dm/jobs.ts
  - apps/server/src/dm/enqueue.ts
  - apps/server/src/dm/worker.ts
  - apps/server/src/dm/nodes/resolve.ts
  - apps/server/drizzle/0007_aromatic_baron_zemo.sql
  - apps/web/app/play/view-model.ts
  - apps/web/app/play/local-log.ts
  - apps/web/app/play/components/floor-controls.tsx
  - apps/web/app/play/components/turn-order.tsx
verified_against: fd4d45161c7407d4dcc59ad9ffe43df147e70c29
---

# Turn floor

In turn mode one actor holds the floor. TASK-0050 (specs/049-turn-floor) adds the request that passes it, the AI DM's two code-only overrides, and the UI. Gate basics are in [[proposal-gate]]; jobs in [[dm-turn-jobs]]; the table in [[play-route]].

## Turn rules (`gate/turn.ts`)

Pure, shared by the planner, resolve and settle ([[session-model]]): `canAct` (conscious and not incapacitated; an unknown combatant counts as able), `nextSettleStep` (a dying combatant rolls a death save; a stable, dead or otherwise unable one passes the turn), `activeActorFor` (the table-mode actor for a combatant; `ai:dm` with no character when it is not a party member), `floorHeld` (turn mode, the seated human DM named, no character) and `currentTurn` (`{ round, combatantId }` or null).

## The `floor` proposal

Shape: `{ op: "end" | "take" | "return", turn: { round, combatantId }, reason }`. Policy `ask`. Permission: `end` for a party member, the seated DM or `ai:dm`; `take` and `return` only for the seated human DM (a party member gets `NOT_DM`, the AI DM and others `NOT_AUTHORIZED`). `planFloor` refuses in order: `NOT_TURN_MODE` (not turn mode, or no encounter), `TURN_MOVED` (the stated turn differs from `currentTurn`; details `expected`, `actual`), then by op. `take` and `return` plan one `table-mode.changed` row and refuse `INVALID_PROPOSAL` when the floor is already held or not held. `end` by anyone but the active actor or the seated DM is `FLOOR_NOT_HELD`. `ai:dm` may end a turn only when the holder is a human absent from `context.present`, else `NOT_AUTHORIZED`. A successful `end` runs `turn.advance` on an evolving engine state, settles downed combatants within one lap, then plans the mechanics rows and a final `table-mode.changed` naming the next holder; an AI DM `end` leads with a `presence.recorded` row, `purpose: "floor"` ([[presence]]). New refusal codes: `FLOOR_NOT_HELD`, `TURN_MOVED`, `NOT_TURN_MODE`.

## Stall override

`action.commit` takes `override: "stall"` from `ai:dm` only (ruling FT-5). `planStall` refuses `UNKNOWN_ACTION`, `ACTION_NOT_OPEN`, and `INVALID_PROPOSAL` unless the action is a party action, the party has two or more humans and `context.present` is given. It refuses `GROUP_SIGNOFF_REQUIRED` when a present quorum member objects. Otherwise it plans a `signoff` marker holding exactly the present set, then `action.committed` (authority `dm`). The planner has no clock; the window belongs to the job.

## Resolve's "turn moved" guard

Before the closing `turn.advance`, resolve skips the advance, the settle and the mode row when the engine's turn differs from the turn at assemble (a floor batch moved it and wrote its own mode row) or the seated human DM holds the floor. A reclaim whose checkpoint holds `advance` still replays the group ([[dm-runtime]]).

## The `floor` job

Kind `floor` (migration 0007 adds it to `jobs_kind_valid`, recreates `jobs_session_running_key` to cover it and adds `jobs_floor_queued_key`, one queued row per session, `check` and `actionId`). Claim priority 2, after `turn`. `FloorJobInput`: `check` (`absence` or `stall`), `actionId`, `holder`, `stanceSeq`, `notBefore` (database time). `FLOOR_ABSENCE_WAIT_MS` is 30 s (after the 5 s presence grace); `FLOOR_STALL_WINDOW_MS` is 120 s.

- **Arming** (`dm/enqueue.ts`): under an AI seat, and only with a presence reader, a turn-mode `table-mode.changed` row naming an absent human arms `absence`; `onPresenceChange` (wired to `presence.reader.onChange` in `index.ts`) arms it when the active human leaves; a declare or comment on an open multi-human party action arms or re-arms `stall`; a commit or withdrawal cancels it. `enqueueFloorCheck` inserts, or moves `notBefore`, `holder` and `stanceSeq` on the queued row.
- **Follow-ups**: a turn-mode `table-mode.changed` row written by a human queues an `npc-turn` (`ai:dm` active) or a companion `turn` job (a companion active). Rows written by `ai:dm` queue none; the floor job queues its own.
- **Run** (`dm/floor.ts`, no model call, only `gate.submit` as `ai:dm`): acts only under an AI seat and only if the wait it was armed for still holds. `absence`: the same human is still absent, so it submits `floor` `end` for the current turn, then queues the next holder's follow-up. `stall`: the action is still an open party candidate, no comment arrived since `stanceSeq` and nobody present objects, so it submits `action.commit` with the stall override. Outcomes: `passed`, `committed`, `noop`, `skipped`, `refused`. The worker runs it as `runFloorJobFenced`.
- **Reconcile**: at worker start `reconcileFloorJobs` arms `absence` for recently active turn-mode sessions whose holder is absent, and `stall` for open multi-human party actions with no queued `stall` (lookback `FLOOR_RECONCILE_LOOKBACK_MS`, 24 h).

Write boundary: only `dm/floor.ts` builds a `floor` proposal or the stall override (`write-boundary.test.ts`). Contract: `specs/049-turn-floor/contracts/floor-jobs.md`.

## The table UI

`toTableViewModel` adds `ModeView.held`, `ModeView.order` (`OrderEntry`: active, next, viewer) and `floor` (`FloorControls`). `components/floor-controls.tsx` in the header shows End turn to the active player (not while the DM holds the floor) and, for the seated human DM in turn mode, Pass (an `end`), Take floor and Return floor; each click sends one `floor` request carrying the turn the viewer saw, with no confirmation. `components/turn-order.tsx` renders an ordered list "Turn order" under the header: the active chip marked, "next" and "you" flags. The mode badge reads "The DM has the floor" while held. The transcript gets a `floor` line per turn-mode `table-mode.changed` row. In turn mode a player's own open character action shows "Commits on your turn", and a party member's comment box on the active player's action reads "Suggest an alternative" (the same `action.comment`). Fixture mode builds floor rows with `local-log.ts`'s `localFloorEvents` (no downed-combatant settling). `labels.ts`'s `refusalLabel` words the three floor refusals.

The `turn-floor` fixture ([[session-model]]) walks the whole flow.
