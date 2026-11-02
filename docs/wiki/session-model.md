---
name: session-model
description: The session model (packages/session-model) - typed event catalog (talk, lifecycle, state-change, marker, record, proposal), the mechanics envelope, canSee visibility, the pure project() fold into scene/party/encounter/journal/proposal views, the pure gate core and turn rules (see proposal-gate), ten fixtures, and the server seam (appendSessionEvent(s), loadDmSeat, loadProjections). Read before emitting, replaying or rendering session events.
kind: component
sources:
  - packages/session-model/package.json
  - packages/session-model/src/index.ts
  - packages/session-model/src/catalog.ts
  - packages/session-model/src/visibility.ts
  - packages/session-model/src/stored-event.ts
  - packages/session-model/src/events/mechanics.ts
  - packages/session-model/src/projections/apply.ts
  - packages/session-model/src/projections/types.ts
  - packages/session-model/src/events/presence.ts
  - packages/session-model/src/events/scene-presence.ts
  - packages/session-model/src/fixtures/index.ts
  - packages/session-model/src/gate/plan.ts
  - packages/session-model/src/gate/signoff.ts
  - packages/session-model/src/gate/turn.ts
  - packages/session-model/src/fixtures/group-signoff.ts
  - packages/session-model/src/fixtures/turn-floor.ts
  - apps/server/src/session/events.ts
  - apps/server/src/session/projections.ts
verified_against: 095b85f615387975ce3ae59a3c95aa46ca903b10
---

# Session model

`packages/session-model` (`@the-stacks/session-model`) defines what a session's events are and
how a stream of them folds into the views a client renders. It is pure and client-importable: a Biome override on `packages/session-model/src/**` forbids server, web,
database, network, model and clock imports and globals ([[monorepo-and-toolchain]]), and
the engine override forbids the reverse import. It depends on [[dnd5e-engine]] for the
engine's event schema. Rows live in the [[event-log]]; it never touches the database.

## Catalog and kinds

`catalog` lists one entry per `(type, version)`: `type`, `version`, `kind`, `visibility`
(`any` or `dm-only`), the Zod `schema`, and `current` (the version appended today).
Six kinds exist:

| kind | types |
|---|---|
| talk | `talk`, `narration` (a public IC `talk` row from a human or companion can queue a DM reaction: [[dm-talk-triggers]]) |
| lifecycle | `action.declared`, `action.commented`, `action.committed`, `action.resolved`, `action.withdrawn` |
| state-change | `table-mode.changed`, `scene.changed`, `scene-presence.changed`, `party.member.changed`, `tracker.changed` (dm-only), `dm.seat.changed`, `gate.policy.changed`, plus engine events that change state |
| marker | engine events `dice.rolled`, `attack.resolved`, `check.resolved`, `rest.completed`, and `presence.recorded` |
| record | `journal.entry.added` |
| proposal | `proposal.created`, `proposal.approved`, `proposal.rejected` (all `dm-only`) |

`dm.seat.changed` carries the new `DmSeat` (`{kind:"ai"}` or `{kind:"human",userId}`);
`gate.policy.changed` carries `proposalKind`, `before` and `after` policy. `proposal.created`
holds `{ proposalId, policy, proposal }`; `proposal.approved` `{ proposalId, batchId }`;
`proposal.rejected` `{ proposalId, reason }`. `action.withdrawn` (TASK-0114) holds `{ actionId }` and closes the action. `scene-presence.changed` (TASK-0141; `public`, or `dm` for a seed row, [[seed-npc-presence]]) holds `{ actorId, before, after, reason, actionId }`: `reason` is one of `PresenceReasonSchema` (`arrived`, `left`, `fled`, `removed`, `surrendered`, `conceded`) and fixes `after` through `REASON_TO_PRESENCE` (`present`, `absent` or `yielded`). `presence.recorded` (decision-0024; visibility
`any`, written `public` by `actor: "system"`) holds `{ present, purpose, actionId? }`: `present` is
the sorted, unique user ids of the humans at the table (at most 64), `purpose` is `director`
(per DM turn), `signoff` (by the gate in a group commit batch) or `floor` (an AI DM floor pass). See [[presence]].

Engine event types derive from `EngineEventSchema`; there is no second list. State-change payloads carry `before` and `after`.

## The mechanics wrapper

Every engine event is stored with its type as the row type and a
`MechanicsEnvelopeV1` payload: `{ batchId, index, count, actionId, proposalId, event }`.
One engine `execute` result becomes one batch: `index` is below `count` (max 500), and
`payload.event.type` must equal the row type (`decodeEvent` reports a mismatch as invalid).
`actionId` and `proposalId` link rows to an action and a proposal.

## Visibility

`canSee(viewer, visibility)` is the one rule. A `{ role: "dm" }` viewer sees everything. A
player sees `public` and a row whose visibility equals the player's `userId`, never `dm`. `tracker.changed` and the `proposal.*` types are `dm-only`: the server refuses any
other visibility (`VISIBILITY_NOT_ALLOWED`), and the fold drops them for players. Live
delivery uses the same function per connection ([[subscriber-registry]]).

