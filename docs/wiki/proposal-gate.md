---
name: proposal-gate
description: The proposal gate (TASK-0045, spec 029) - the 13 proposal kinds and four supervision requests, the permission matrix, the default policy table (auto/ask/suggest) and DM seat, commit authority by table mode and the group sign-off quorum (TASK-0049, spec 044), createGate (submit/handle/onAppended, bounded retry on SeqConflictError, atomic approval, refuse-before-write), and the import-graph write-boundary test (AC #1).
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
verified_against: baecb93e012266902cea61c04d2633ba3bd65499
---

# Proposal gate

The gate is the only path by which gameplay output reaches the event log. A producer (AI
DM, player, companion, human DM) hands the gate a typed proposal; the gate checks
permission, routes it by policy, plans the rows, and appends them. Pure decisions live in
`packages/session-model/src/gate/` ([[session-model]]); the stateful wrapper is
`apps/server/src/gate/` (`createGate`). Spec: `specs/029-proposal-gate/`.

## Kinds and requests

`ProposalKindSchema` has 13 kinds: `talk`, `action.declare`, `action.comment`,
`action.commit`, `action.withdraw`, `action.resolve`, `mechanics` (an engine command, validated by the engine),
`narration`, `table-mode`, `scene`, `party`, `tracker`, `journal`. The AI DM may propose the
twelve in `DmProposalKindSchema` (all but `action.declare` and `action.withdraw`). `GateRequestSchema` adds four
supervision requests: `proposal.approve`, `proposal.reject`, `dm.seat`, `gate.policy` (17
`GATE_REQUEST_KINDS`; sent over `send` with `payloadVersion` 1, see [[websocket-gateway]]).
A `Proposer` is a human (`userId`, role `operator` or `player`) or an AI (`ai:dm`,
`ai:companion:<id>`).

## Permission, policy, seat

`checkPermission` is the pure matrix: DM kinds need the seated DM or the AI DM;
`proposal.approve`/`reject` need the seated DM (`NOT_DM`); `dm.seat` needs an operator;
`gate.policy` needs the seated DM or an operator; `action.declare` needs control of the
character (party scope: any party member) and never comes from the AI DM; `action.withdraw`
(TASK-0114) is allowed to the action's declarer and the seated DM, never the AI DM; the
planner refuses a closed or unknown action; `action.commit` passes here and is decided by commit authority.

The DM seat is `{ kind: "ai" }` or `{ kind: "human", userId }`, changed by `dm.seat.changed`
(default AI). `DEFAULT_POLICIES`: `ask` for talk, action.comment, action.commit, mechanics,
narration, table-mode, party, tracker; `auto` for action.resolve and journal; `suggest` for
scene. `effectivePolicy` is `auto` for every kind when the seat is AI; with a human seat it is
the session override (`gate.policy.changed`) else the default. `routeProposal` sends humans
and companions `direct`, and `ai:dm` by policy (`action.declare` and `action.withdraw` from
`ai:dm` are refused `NOT_AUTHORIZED`). `dm`-only rows
(including `proposal.*`) go only to the logged human DM seat ([[subscriber-registry]]).

## Commit authority

`commitAuthority` turns decision-0016's table into code over public projections. It refuses
`UNKNOWN_ACTION`, `ACTION_NOT_OPEN` (only `declared`/`discussed` commit), `COMMIT_NOT_ALLOWED`
and `GROUP_SIGNOFF_REQUIRED`. `action.declare` is refused `CHARACTER_UNABLE` (details `characterId`, `reason`, `lifeState`) when every covered character is down. The DM commits with authority `dm`. A party-scope action needs a
party member: `group` authority when exactly one human player controls the party. With two or
more party humans the commit needs the sign-off quorum (TASK-0049, specs/044-group-signoff):
`signoffState` (`gate/signoff.ts`) is met when the present humans (plus the committer) are
non-empty and each one's latest stance is `approve` (the declarer defaults to approve).
Without the optional `present`, every other human is `waiting`.
`GROUP_SIGNOFF_REQUIRED` carries `waiting` and `objecting` ids in `refusal.details`. A character action needs control of that character: in turn mode
only the active actor (`active-player`), in free mode only the declarer (`declarer`).

## The gate API

`createGate({ db, rng?, newId?, appendSessionEvents?, presence? })` returns `submit(sessionId,
proposer, proposal)`, `handle(sessionId, proposer, request)`, `recordPresence(sessionId, input)` and
`onAppended(listener)`. Both entries
parse with the Zod schema first; a parse failure is `INVALID_PROPOSAL` and nothing is written.
`GateResult` is `applied` (events, `batchId`), `pending` (ask), `suggested`, `decided`
(approve, reject, seat, policy), or `{ ok: false, refusal }`. A `GateRefusal` has a `source`
(`gate`, `engine`, `append`), a `code` and a `message`. The gate holds no proposal state: each
attempt calls `loadProjections` (DM view).

**`recordPresence(sessionId, { purpose, actionId? })`** (decision-0024, TASK-0051) appends one
`presence.recorded` row: `actor: "system"`, visibility `public`, `present` the sorted user ids
from the injected `PresenceReader` (default: nobody present). It is not a proposal and does not
go through `submit` or `handle`. It never deduplicates. It skips the
projection load and `expectedLastSeq` (the marker reads no projection state); the log's advisory
lock orders the append and the bounded conflict retry stays. A refusal returns `{ ok: false, refusal }`; on
success it calls every `onAppended` listener with the stored row. The DM worker is the only
caller of `recordPresence` ([[dm-turn-jobs]]). The `signoff` marker is not written through it: the
planner emits it inside the commit batch. TASK-0050 reserves `floor`. See [[presence]].

**Sign-off in the planner.** `planProposal` takes an optional `PlanContext { present? }`, filled
by the gate from the `PresenceReader`. An `action.commit` of a party action
by two or more humans plans a two-row batch: a `presence.recorded` marker (`purpose: "signoff"`,
`actionId`, the present set plus the committer) then `action.committed` (authority `group`). An
`approve` comment on an open party action that completes the quorum auto-commits: three rows
(`action.commented`, the marker, `action.committed`) in one append. Every other comment plans
the one comment row. The DM commit path is unchanged and writes no marker.

**Refuse before write.** Permission, routing, `planProposal` (engine and authority checks) and
catalog vetting all run before any append. For `ask`/`suggest` the gate runs a legality check
with a throwaway RNG, then appends one `dm`-visibility `proposal.created` row.

**Atomic approval.** `proposal.approve` (only `ask` proposals, only pending ones) re-plans the
stored proposal as the AI DM with a fresh RNG and appends the effect rows plus
`proposal.approved` in one batch. `suggest` proposals refuse `PROPOSAL_NOT_APPROVABLE`. The play route ([[play-route]]) offers no Approve on a
`suggest` proposal; it sends `proposal.reject`.

**Concurrency.** Every write passes `expectedLastSeq` (the projection's `throughSeq`) to
`appendBatch` ([[event-log]]). On `SeqConflictError` the gate re-reads and retries, at most 3
attempts, then refuses `CONFLICT`. After a successful append each `onAppended` listener gets the stored rows in `seq` order; `index.ts` wires `gate.onAppended(gateway.publish)`.

## The write boundary (AC #1)

"No code path writes LLM output to the log except through a typed proposal." The test
`apps/server/test/write-boundary.test.ts` uses a TypeScript-API import graph
(`test/helpers/import-graph.ts`, `checkWriteBoundary`) over `apps/server/src`: `append` and
`appendBatch` may be imported only by `session/events.ts`; `appendSessionEvent`,
`appendSessionEvents` and `appendMechanicsBatch` only under `gate/`; `ws/gateway.ts` is no
longer an allowed writer (TASK-0099 removed `appendUncataloguedEvent`);
no writer's transitive closure reaches `ai/`; a non-literal dynamic
`import()` fails. A seeded violation tree in `test/fixtures/write-boundary/src` trips three rules.

## Known behaviour

Bursty concurrent `talk` requests can be refused `CONFLICT` once the bounded retry is spent
(the bench's `concurrency-smoke`, TASK-0099). The retry bound is unchanged. Carded as TASK-0157.

## Connections

Pure core: [[session-model]]. Writes through [[event-log]]. Delivery: [[websocket-gateway]],
[[subscriber-registry]], [[replay-live-boundary]]. Frame errors: [[ws-protocol]]. The web client that sends these requests and
shows refusal codes: [[play-route]]. The AI DM is a producer: [[dm-runtime]] submits as `ai:dm` through `gate.submit`, and a decided `ai:dm` proposal re-queues a turn via `gate.onAppended` ([[dm-turn-jobs]]).
