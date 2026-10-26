---
name: session-model
description: The session model (packages/session-model) - typed event catalog (talk, lifecycle, state-change, marker, record, proposal), the mechanics envelope, canSee visibility, the pure project() fold into scene/party/encounter/journal/proposal views, the pure gate core (see proposal-gate), fixtures, and the server seam (appendSessionEvent(s), loadDmSeat, loadProjections). Read before emitting, replaying or rendering session events.
kind: component
sources:
  - packages/session-model/package.json
  - packages/session-model/src/index.ts
  - packages/session-model/src/catalog.ts
  - packages/session-model/src/visibility.ts
  - packages/session-model/src/stored-event.ts
  - packages/session-model/src/events/mechanics.ts
  - packages/session-model/src/projections/apply.ts
  - packages/session-model/src/fixtures/index.ts
  - packages/session-model/src/gate/plan.ts
  - apps/server/src/session/events.ts
  - apps/server/src/session/projections.ts
verified_against: 49c7de2be46b0cf6b94814c4ed0bb1bd4aa20bb7
---

# Session model

`packages/session-model` (`@the-stacks/session-model`) defines what a session's events are and
how a stream of them folds into the views a client renders. It is pure and
client-importable: a Biome override on `packages/session-model/src/**` forbids server, web,
database, network, model and clock imports and globals (see [[monorepo-and-toolchain]]), and
the engine override forbids the reverse import. It depends on [[dnd5e-engine]] for the
engine's event schema. Rows live in the [[event-log]]; this package never touches the database.

## Catalog and kinds

`catalog` lists one entry per `(type, version)`: `type`, `version`, `kind`, `visibility`
(`any` or `dm-only`), the Zod `schema`, and `current` (the version the server appends today).
Six kinds exist:

| kind | types |
|---|---|
| talk | `talk`, `narration` |
| lifecycle | `action.declared`, `action.commented`, `action.committed`, `action.resolved` |
| state-change | `table-mode.changed`, `scene.changed`, `party.member.changed`, `tracker.changed` (dm-only), `dm.seat.changed`, `gate.policy.changed`, plus engine events that change state |
| marker | engine events `dice.rolled`, `attack.resolved`, `check.resolved`, `rest.completed` |
| record | `journal.entry.added` |
| proposal | `proposal.created`, `proposal.approved`, `proposal.rejected` (all `dm-only`) |

`dm.seat.changed` carries the new `DmSeat` (`{kind:"ai"}` or `{kind:"human",userId}`);
`gate.policy.changed` carries `proposalKind`, `before` and `after` policy. `proposal.created`
holds `{ proposalId, policy, proposal }`; `proposal.approved` holds `{ proposalId, batchId }`;
`proposal.rejected` holds `{ proposalId, reason }`.

Engine event types are derived from `EngineEventSchema`, so the catalog tracks the engine
without a second list. State-change payloads carry `before` and `after`.

## The mechanics wrapper

Every engine event is stored with its own type as the row type and a
`MechanicsEnvelopeV1` payload: `{ batchId, index, count, actionId, proposalId, event }`.
One engine `execute` result becomes one batch: `index` is below `count` (max 500), and
`payload.event.type` must equal the row type (`decodeEvent` reports a mismatch as invalid).
`actionId` and `proposalId` link rows to a player action and to a gated proposal.

## Visibility

`canSee(viewer, visibility)` is the one rule. A `{ role: "dm" }` viewer sees everything. A
player sees `public`, and a row whose visibility equals the player's `userId`. A player never
sees `dm`. `tracker.changed` and the `proposal.*` types are `dm-only`: the server refuses any
other visibility (`VISIBILITY_NOT_ALLOWED`), and the fold drops them for players. Live
delivery uses the same function per connection ([[subscriber-registry]]).

## Projections and replay