## Projections and replay

`project(events, viewer)` equals `events.reduce(applyEvent, emptyProjections(viewer))`. It is
pure, total and never throws. `SessionProjections` holds: `scene`, `tableMode`, `party`,
`encounter`, `journal`, `transcript`, `actions` (lifecycle status), `ledger`, DM-only
`trackers`, `scenePresence` (per actor id: `presence`, `reason`, `seq`; no entry means present), `gate` (`seat`, `policyOverrides`; default AI seat), `proposals` (`ProposalView`s with a status, DM view only; `pendingProposals`, `findProposal`), the folded `engine` state (via the engine's `evolve`, never recomputed rules),
`presence` (a `PresenceView` of `present`, `purpose`, `actionId` and the marker's `seq`; `null`
until a marker folds, and each marker replaces the last), `throughSeq`, and `diagnostics`. The
marker adds no transcript entry. Inside `applyEvent`, hidden rows are dropped
uncounted and do not move `throughSeq`; a row at or below `throughSeq` counts as `outOfOrder`;
then the row is decoded and applied. Replay for one viewer is deterministic.

## Unknown-type tolerance

`decodeEvent` returns `known`, `unknown-type`, `unknown-version` or `invalid`. The fold
skips the last three and bumps `skippedUnknownType`, `skippedUnknownVersion` or
`skippedInvalid`. Other diagnostics count ignored lifecycle
transitions, `before` mismatches, engine rejections and incomplete batches.

## Gate core

`src/gate/` is the pure decision core: `checkPermission`, `commitAuthority`, `signoffState`
(the group sign-off rule over public projections; see [[proposal-gate]]), the turn rules in `gate/turn.ts` ([[turn-floor]]), `routeProposal`
with `DEFAULT_POLICIES` and `effectivePolicy`, and `planProposal` / `mechanicsRows` (turn a
proposal into catalog rows, or a refusal, using the engine; refuses `CHARACTER_UNABLE` for a downed or absent declarer; the `scene-presence` kind plans the change row plus an engine `initiative.leave` or `initiative.join` when the actor is in or joins the order). All are exported from the package
index. Kinds, policies, authority and the server wrapper: [[proposal-gate]].

## Fixtures contract

The `@the-stacks/session-model/fixtures` subpath exports ten stored-event streams
(`talkOnly`, `freeModeAction`, `turnModeCombat`, `secretTracker`, `unknownAndInvalid`,
`dmApprovals`, `commitAuthority`, `presenceMarker`, `groupSignoff`, `turnFloor`) as `fixtures`, plus the `proposalExamples` set, plus `recipes`, `fixtureIds`. The `group-signoff` fixture (three humans) walks a party action through approve, object and a
quorum commit with its `signoff` marker. The `turn-floor` fixture walks floor passing ([[turn-floor]]).
They are shared test input on a separate subpath; the main entry holds no test data.

## Server seam

`apps/server/src/session/events.ts`:
- `appendSessionEvent(db, input)` vets against the current version, then calls `append`.
- `appendMechanicsBatch(db, input)` assigns a `batchId`, builds rows through the pure `mechanicsRows`, vets every
  envelope first, then calls `appendBatch` (atomic, consecutive `seq`; [[event-log]]).
- `appendSessionEvents(db, inputs, options?)` vets every input, then calls `appendBatch`,
  forwarding `expectedLastSeq` (stale: `SeqConflictError`, [[event-log]]). The gate uses it.
- `loadDmSeat(db, sessionId)` returns the `after` of the latest `dm.seat.changed` row, else the
  AI seat.
- `SessionEventRefused` carries a code: `UNKNOWN_EVENT_TYPE`, `UNKNOWN_EVENT_VERSION`,
  `INVALID_PAYLOAD`, `TYPE_MISMATCH`, `VISIBILITY_NOT_ALLOWED`, `INVALID_VISIBILITY`,
  `CATALOG_TYPE_REQUIRES_GATE`. A refusal writes nothing.
- `toStoredEvent` converts a row (Date `ts`) to a `StoredEvent` (ISO `ts`).

`apps/server/src/session/projections.ts`: `loadProjections(db, sessionId, viewer, opts?)` reads the
log from seq 0 in `readFrom` batches of 200 and folds it. With `opts.throughSeq`, it stops at the
first row above that seq, so the result is the state as of `throughSeq`. The chronicle job uses
it to snapshot the state at its transcript end ([[actor-snapshot]]).

## Connections

Writes go through the gate ([[proposal-gate]]); live delivery filters per viewer in
[[subscriber-registry]] and [[websocket-gateway]]; the web table that folds them is
[[play-route]]. The AI DM ([[dm-runtime]]) reads the DM-role projection and writes only through the gate. Specs:
`specs/028-session-model/`, `specs/029-proposal-gate/`.
