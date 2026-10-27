# Research: Turn-mode floor passing (spec 049)

The operator rulings (spec.md, "Operator rulings") settle the one-way doors. The decisions
below settle the rest. Code read at `5cc34fb` (main with PR #73 merged).

## R1. One settling rule, two drivers

- **Decision**: Move the "what settles next" rule into the pure package as
  `nextSettleStep(engine): { type: "death-save.roll", targetId } | { type: "turn.advance" } | null`
  in `packages/session-model/src/gate/turn.ts`. Move `canAct` and its `INCAPACITATING` list
  with it. Resolve's `settleTurn` keeps its loop and its checkpointed `run.mech` keys, and asks
  `nextSettleStep` what to run. The `floor` planner runs the same rule in a pure loop.
- **Rationale**: One rule for "a downed combatant passes" (spec 046) whoever ends the turn.
  Resolve keeps reclaim idempotence (`settle:<n>:save`, `settle:<n>:advance` keys) unchanged.
- **Alternatives**: Copy the loop into the planner. Rejected: two rules drift. Route End turn
  through the worker (FT-1 C). Rejected by the ruling.

## R2. `activeActorFor` moves to the pure package

- **Decision**: Move `activeActorFor(p, combatantId)` from `apps/server/src/dm/nodes/resolve.ts`
  to `packages/session-model/src/gate/turn.ts` and export it. Resolve imports it. The web view
  model uses it for the "next" flag in the order strip.
- **Rationale**: FR-006 needs one rule for "who holds the floor for this combatant".
- **Alternatives**: Duplicate it in the planner. Rejected.

## R3. The `floor` batch shape

- **Decision**: `end` plans, in one append:
  1. one mechanics batch (one `batchId`) holding the engine events of `turn.advance` and of
     every settling step after it, executed in order on an evolving engine state
     (`execute`, then `evolve` each event);
  2. one `table-mode.changed` row: `before` the projection's table mode, `after`
     `{ mode: "turn", ...activeActorFor(p', active') }` where `p'` is the evolved state;
  3. for an `ai:dm` proposer only, a `presence.recorded` row (purpose `floor`, `present` from
     `PlanContext`), placed first, as spec 044 places the `signoff` marker first.
- **Rationale**: One mechanics batch keeps `index`/`count` simple (at most one lap, far under
  500 events). Settling's lap bound matches `settleTurn` (order length).
- **Alternatives**: One mechanics batch per command. Workable, but adds `batchId`s with no
  reader that needs them.

## R4. The turn identity

- **Decision**: `turn: { round: int ≥ 1, combatantId }`. The planner compares it to
  `p.encounter.round` and `p.encounter.activeCombatantId` and refuses `TURN_MOVED` on any
  difference. A held floor does not change the turn (take and return carry the same `turn`).
- **Rationale**: A stale client or a slow floor job must not end the next actor's turn.
  `expectedLastSeq` already serialises the append; `turn` makes the intent explicit.

## R5. Refusal order and codes (ruling FT-2)

The planner checks, in order, before any die is drawn:

1. no turn mode or no active encounter → `NOT_TURN_MODE`;
2. `turn` differs from the encounter's → `TURN_MOVED`;
3. op `end`:
   - a seated human DM or `ai:dm` passes; `ai:dm` only when the active actor is a human user
     id absent from `PlanContext.present` (ruling Q4 A), else `NOT_AUTHORIZED`;
   - any other proposer must equal `tableMode.activeActor`, else `FLOOR_NOT_HELD`
     (this also refuses a player while the DM holds the floor);
4. op `take`: the floor is already held by the DM → `INVALID_PROPOSAL`;
5. op `return`: the floor is not held → `INVALID_PROPOSAL`;
6. engine refusals (`turn.advance` `NO_ELIGIBLE_COMBATANT`) return with source `engine`.

`checkPermission` (permissions.ts) allows `floor` for party members, the seated DM and
`ai:dm`; it refuses `take`/`return` to anyone but the seated human DM (`NOT_DM`) and to
`ai:dm` (`NOT_AUTHORIZED`, ruling Q3 A). A non-party non-DM user is `NOT_AUTHORIZED`.

## R6. "Held floor" is derived, not stored

- **Decision**: The floor is held when `tableMode.mode === "turn"` and `activeActor` equals
  the seated human DM's user id with `activeCharacterId === null`. `floorHeld(p)` is a pure
  helper in `turn.ts`. `return` sets `after` to `activeActorFor(p, encounter.activeCombatantId)`.
- **Rationale**: No schema change to `TableModeSchema` (spec 028 stays frozen; ruling Q3 A).
- **Edge**: when the seated DM also controls the active character, `activeCharacterId` is that
  character, so the state is "their turn", not "held". Correct by construction.

## R7. One "turn moved" guard in resolve (FR-012, with spec 048)

- **Decision**: Record `turnAtStart = { round, activeCombatantId }` from the assembled
  projection (048 already records `activeAtStart`; extend it with the round). In the
  turn-advance group, re-read `fresh` (048 already does) and:
  - `leftOrder` (048): skip `turn.advance`, still settle and set the mode (unchanged);
  - `moved` (new): `fresh` round or active combatant differs from `turnAtStart` and the
    active combatant did not leave the order → skip the advance, the settling and the mode
    row; the floor batch already wrote them;
  - `held` (new): `floorHeld(fresh)` → skip the whole group.
- **Rationale**: 048's leave moves the turn without writing a table mode; a floor batch moves
  it and writes one. The two cases differ only in whether the mode row is owed.
- **Reclaim**: a reclaimed job whose checkpoint holds `advance` keeps today's behaviour.

## R8. Follow-up jobs after a floor batch (FR-007)

- **Decision**: `dm/enqueue.ts` reacts to a `table-mode.changed` row in turn mode **whose
  actor is a human** (a player's End turn, or the seated DM's Pass, Take, Return):
  `ai:dm` active → `enqueueTurn(…, "npc-turn")`; `ai:companion:*` active → a companion
  `turn` job; a human active → the absence check (R10). Rows written by `ai:dm` (resolve, the
  floor job) are ignored, because their producer queues its own follow-up, as resolve's
  `nextJob` does today.
- **Rationale**: Avoids a double companion job when resolve's own rows reach the listener.

## R9. The `floor` job kind (ruling FT-3 A)

- **Decision**: kind `floor`, claim priority between `turn` and `companion` (turn 1, floor 2,
  companion 3, chronicle 4). Payload `FloorJobInput { v: 1, sessionId, check: "absence" |
  "stall", actionId: RefId | null, notBefore: ISO UTC }`. Serialised with `turn`/`companion`
  per session (`jobs_session_running_key` covers `floor`). The claim's `notBefore` filter,
  today companion-only, applies to `floor` too. One queued job per
  `(session, check, actionId)` (partial unique index); a re-arm updates `notBefore`.
- **The run** (code only, no model, no `chat()`): load the DM projection and the seat; if the
  seat is human, finish `skipped`. Read `presence.presentUsers`.
  - `absence`: turn mode, active actor a human absent from the present set, and the absence
    observed at enqueue still holds → `gate.submit(ai:dm, floor end)`. Else finish `noop`.
  - `stall`: the action is open, party scope, ≥ 2 party humans, `signoffState(…).met` false,
    `objecting` empty, and the latest stance `seq` on the action is the one recorded at
    enqueue → `gate.submit(ai:dm, action.commit { override: "stall" })`. Else `noop`.
- **Result**: `jobs.result = { outcome: "passed" | "committed" | "noop" | "skipped" |
  "refused", seqs, refusal? }`. A gate refusal finishes the job `done` with `refused`; it is not
  a failure.

## R10. When waits are armed

- `absence`, `notBefore = now + 30 s` (FLOOR_ABSENCE_WAIT_MS, injectable):
  - the enqueuer sees a human-active `table-mode.changed` row (any actor) and that human is
    absent now;
  - the presence reader's `onChange` fires for a session whose active human just became
    absent (the reader fires after the 5 s grace).
- `stall`, `notBefore = now + 120 s` (FLOOR_STALL_WINDOW_MS, injectable):
  - the enqueuer sees an `action.declared` with scope `party` when the party has ≥ 2 humans;
  - each `action.commented` on such an open action moves `notBefore` and the recorded stance
    `seq` (the stall window restarts on any stance change).
- Arming is skipped when the seat is human. The job re-checks the seat when it runs.
- **Reconcile** (worker start): for each session in turn mode whose active human is absent,
  and for each open multi-human party action with no queued `stall` job, arm one.
- The time source is database `now()`, as the react window is.

## R11. Stall override in the planner (ruling FT-5)

- **Decision**: `action.commit` gains optional `override: "stall"`. The planner accepts it only
  from `ai:dm`, only for an open party action with ≥ 2 party humans (else `INVALID_PROPOSAL`).
  It refuses `GROUP_SIGNOFF_REQUIRED` with `details.objecting` when any quorum member objects
  (ruling Q5 A). It plans `[presence.recorded(signoff, actionId, present), action.committed(dm)]`.
  The time window is the job's check; the planner has no clock.
- **Replay**: the SC-006 check, for a `dm` commit with a `signoff` marker in its batch, asserts
  `signoffState` against that marker's `present` has `objecting` empty (ruling FT-4).

## R12. Transcript lines and labels (FR-020, Q2)

- **Decision**: `toTableViewModel` adds a `floor` transcript item for every turn-mode
  `table-mode.changed` row: "Bram's turn", "Your turn", "The DM has the floor", or for a
  free-mode change nothing new. The label comes from the same name resolution as the badge.
  No new event, no catalog change.
- The suggestion label (Q2 A) is a view-model flag on the comment form:
  `suggest: viewer is a party member, not the active actor, card is the active actor's open
  character action, turn mode`.

## R13. Migration

- **Decision**: one migration, `apps/server/drizzle/0007_<generated>.sql`, generated with
  `drizzle-kit generate` from `schema/jobs.ts` changes:
  - `jobs_kind_valid`: `kind IN ('ingest','turn','companion','chronicle','floor')`;
  - the session-required CHECK covers `floor`;
  - `jobs_session_running_key`: `kind IN ('turn','companion','floor') AND status = 'running'`;
  - new partial unique index `jobs_floor_queued_key` on
    `(session_id, (input->>'check'), coalesce(input->>'actionId',''))`
    `WHERE kind = 'floor' AND status = 'queued'`.
- **Rationale**: the ruled "one jobs migration". Never hand-edit `meta/_journal.json`
  (runbook); regenerate after merging `origin/main` if main gained a migration.

## R14. Counts after spec 048

`ProposalKindSchema` 14 → 15, `DmProposalKindSchema` 12 → 13, `GATE_REQUEST_KINDS` 18 → 19.
The `send` frame shape is unchanged; the WebSocket classifier reads `GATE_REQUEST_KINDS`.