`project(events, viewer)` equals `events.reduce(applyEvent, emptyProjections(viewer))`. It is
pure, total and never throws. `SessionProjections` holds: `scene`, `tableMode`, `party`,
`encounter`, `journal`, `transcript`, `actions` (lifecycle status), `ledger`, DM-only
`trackers`, `gate` (`seat`, `policyOverrides`; default AI seat), `proposals` (`ProposalView`s with a status, DM view only; `pendingProposals`, `findProposal`), the folded `engine` state (via the engine's `evolve`, never recomputed rules),
`throughSeq`, and `diagnostics`. Order inside `applyEvent`: hidden rows are dropped
uncounted and do not move `throughSeq`; a row at or below `throughSeq` counts as `outOfOrder`;
then the row is decoded and applied. Replaying the same stream for the same viewer gives the
same projection, so a client can rebuild state from `seq` 0.

## Unknown-type tolerance

`decodeEvent` returns `known`, `unknown-type`, `unknown-version` or `invalid`. The fold
skips the last three and bumps `skippedUnknownType`, `skippedUnknownVersion` or
`skippedInvalid`; one bad row never stops a replay. Other diagnostics count ignored lifecycle
transitions, `before` mismatches, engine rejections and incomplete batches.

## Gate core

`src/gate/` is the pure decision core: `checkPermission`, `commitAuthority`, `routeProposal`
with `DEFAULT_POLICIES` and `effectivePolicy`, and `planProposal` / `mechanicsRows` (turn a
proposal into catalog rows, or a refusal, using the engine). All are exported from the package
index. The kinds, policy table, authority rules and server wrapper are described in
[[proposal-gate]].

## Fixtures contract

The `@the-stacks/session-model/fixtures` subpath exports seven stored-event streams
(`talkOnly`, `freeModeAction`, `turnModeCombat`, `secretTracker`, `unknownAndInvalid`,
`dmApprovals`, `commitAuthority`) as `fixtures`, plus the `proposalExamples` set, plus `recipes` and `fixtureIds`. They are the shared input for server, client and
later DM tests, and are a separate subpath so the main entry stays free of test data.

## Server seam

`apps/server/src/session/events.ts`:
- `appendSessionEvent(db, input)` vets against the current catalog version, then calls `append`.
- `appendMechanicsBatch(db, input)` assigns a `batchId`, wraps each engine event, vets every
  envelope first, then calls `appendBatch` (atomic, consecutive `seq`; see [[event-log]]).
- `appendSessionEvents(db, inputs, options?)` vets every input, then calls `appendBatch`,
  forwarding `expectedLastSeq` (stale: `SeqConflictError`, [[event-log]]). The gate uses it.
- `appendUncataloguedEvent(db, input)` is the legacy `send` path: it refuses any catalogued
  type, else calls `append`.
- `loadDmSeat(db, sessionId)` returns the `after` of the latest `dm.seat.changed` row, else the
  AI seat.
- `appendMechanicsBatch` now builds its rows through the pure `mechanicsRows`.
- `SessionEventRefused` carries a code: `UNKNOWN_EVENT_TYPE`, `UNKNOWN_EVENT_VERSION`,
  `INVALID_PAYLOAD`, `TYPE_MISMATCH`, `VISIBILITY_NOT_ALLOWED`, `INVALID_VISIBILITY`,
  `CATALOG_TYPE_REQUIRES_GATE`.
  A refusal writes nothing.
- `toStoredEvent` converts a row (Date `ts`) to a `StoredEvent` (ISO `ts`).

`apps/server/src/session/projections.ts`: `loadProjections(db, sessionId, viewer)` reads the
log from seq 0 in `readFrom` batches of 200 and folds it.

## Connections

Writes are routed through the gate ([[proposal-gate]]); live delivery to subscribers filters
per viewer in [[subscriber-registry]] and [[websocket-gateway]]; the web table that folds and
renders them is [[play-route]]. The AI DM ([[dm-runtime]]) reads the DM-role projection (`loadProjections(db, id, { role: "dm" })`) and writes only through the gate. Specs:
`specs/028-session-model/`, `specs/029-proposal-gate/`.
