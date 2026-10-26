---
name: session-model
description: The session model (packages/session-model, TASK-0044) - the typed event catalog (talk, lifecycle, state-change, marker, record), the mechanics envelope wrapping engine events, canSee visibility, the pure project() fold into scene/party/encounter/journal/transcript/ledger views, unknown-type tolerance, the fixtures subpath, and the server seam (appendSessionEvent, appendMechanicsBatch, loadProjections). Read before emitting, replaying or rendering session events.
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
  - apps/server/src/session/events.ts
  - apps/server/src/session/projections.ts
verified_against: 3551d0de8b97eb32651d726ac1707df233834502
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
Five kinds exist:

| kind | types |
|---|---|
| talk | `talk`, `narration` |
| lifecycle | `action.declared`, `action.commented`, `action.committed`, `action.resolved` |
| state-change | `table-mode.changed`, `scene.changed`, `party.member.changed`, `tracker.changed` (dm-only), plus engine events that change state |
| marker | engine events `dice.rolled`, `attack.resolved`, `check.resolved`, `rest.completed` |
| record | `journal.entry.added` |

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
sees `dm`. `tracker.changed` is `dm-only`: the server refuses any other visibility
(`VISIBILITY_NOT_ALLOWED`), and the fold drops it for players.

## Projections and replay

`project(events, viewer)` equals `events.reduce(applyEvent, emptyProjections(viewer))`. It is
pure, total and never throws. `SessionProjections` holds: `scene`, `tableMode`, `party`,
`encounter`, `journal`, `transcript`, `actions` (lifecycle status), `ledger`, DM-only
`trackers`, the folded `engine` state (via the engine's `evolve`, never recomputed rules),
`throughSeq`, and `diagnostics`. Order inside `applyEvent`: hidden rows are dropped
uncounted and do not move `throughSeq`; a row at or below `throughSeq` counts as `outOfOrder`;
then the row is decoded and applied. Replaying the same stream for the same viewer gives the
same projection, so a client can rebuild state from `seq` 0.

## Unknown-type tolerance

`decodeEvent` returns `known`, `unknown-type`, `unknown-version` or `invalid`. The fold
skips the last three and bumps `skippedUnknownType`, `skippedUnknownVersion` or
`skippedInvalid`; one bad row never stops a replay. Other diagnostics count ignored lifecycle
transitions, `before` mismatches, engine rejections and incomplete batches.

## Fixtures contract

The `@the-stacks/session-model/fixtures` subpath exports five stored-event streams
(`talkOnly`, `freeModeAction`, `turnModeCombat`, `secretTracker`, `unknownAndInvalid`) as
`fixtures`, plus `recipes` and `fixtureIds`. They are the shared input for server, client and
later DM tests, and are a separate subpath so the main entry stays free of test data.

## Server seam

`apps/server/src/session/events.ts`:
- `appendSessionEvent(db, input)` vets against the current catalog version, then calls `append`.
- `appendMechanicsBatch(db, input)` assigns a `batchId`, wraps each engine event, vets every
  envelope first, then calls `appendBatch` (atomic, consecutive `seq`; see [[event-log]]).
- `SessionEventRefused` carries a code: `UNKNOWN_EVENT_TYPE`, `UNKNOWN_EVENT_VERSION`,
  `INVALID_PAYLOAD`, `TYPE_MISMATCH`, `VISIBILITY_NOT_ALLOWED`, `INVALID_VISIBILITY`.
  A refusal writes nothing.
- `toStoredEvent` converts a row (Date `ts`) to a `StoredEvent` (ISO `ts`).

`apps/server/src/session/projections.ts`: `loadProjections(db, sessionId, viewer)` reads the
log from seq 0 in `readFrom` batches of 200 and folds it.

## Connections

Live delivery of these events to the DM is TASK-0045's job: nothing here pushes to
[[subscriber-registry]] or [[websocket-gateway]], and the server does not yet call the engine.
Spec: `specs/028-session-model/`.
