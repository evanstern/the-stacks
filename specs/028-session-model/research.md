# Research: First Scene — session model

Phase 0 for [plan.md](plan.md). Each entry records one decision, why, and what was rejected.
Grounding read for this pass: architecture A4, A10, A11, A12; decision-0014, -0016, -0017,
-0020, -0021; constitution 2.0.0; `apps/server/src/events/log.ts`,
`apps/server/src/schema/events.ts`, `apps/server/src/ws/registry.ts`; wiki notes `event-log`,
`ws-protocol`, `replay-live-boundary`; the TASK-0042 contracts in
`specs/026-dnd5e-engine/contracts/` and `packages/dnd5e-engine/src/`.

## R1. Where the code lives: a new pure package plus a thin server seam

**Decision.** Put event schemas, the catalog, the visibility function, projections and
fixtures in a new workspace package `@the-stacks/session-model` (`packages/session-model`).
Put the database-touching code (validated append, mechanics batch append, replay from the
log) in `apps/server/src/session/`, the session plane's directory that `biome.json` already
fences off from `library/` and `codex/`.

**Rationale.** The play route (TASK-0047) must fold the same events with the same code, from
fixtures and from the live socket, and `biome.json` forbids `apps/web` from importing the
server plane. So the folding code cannot live in `apps/server`. A dedicated package (rather
than `packages/shared`) earns its own purity rule: like the engine, projections must be
deterministic, so the package may not touch a clock, the network, a database or Node APIs.
`packages/shared` carries web helpers and has no such rule; adding the rule there would bind
unrelated code. The package depends only on `zod` and `@the-stacks/dnd5e-engine`, both
already in the workspace.

**Alternatives rejected.**
- `apps/server/src/session/` only: the web client cannot import it (constitution III rule in
  `biome.json`).
- `packages/shared/src/session/`: no purity rule, and `packages/shared` would gain an engine
  dependency that `apps/web` code unrelated to play would carry.
- Folding inside the engine package: the engine knows no actors, visibility or talk
  (engine-api.md consumer note), and its boundary forbids session concepts.

## R2. Mechanics events: wrap the engine event; type column carries the engine type

**Decision.** Each engine event is appended as one log row whose `type` is the engine event's
own `type` (`dice.rolled`, `hp.changed`, …) and whose payload is a **mechanics envelope**
(payload version 1):

```ts
{ batchId, index, count, actionId: string | null, proposalId: string | null, event: EngineEvent }
```

`event` is the engine event, unchanged, including its own `v`. The catalog refuses a row
whose `type` differs from `event.type`.

**Rationale.**
- `rollIndex` in engine events points into one `execute` result's `events` array
  (events.md). The atomic batch append (R10) gives a batch consecutive sequence numbers, but
  the index must not depend on that: a reader holding one row (a ledger row, a filtered
  stream, a future writer) resolves `rollIndex` from `batchId` plus `index` alone.
- The ledger and the transcript need to say which action a roll served; `actionId` carries
  it. `proposalId` is an opaque reference reserved for TASK-0045 (no proposal event is
  defined here).
- Keeping the engine type in the `type` column keeps the A4 vocabulary readable in the log
  and lets a consumer filter mechanics by type without parsing payloads.
- Keeping the engine event byte-for-byte inside the envelope preserves the ledger guarantees
  (reason, before, after) by construction: the envelope schema reuses
  `EngineEventSchema`.

**Deviation recorded.** engine-api.md's consumer note says "the engine event's `v` is the
payload's schema version". With an envelope, the payload has its own version, and the engine
`v` travels inside it. Phase 2 updates that consumer note in the same PR. No engine export
changes.

**Alternatives rejected.**
- Payload = the bare engine event, `payload_version` = engine `v`: loses batch position, so
  `rollIndex` cannot be resolved once rows interleave.
- One session type `engine` for all mechanics rows: hides the vocabulary from the `type`
  column and from every type filter.
- Prefixed types (`engine.hp.changed`): workable; rejected as noise because engine type names
  do not collide with session names. A test pins the no-collision rule (Open Question 1 in
  spec.md).

## R3. The DM-only visibility marker

**Decision.** Reserve the visibility value `dm`. The package exports
`canSee(viewer, visibility)`:

- `public` → every viewer.
- `dm` → the DM viewer only.
- any other value → the player whose `userId` equals it, and the DM viewer.

Tracker events must carry `dm` (catalog rule, enforced at append). Player projections also
drop tracker events whatever their marker (defence in depth).

