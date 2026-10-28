---
name: proposal-gate
description: The proposal gate (TASK-0045, spec 029) - the 15 proposal kinds and four supervision requests, the permission matrix, the default policy table (auto/ask/suggest) and DM seat, commit authority by table mode and the group sign-off quorum (TASK-0049, spec 044), the `floor` kind (see turn-floor), createGate (submit/handle/onAppended, per-session write order, bounded jittered retry on SeqConflictError, atomic approval, refuse-before-write), and the import-graph write-boundary test (AC #1).
kind: component
sources:
  - packages/session-model/src/gate/proposals.ts
  - packages/session-model/src/gate/permissions.ts
  - packages/session-model/src/gate/policy.ts
  - packages/session-model/src/gate/authority.ts
  - packages/session-model/src/gate/plan.ts
  - packages/session-model/src/gate/signoff.ts
  - packages/session-model/src/gate/turn.ts
  - packages/session-model/src/gate/seat.ts
  - packages/session-model/src/gate/refusals.ts
  - apps/server/src/gate/gate.ts
  - apps/server/src/gate/index.ts
  - apps/server/test/write-boundary.test.ts
  - apps/server/test/helpers/import-graph.ts
verified_against: dd1f3dc07c014c9ec753c11615c8b31c52bc6a2b
---

# Proposal gate

The gate is the only path by which gameplay output reaches the event log. A producer (AI
DM, player, companion, human DM) hands it a typed proposal; it checks permission, routes by
policy, plans the rows and appends them. Pure decisions live in
`packages/session-model/src/gate/` ([[session-model]]); the wrapper is
`apps/server/src/gate/` (`createGate`). Spec: `specs/029-proposal-gate/`.

## Kinds and requests

`ProposalKindSchema` has 15 kinds: `talk`, `action.declare`, `action.comment`,
`action.commit`, `action.withdraw`, `action.resolve`, `mechanics` (engine command),
`narration`, `table-mode`, `scene`, `party`, `tracker`, `scene-presence`, `journal`, `floor`. The AI DM may propose the
thirteen in `DmProposalKindSchema` (all but `action.declare` and `action.withdraw`). `GateRequestSchema` adds four
supervision requests: `proposal.approve`, `proposal.reject`, `dm.seat`, `gate.policy` (19
`GATE_REQUEST_KINDS`; sent over `send`, see [[websocket-gateway]]).
A `Proposer` is a human (`userId`, role `operator` or `player`) or an AI (`ai:dm`, `ai:companion:<id>`).

## Permission, policy, seat

`checkPermission` is the pure matrix: DM kinds need the seated DM or the AI DM;
`proposal.approve`/`reject` need the seated DM (`NOT_DM`); `dm.seat` an operator;
`gate.policy` the seated DM or an operator; `action.declare` control of the
character (party scope: any party member), never from the AI DM; `action.withdraw`
is for the declarer and the seated DM, never the AI DM; `action.commit` passes here and commit authority decides it.

The DM seat is `{ kind: "ai" }` or `{ kind: "human", userId }` (`dm.seat.changed`; default AI). `DEFAULT_POLICIES`: `ask` for talk, action.comment, action.commit, mechanics,
narration, table-mode, party, tracker, scene-presence, floor; `auto` for action.resolve and journal; `suggest` for
scene. `effectivePolicy` is `auto` for every kind under an AI seat; under a human seat it is
the session override (`gate.policy.changed`) else the default. `routeProposal` sends humans
and companions `direct`, `ai:dm` by policy (`action.declare` and `action.withdraw` from `ai:dm`: `NOT_AUTHORIZED`). `dm`-only rows go only to the human DM seat ([[subscriber-registry]]).

## Commit authority

`commitAuthority` encodes decision-0016's table over public projections. It refuses
`UNKNOWN_ACTION`, `ACTION_NOT_OPEN` (only `declared`/`discussed` commit), `COMMIT_NOT_ALLOWED`
and `GROUP_SIGNOFF_REQUIRED`. `action.declare` is refused `CHARACTER_UNABLE` (details `characterId`, `reason` `life-state` or `absent`, `lifeState`) when every covered character is down or absent. The DM commits with authority `dm`. A party-scope action needs a
party member: `group` authority when one human controls the party; with two or
more party humans it needs the sign-off quorum (TASK-0049, specs/044-group-signoff):
`signoffState` ([[session-model]]) is met when the present humans (plus the committer) are
non-empty and each one's latest stance is `approve` (the declarer defaults to approve).
`GROUP_SIGNOFF_REQUIRED` details carry `waiting` and `objecting` ids. A character action needs control of that character: the active actor in turn mode (`active-player`), the declarer in free mode (`declarer`).

## The gate API

`createGate({ db, rng?, newId?, appendSessionEvents?, presence? })` returns `submit(sessionId,
proposer, proposal)`, `handle(sessionId, proposer, request)`, `recordPresence(sessionId, input)` and
`onAppended(listener)`. Both entries
parse with Zod first; a failure is `INVALID_PROPOSAL`, nothing written.
`GateResult` is `applied` (events, `batchId`), `pending`, `suggested`, `decided` or `{ ok: false, refusal }`. A `GateRefusal` has a `source`
(`gate`, `engine`, `append`), `code` and `message`. The gate holds no proposal state; each attempt calls `loadProjections`.

**`recordPresence(sessionId, { purpose, actionId? })`** (decision-0024, TASK-0051) appends one
`presence.recorded` row (`system`, `public`, the sorted present user ids). It is not a proposal, skips the projection load and `expectedLastSeq`, joins the
per-session queue, and calls every `onAppended` listener on success; the row's detail is in [[presence]]. The DM worker is the only
caller ([[dm-turn-jobs]]). The planner emits the `signoff` marker inside the commit batch (and `floor`, [[turn-floor]]). See [[presence]].

**Sign-off in the planner.** `planProposal` takes an optional `PlanContext { present? }` from the gate's `PresenceReader`. An `action.commit` of a party action
by two or more humans plans two rows: a `presence.recorded` marker (`purpose: "signoff"`,
`actionId`, the present set plus the committer) then `action.committed` (authority `group`). A quorum-completing
`approve` comment auto-commits: `action.commented`, the marker, `action.committed` in one append.

**Floor and stall** (TASK-0050): the `floor` kind and its rules: [[turn-floor]].

**Scene presence.** The `scene-presence` kind (`{ actorId, reason, actionId, visibility }`, TASK-0141; `visibility` `public` by default, or `dm`) is a DM kind with policy `ask`. The planner refuses `INVALID_PROPOSAL` on no change and plans a `scene-presence.changed` row plus an engine `initiative.leave` or `initiative.join` (detail: [[seed-npc-presence]], [[session-model]]). Only `dm/nodes/resolve.ts` builds one.

**Refuse before write.** Permission, routing, `planProposal` and
catalog vetting run before any append. `ask`/`suggest` append one `dm` `proposal.created` row after a legality check.

**Atomic approval.** `proposal.approve` (pending `ask` proposals only) re-plans the
stored proposal as the AI DM with a fresh RNG and appends the effect rows plus
`proposal.approved` in one batch. `suggest` proposals refuse `PROPOSAL_NOT_APPROVABLE`.

**Concurrency** (TASK-0157, specs/052-talk-conflict-retry). `inOrder(sessionId, fn)` is a per-session
promise queue: a session's writes (`submit`, `handle`, `recordPresence`) run one at a time in arrival
order, each in full (attempts, waits, `onAppended` calls); sessions run in parallel. Parsing runs first,
so an invalid request never joins the queue. A refusal or thrown error ends that write only. Code inside
a write must not await another write for the same session. Every
write passes `expectedLastSeq` (the projection's `throughSeq`) to `appendBatch` ([[event-log]]). On
`SeqConflictError` the gate waits (`GateDeps.retryDelayMs(attempt)`, default a random 10 to 50 ms, never
after attempt 3), re-reads and retries, at most 3 attempts, then refuses `CONFLICT`. Only an outside writer
(another process, or a second gate over the same database) can now cause `CONFLICT`; it writes zero rows,
so a resend is safe, and it keeps the `internal` wire kind. After an append each `onAppended` listener gets the stored rows in `seq` order; `index.ts` wires `gate.onAppended(gateway.publish)`.

## The write boundary (AC #1)

"No code path writes LLM output to the log except through a typed proposal." `apps/server/test/write-boundary.test.ts` builds a TypeScript-API import graph
(`test/helpers/import-graph.ts`, `checkWriteBoundary`) over `apps/server/src`: `append` and
`appendBatch` may be imported only by `session/events.ts`; `appendSessionEvent`,
`appendSessionEvents` and `appendMechanicsBatch` only under `gate/`; `ws/gateway.ts` is no
longer an allowed writer (TASK-0099 removed `appendUncataloguedEvent`);
no writer's closure reaches `ai/`; a non-literal dynamic `import()` fails. A seeded violation tree (`test/fixtures/write-boundary/src`) trips three rules; a second test pins `kind: "scene-presence"` literals to `dm/nodes/resolve.ts`.

## Connections

Pure core: [[session-model]]. Writes: [[event-log]]. Delivery: [[websocket-gateway]],
[[subscriber-registry]], [[replay-live-boundary]]. Frame errors: [[ws-protocol]]. The web client: [[play-route]]. The AI DM is a producer: [[dm-runtime]] submits as `ai:dm` through `gate.submit`, and a decided `ai:dm` proposal re-queues a turn via `gate.onAppended` ([[dm-turn-jobs]]).
