---
name: proposal-gate
description: The proposal gate (TASK-0045, spec 029) - the 12 proposal kinds and four supervision requests, the permission matrix, the default policy table (auto/ask/suggest) and DM seat, commit authority by table mode, createGate (submit/handle/onAppended, bounded retry on SeqConflictError, atomic approval, refuse-before-write), and the import-graph write-boundary test (AC #1).
kind: component
sources:
  - packages/session-model/src/gate/proposals.ts
  - packages/session-model/src/gate/permissions.ts
  - packages/session-model/src/gate/policy.ts
  - packages/session-model/src/gate/authority.ts
  - packages/session-model/src/gate/seat.ts
  - packages/session-model/src/gate/refusals.ts
  - apps/server/src/gate/gate.ts
  - apps/server/src/gate/index.ts
  - apps/server/test/write-boundary.test.ts
  - apps/server/test/helpers/import-graph.ts
verified_against: 49c7de2be46b0cf6b94814c4ed0bb1bd4aa20bb7
---

# Proposal gate

The gate is the only path by which gameplay output reaches the event log. A producer (the AI
DM, a player, a companion, the human DM) hands the gate a typed proposal; the gate checks
permission, routes it by policy, plans the rows, and appends them. Pure decisions live in
`packages/session-model/src/gate/` ([[session-model]]); the stateful wrapper is
`apps/server/src/gate/` (`createGate`). Spec: `specs/029-proposal-gate/`.

## Kinds and requests

`ProposalKindSchema` has 12 kinds: `talk`, `action.declare`, `action.comment`,
`action.commit`, `action.resolve`, `mechanics` (an engine command, validated by the engine),
`narration`, `table-mode`, `scene`, `party`, `tracker`, `journal`. The AI DM may propose the
eleven in `DmProposalKindSchema` (all but `action.declare`). `GateRequestSchema` adds four
supervision requests: `proposal.approve`, `proposal.reject`, `dm.seat`, `gate.policy` (16
`GATE_REQUEST_KINDS`; sent over `send` with `payloadVersion` 1, see [[websocket-gateway]]).
A `Proposer` is a human (`userId`, role `operator` or `player`) or an AI (`ai:dm`,
`ai:companion:<id>`).

## Permission, policy, seat

`checkPermission` is the pure matrix: DM kinds need the seated DM or the AI DM;
`proposal.approve`/`reject` need the seated DM (`NOT_DM`); `dm.seat` needs an operator;
`gate.policy` needs the seated DM or an operator; `action.declare` needs control of the
character (party scope: any party member) and never comes from the AI DM; `action.commit`
passes here and is decided by commit authority.

The DM seat is `{ kind: "ai" }` or `{ kind: "human", userId }`, changed by `dm.seat.changed`
(default AI). `DEFAULT_POLICIES`: `ask` for talk, action.comment, action.commit, mechanics,
narration, table-mode, party, tracker; `auto` for action.resolve and journal; `suggest` for
scene. `effectivePolicy` is `auto` for every kind when the seat is AI; with a human seat it is
the session override (`gate.policy.changed`) else the default. `routeProposal` sends humans
and companions `direct`, and `ai:dm` by policy. Operator ruling: the DM view of `dm`-only rows
(including `proposal.*` rows) goes only to the logged human DM seat ([[subscriber-registry]]).

## Commit authority

`commitAuthority` turns decision-0016's table into code over public projections. It refuses
`UNKNOWN_ACTION`, `ACTION_NOT_OPEN` (only `declared`/`discussed` commit), `COMMIT_NOT_ALLOWED`
and `GROUP_SIGNOFF_REQUIRED`. The DM commits with authority `dm`. A party-scope action needs a
party member: `group` authority when exactly one human player controls the party, otherwise
`GROUP_SIGNOFF_REQUIRED`. A character action needs control of that character: in turn mode
only the active actor (`active-player`), in free mode only the declarer (`declarer`).

## The gate API

`createGate({ db, rng?, newId?, appendSessionEvents? })` returns `submit(sessionId, proposer,
proposal)`, `handle(sessionId, proposer, request)` and `onAppended(listener)`. Both entries
parse with the Zod schema first; a parse failure is `INVALID_PROPOSAL` and nothing is written.
`GateResult` is `applied` (events, `batchId`), `pending` (ask), `suggested`, `decided`
(approve, reject, seat, policy), or `{ ok: false, refusal }`. A `GateRefusal` has a `source`
(`gate`, `engine`, `append`), a `code` and a `message`. The gate holds no proposal state: each
attempt calls `loadProjections` (DM view) and derives everything from the log, so a restart
loses nothing.

**Refuse before write.** Permission, routing, `planProposal` (engine and authority checks) and
catalog vetting all run before any append. For `ask`/`suggest` the gate runs a legality check
with a throwaway RNG, then appends one `dm`-visibility `proposal.created` row.

**Atomic approval.** `proposal.approve` (only `ask` proposals, only pending ones) re-plans the
stored proposal as the AI DM with a fresh RNG and appends the effect rows plus
`proposal.approved` in one batch. `suggest` proposals refuse `PROPOSAL_NOT_APPROVABLE`.

**Concurrency.** Every write passes `expectedLastSeq` (the projection's `throughSeq`) to
`appendBatch` ([[event-log]]). On `SeqConflictError` the gate re-reads and retries, at most 3
attempts, then refuses `CONFLICT`. Catalog refusals surface as `source: "append"`. After a
successful append each `onAppended` listener gets the stored rows in `seq` order; a throwing
listener is logged, not propagated. `index.ts` wires `gate.onAppended(gateway.publish)`.

## The write boundary (AC #1)

"No code path writes LLM output to the log except through a typed proposal." The test
`apps/server/test/write-boundary.test.ts` uses a TypeScript-API import graph
(`test/helpers/import-graph.ts`, `checkWriteBoundary`) over `apps/server/src`: `append` and
`appendBatch` may be imported only by `session/events.ts`; `appendSessionEvent`,
`appendSessionEvents` and `appendMechanicsBatch` only under `gate/`; `appendUncataloguedEvent`
only by `ws/gateway.ts`; no writer's transitive closure reaches `ai/`; a non-literal dynamic
`import()` fails. A seeded violation tree under `test/fixtures/write-boundary/src` proves the
checker trips three rules; it is excluded from Biome and the test tsconfig.

## Legacy path

The WebSocket `send` for an uncatalogued event type still appends through
`appendUncataloguedEvent`. TASK-0099 retires it.

## Connections

Pure core: [[session-model]]. Writes through [[event-log]]. Delivery: [[websocket-gateway]],
[[subscriber-registry]], [[replay-live-boundary]]. Frame errors: [[ws-protocol]].
