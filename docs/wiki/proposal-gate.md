---
name: proposal-gate
description: The proposal gate (TASK-0045, spec 029) - the 14 proposal kinds and four supervision requests, the permission matrix, the default policy table (auto/ask/suggest) and DM seat, commit authority by table mode and the group sign-off quorum (TASK-0049, spec 044), createGate (submit/handle/onAppended, bounded retry on SeqConflictError, atomic approval, refuse-before-write), and the import-graph write-boundary test (AC #1).
kind: component
sources:
  - packages/session-model/src/gate/proposals.ts
  - packages/session-model/src/gate/permissions.ts
  - packages/session-model/src/gate/policy.ts
  - packages/session-model/src/gate/authority.ts
  - packages/session-model/src/gate/plan.ts
  - packages/session-model/src/gate/signoff.ts
  - packages/session-model/src/gate/seat.ts
  - packages/session-model/src/gate/refusals.ts
  - apps/server/src/gate/gate.ts
  - apps/server/src/gate/index.ts
  - apps/server/test/write-boundary.test.ts
  - apps/server/test/helpers/import-graph.ts
verified_against: a4f6a791f9315e387aedf8ccaca5efdb69329f81
---

# Proposal gate

The gate is the only path by which gameplay output reaches the event log. A producer (AI
DM, player, companion, human DM) hands it a typed proposal; it checks permission, routes by
policy, plans the rows and appends them. Pure decisions live in
`packages/session-model/src/gate/` ([[session-model]]); the wrapper is
`apps/server/src/gate/` (`createGate`). Spec: `specs/029-proposal-gate/`.

## Kinds and requests

`ProposalKindSchema` has 14 kinds: `talk`, `action.declare`, `action.comment`,
`action.commit`, `action.withdraw`, `action.resolve`, `mechanics` (engine command),
`narration`, `table-mode`, `scene`, `party`, `tracker`, `scene-presence`, `journal`. The AI DM may propose the
twelve in `DmProposalKindSchema` (all but `action.declare` and `action.withdraw`). `GateRequestSchema` adds four
supervision requests: `proposal.approve`, `proposal.reject`, `dm.seat`, `gate.policy` (18
`GATE_REQUEST_KINDS`; sent over `send` with `payloadVersion` 1, see [[websocket-gateway]]).
A `Proposer` is a human (`userId`, role `operator` or `player`) or an AI (`ai:dm`, `ai:companion:<id>`).

## Permission, policy, seat

`checkPermission` is the pure matrix: DM kinds need the seated DM or the AI DM;
`proposal.approve`/`reject` need the seated DM (`NOT_DM`); `dm.seat` an operator;
`gate.policy` the seated DM or an operator; `action.declare` control of the
character (party scope: any party member), never from the AI DM; `action.withdraw`
(TASK-0114) is allowed to the declarer and the seated DM, never the AI DM (the planner refuses a closed or unknown action); `action.commit` passes here and commit authority decides it.

The DM seat is `{ kind: "ai" }` or `{ kind: "human", userId }` (`dm.seat.changed`; default AI). `DEFAULT_POLICIES`: `ask` for talk, action.comment, action.commit, mechanics,
narration, table-mode, party, tracker, scene-presence; `auto` for action.resolve and journal; `suggest` for
scene. `effectivePolicy` is `auto` for every kind under an AI seat; under a human seat it is
the session override (`gate.policy.changed`) else the default. `routeProposal` sends humans
and companions `direct`, and `ai:dm` by policy (`action.declare` and `action.withdraw` from `ai:dm`: `NOT_AUTHORIZED`). `dm`-only rows
(including `proposal.*`) go only to the human DM seat ([[subscriber-registry]]).

## Commit authority

`commitAuthority` encodes decision-0016's table over public projections. It refuses
`UNKNOWN_ACTION`, `ACTION_NOT_OPEN` (only `declared`/`discussed` commit), `COMMIT_NOT_ALLOWED`
and `GROUP_SIGNOFF_REQUIRED`. `action.declare` is refused `CHARACTER_UNABLE` (details `characterId`, `reason` `life-state` or `absent`, `lifeState`) when every covered character is down or absent. The DM commits with authority `dm`. A party-scope action needs a
party member: `group` authority when one human controls the party; with two or
more party humans it needs the sign-off quorum (TASK-0049, specs/044-group-signoff):
`signoffState` (`gate/signoff.ts`) is met when the present humans (plus the committer) are
non-empty and each one's latest stance is `approve` (the declarer defaults to approve).
Without `present`, every other human is `waiting`.
`GROUP_SIGNOFF_REQUIRED` details carry `waiting` and `objecting` ids. A character action needs control of that character: the active actor in turn mode (`active-player`), the declarer in free mode (`declarer`).

## The gate API

`createGate({ db, rng?, newId?, appendSessionEvents?, presence? })` returns `submit(sessionId,
proposer, proposal)`, `handle(sessionId, proposer, request)`, `recordPresence(sessionId, input)` and
`onAppended(listener)`. Both entries
parse with Zod first; a failure is `INVALID_PROPOSAL`, nothing written.
`GateResult` is `applied` (events, `batchId`), `pending`, `suggested`, `decided` or `{ ok: false, refusal }`. A `GateRefusal` has a `source`
(`gate`, `engine`, `append`), `code` and `message`. The gate holds no proposal state; each attempt calls `loadProjections` (DM view).

**`recordPresence(sessionId, { purpose, actionId? })`** (decision-0024, TASK-0051) appends one
`presence.recorded` row: `actor: "system"`, visibility `public`, `present` the sorted user ids
from the injected `PresenceReader` (default: nobody). It is not a proposal and skips `submit` and `handle`. It never deduplicates. It skips the
projection load and `expectedLastSeq`; the log's advisory lock orders the append and the bounded
conflict retry stays. On success it calls every `onAppended` listener with the stored row. The DM worker is the only
caller of `recordPresence` ([[dm-turn-jobs]]). The planner emits the `signoff` marker inside the commit batch; `floor` is reserved (TASK-0050). See [[presence]].

**Sign-off in the planner.** `planProposal` takes an optional `PlanContext { present? }` from the gate's `PresenceReader`. An `action.commit` of a party action
by two or more humans plans two rows: a `presence.recorded` marker (`purpose: "signoff"`,
`actionId`, the present set plus the committer) then `action.committed` (authority `group`). A quorum-completing
`approve` comment on an open party action auto-commits: three rows
(`action.commented`, the marker, `action.committed`) in one append. Other comments plan one row. The DM commit path writes no marker.

**Scene presence.** The `scene-presence` kind (`{ actorId, reason, actionId }`, TASK-0141) is a DM kind with policy `ask`. The planner takes `before` from the `scenePresence` projection and `after` from `REASON_TO_PRESENCE`, and refuses `INVALID_PROPOSAL` on no change. It plans a public `scene-presence.changed` row, plus an engine `initiative.leave` (absent actor in the order) or `initiative.join` (`arrived` into a running encounter). Only `dm/nodes/resolve.ts` builds one.

**Refuse before write.** Permission, routing, `planProposal` and
catalog vetting run before any append. For `ask`/`suggest` the gate checks legality
with a throwaway RNG, then appends one `dm` `proposal.created` row.

**Atomic approval.** `proposal.approve` (pending `ask` proposals only) re-plans the
stored proposal as the AI DM with a fresh RNG and appends the effect rows plus
`proposal.approved` in one batch. `suggest` proposals refuse `PROPOSAL_NOT_APPROVABLE`. The play route ([[play-route]]) shows no Approve on a
`suggest` proposal and sends `proposal.reject`.

**Concurrency.** Every write passes `expectedLastSeq` (the projection's `throughSeq`) to
`appendBatch` ([[event-log]]). On `SeqConflictError` the gate re-reads and retries, at most 3
attempts, then refuses `CONFLICT`. After an append each `onAppended` listener gets the stored rows in `seq` order; `index.ts` wires `gate.onAppended(gateway.publish)`.

## The write boundary (AC #1)

"No code path writes LLM output to the log except through a typed proposal." `apps/server/test/write-boundary.test.ts` builds a TypeScript-API import graph
(`test/helpers/import-graph.ts`, `checkWriteBoundary`) over `apps/server/src`: `append` and
`appendBatch` may be imported only by `session/events.ts`; `appendSessionEvent`,
`appendSessionEvents` and `appendMechanicsBatch` only under `gate/`; `ws/gateway.ts` is no
longer an allowed writer (TASK-0099 removed `appendUncataloguedEvent`);
no writer's closure reaches `ai/`; a non-literal dynamic `import()` fails. A seeded violation tree (`test/fixtures/write-boundary/src`) trips three rules. A second test asserts that only `dm/nodes/resolve.ts` contains a `kind: "scene-presence"` literal.

Known behaviour: bursty concurrent `talk` requests can be refused `CONFLICT` once the retry is spent (bench `concurrency-smoke`, TASK-0099; carded TASK-0157).

## Connections

Pure core: [[session-model]]. Writes: [[event-log]]. Delivery: [[websocket-gateway]],
[[subscriber-registry]], [[replay-live-boundary]]. Frame errors: [[ws-protocol]]. The web client: [[play-route]]. The AI DM is a producer: [[dm-runtime]] submits as `ai:dm` through `gate.submit`, and a decided `ai:dm` proposal re-queues a turn via `gate.onAppended` ([[dm-turn-jobs]]).