**Rationale.** The M0 rule in `registry.ts` (`public` or the viewer's own user id) is kept and
extended by one value. User ids are UUIDs, so no user id equals `dm`; under the M0 rule a `dm`
event already reaches no WebSocket connection, which fails safe. The DM is omniscient, so the
DM viewer also sees whispers.

**Not changed here.** `registry.ts` keeps its M0 rule. Live delivery of `dm` events to a DM
connection is needed by TASK-0045 (its AC #4: DM-only `proposal.created`), and that card
adopts `canSee` in the registry. TASK-0095 (another session) is editing the same WebSocket
files; touching them here would collide with it for no M2 benefit, because no `dm` event has
a live consumer until TASK-0045.

**Alternatives rejected.** Using the operator's user id as the marker: the AI DM has no user
id, and fixtures would hard-code one operator.

## R4. Which events are "state changes" (AC #6)

**Decision.** Every catalog entry declares a kind:

| Kind | Types | Ledger obligation |
|---|---|---|
| `talk` | `talk`, `narration` | none; transcript only |
| `lifecycle` | `action.declared`, `action.commented`, `action.committed`, `action.resolved` | none; actions projection and transcript |
| `state-change` | `table-mode.changed`, `scene.changed`, `party.member.changed`, `tracker.changed`, and the 14 engine state-change events | `reason`, `before`, `after` |
| `marker` | `dice.rolled`, `attack.resolved`, `check.resolved`, `rest.completed` | `reason` (rolls also carry faces and total) |
| `record` | `journal.entry.added` | none; journal only |

Session state-change events copy the engine's convention: `before` and `after` hold exactly
the slice changed, and `null` stands for "absent" (join, leave, create, delete). A meta-test
walks the catalog and asserts every `state-change` schema requires `reason`, `before` and
`after`, and every `marker` schema requires `reason`.

**Rationale.** AC #6 says every state-change event records before and after. Lifecycle events
change no game state; their effect is fully described by the event itself, and inventing
before/after for them adds noise.

## R5. Table mode is explicit, not derived from the engine's turn order

**Decision.** `table-mode.changed` is the only source of the mode and the active player. A
session starts in free mode. Turn mode names `activeActor` (who may commit) and, when known,
`activeCharacterId`. The projection applies `after` (as engine `evolve` does) and counts a
`before` that differs from the projected mode as `beforeMismatches`.

**Rationale.** decision-0016 gives the Director the mode switch, and A12 says turn mode
"records the active player": a player (actor), not a combatant. The engine's `turn.advanced`
names a combatant, and mapping a combatant to a player needs the party projection. Whoever
advances the turn (TASK-0046's `resolve` or Director) appends both events. Commit authority
(TASK-0045) reads one field.

**Alternative rejected.** Deriving the active player from the engine encounter: two sources
of truth for one authority decision, and turn mode can exist without an engine encounter (a
social standoff run in turns).

## R6. Projection semantics: pure fold, per viewer, tolerant

**Decision.**

- `applyEvent(projections, storedEvent)` returns new projections and never mutates its input.
  `project(events, viewer)` equals reducing `applyEvent` from `emptyProjections(viewer)`. An
  implementation may use a private mutable accumulator inside `project` when the result is
  deeply equal.
- An event at or below `throughSeq` is ignored and counted as `outOfOrder`. This makes a
  duplicated live delivery (TASK-0095's bug) harmless to projections.
- An event the viewer may not see is dropped silently. It is never counted: a count would
  leak the number of hidden events to a player.
- Unknown type, unknown version and schema failure are skipped and counted (AC #8).
- Engine `evolve` throws when an event names a combatant the state lacks (possible for a
  player who cannot see a hidden `combatant.added`). The fold catches it, keeps the state, and
  counts `engineRejected`.
- `throughSeq` and `diagnostics` are fold bookkeeping, not projections. AC #2's comparison
  ("no projection except the transcript changes") excludes them.

**Rationale.** These are the rules that make AC #7 (identical rebuild) and AC #8 (tolerance)
hold together, and they keep the fold total: no input stream makes it throw.

## R7. Party and encounter read the engine's fold

**Decision.** The projection keeps `engine: EngineState`, folded with the engine's own
`evolve` over the viewer's visible mechanics events. Party members (from
`party.member.changed`) link to a combatant id; the party view joins each member to its
combatant's HP, life state, death saves and conditions. The encounter view is the engine's
`encounter` joined to combatant names and states.

**Rationale.** Constitution VI and FR-012: no projection recomputes a rule. Exposing `engine`
also gives TASK-0045 the exact `EngineState` to pass to `execute` (from the DM viewer).

## R8. Fixtures: static TypeScript data plus recipes, exported from a subpath

**Decision.** Fixtures live in `packages/session-model/src/fixtures/`, one module per stream,
exported from the subpath `@the-stacks/session-model/fixtures`. Each fixture is static data:
a name, a description, the viewers it targets, and `StoredEvent[]` with fixed `seq`, `ts`,
`sessionId` and actors. Each mechanics batch also has a **recipe** (engine command plus
scripted faces). A test re-runs every recipe through `execute` against the DM fold of the
events before the batch and asserts the committed engine events equal the result.

**Rationale.** Static data is what a UI renders and what a reviewer reads; recipes keep the
engine events honest without making fixtures depend on running the engine at import time.
TypeScript (not JSON) gives the consumers types and lets the package build emit them without
a copy step. A subpath keeps fixtures out of the main entry, so production code imports them
only on purpose.

**Alternatives rejected.** JSON under root `fixtures/` (that tree is Biome-ignored and holds
boundary violations; JSON needs a copy step to ship in `dist`); generating fixtures at import
time (couples every consumer to the engine's RNG at load).

## R9. Server seam: validated append, batch append, replay

**Decision.** `apps/server/src/session/` gains:

- `appendSessionEvent(db, input)`: decode against the catalog, check the visibility rule,
  then call M0 `append` with the catalog's current version. A refusal throws
  `SessionEventRefused` with a code and writes nothing.
- `appendMechanicsBatch(db, input)`: assign a `batchId` (`randomUUID`), wrap each engine event
  in an envelope with its index and the batch count, validate every envelope against the
  catalog first (refuse before write), then append all rows in one transaction through the
  log's new `appendBatch` (R10).
- `loadProjections(db, sessionId, viewer)`: read the log from sequence 0 with `readFrom` in
  batches of 200 (the same bound as the WebSocket replay) and fold with `project`.
- `toStoredEvent(recorded)`: convert a log row (Drizzle `Date` timestamp) to the package's
  `StoredEvent` (ISO string), so server and client fold identical values.

No route, WebSocket frame or job changes. The gate (TASK-0045) and the DM runtime (TASK-0046)
are the callers.

## R10. Batch atomicity: an atomic `appendBatch` beside `append`

*Amended 2026-10-26 by orchestrator ruling on plan Open Question 3.* The first draft left
atomicity to TASK-0045 and tolerated half-written batches. The ruling: TASK-0045's AC #8 is
refuse-before-write, not batch atomicity, so tolerating a half-written batch was an uncarded
"for now" (decision-0020). This card owns atomicity.

**Decision.** `apps/server/src/events/log.ts` gains `appendBatch(db, inputs)`:

- One `db.transaction`. Its first statement takes the same
  `pg_advisory_xact_lock(EVENT_LOG_LOCK_NAMESPACE, hashtext(sessionId))` as `append`.
- Every input must name the same `sessionId`, and `seq`/`ts` keys are refused, with the same
  runtime guard as `append`. Both checks run before the transaction opens.
- Inside the lock, it reads `MAX(seq)` once and inserts the rows in input order with
  `seq = max + 1 … max + n` (one multi-row insert, or one insert per row inside the same
  transaction; either is atomic).
- Any error rolls the whole transaction back: zero rows land. It returns the recorded rows in
  order.

`append` and `readFrom` keep their code and behaviour; the table, its trigger and its
constraints are unchanged. `appendBatch` lives in `log.ts` because the lock namespace is a
private constant there, and a second copy of it could drift (the wiki's `event-log` note
records why the lock exists).

`appendMechanicsBatch` validates every envelope before it calls `appendBatch`, so a schema
failure writes nothing, and a database failure mid-insert rolls back.

**Defensive check kept.** `diagnostics.incompleteBatches` stays in the fold, because the fold
must be total over any stream (AC #8) and rows can reach the log without the seam (M0
`append` is still exported). The database suite proves the server's write path never produces
an incomplete batch.

**Failure-injection test.** The suite calls `appendBatch` with rows whose third row violates
the table's `events_payload_version_positive` check (`payloadVersion: 0`). The insert fails
inside the transaction after earlier rows were inserted; the test asserts `readFrom` returns
no row of that batch and that the session's next append still receives the next gapless
`seq`. A second test makes `appendMechanicsBatch` fail the same way through an injected
`deps.appendBatch` that forwards a corrupted row, and asserts the same.

**Alternatives rejected.**
- Exporting the lock namespace and building the transaction in `apps/server/src/session/`:
  two modules would own the sequencing rule.
- A Postgres function or a new column: a migration, for no gain over one transaction.
- Leaving atomicity to TASK-0045: rejected by the ruling above.

## R11. Dependencies and migration

- **New runtime dependencies: none.** The new package uses `zod ^4.6.5` and
  `@the-stacks/dnd5e-engine` (workspace). `apps/server` adds workspace dependencies on
  `@the-stacks/session-model` and `@the-stacks/dnd5e-engine`. Dev: `vitest ^5.0.1`, already
  in the lockfile.
- **Migration: none.** No column, table, index or trigger changes; `appendBatch` uses the
  existing table, lock and constraints. Payloads stay JSONB;
  versions use the existing `payload_version` column; the `dm` marker fits the existing
  `visibility` text column.
