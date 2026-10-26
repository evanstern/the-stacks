# Implementation Plan: First Scene — session model (talk, actions, table modes, ledger, projections)

**Branch**: `task-0044-session-model` | **Date**: 2026-10-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/028-session-model/spec.md` (board card TASK-0044).

**Amended 2026-10-26** (orchestrator ruling on Open Question 3): mechanics batches are
appended atomically by this card through a new `appendBatch` in `log.ts` (research R10).
Phase 5 changed.

## Summary

Add the session plane's play vocabulary over the M0 event log, whose storage and existing
functions stay unchanged. A new pure workspace
package, `@the-stacks/session-model`, holds Zod schemas for 11 session event types plus a
mechanics envelope that wraps each of the engine's 18 event types; a versioned catalog; the
visibility rule (`public`, `dm`, or one user id); a total, per-viewer fold into scene, table
mode, party, encounter, journal, transcript, actions, ledger and DM-only trackers; and five
committed fixture streams exported from a subpath. The web client (TASK-0047) imports it
directly. A thin server seam in `apps/server/src/session/` validates appends against the
catalog, appends each engine result as one atomic numbered batch (a new `appendBatch` in
`log.ts`: one transaction under the existing sequencing lock), and rebuilds projections from
sequence 0 through `readFrom`. Database-backed tests prove identical rebuilds (AC #7) and that
an injected mid-batch failure leaves zero rows (AC #6, AC #7). No migration,
no new external dependency, no WebSocket change.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), ES2022, Node 22 for tests.

**Primary Dependencies**: `zod ^4.6.5` and `@the-stacks/dnd5e-engine` (both in the
workspace). **No new external runtime dependency.** `apps/server` gains workspace
dependencies on `@the-stacks/session-model` and `@the-stacks/dnd5e-engine`. Dev: `vitest
^5.0.1` (in the lockfile).

**Storage**: the M0 `events` table, unchanged. `log.ts` gains `appendBatch`; `append` and
`readFrom` are untouched. **Migration: none** (research R11).

**Testing**: Vitest unit tests in `packages/session-model/test/`; one Postgres integration
suite in `apps/server/test/session.integration.test.ts`, run with `REQUIRE_DATABASE=1` on the
worktree's own stack; the fixture-backed `pnpm check:boundaries`.

**Target Platform**: any ES2022 runtime. The package has no Node or DOM types, so the server
and the browser fold the same code.

**Project Type**: library package plus a server-plane seam.

**Performance Goals**: `project` folds 5,000 events in under 500 ms on a developer machine
(not gated; a long session's reconnect rebuild must stay interactive). `applyEvent` is O(size
of the changed slice), apart from array appends.

**Constraints**: pure and deterministic (no clock, I/O or randomness in the package); the
fold never throws; hidden events never leave a trace in a player's projection, diagnostics
included.

**Scale/Scope**: 11 session types, 18 wrapped engine types, 9 projections, 5 fixtures, 4
server functions.

## Constitution Check

*Pre-research gate: pass. Post-design re-check: pass (no change).* Against constitution
2.0.0.

- [x] **I. Agent-operable** — the interface is `appendSessionEvent`,
      `appendMechanicsBatch` and `loadProjections` (server) plus `project`/`applyEvent`
      (package). The AI DM (`ai:dm`) and AI companions (`ai:companion:<id>`) append and read
      through the same functions as a human's requests, via the gate (TASK-0045). No event
      type is human-only.
- [x] **II. Content contract** — N/A: no codex entity. Scene, party member and tracker are
      session-plane play records, not codex content; codex entities arrive in M4.
- [x] **III. Data planes** — all new state is session-plane: payloads in the session log and
      projections of it. Server code lives in `apps/server/src/session/`, already fenced from
      `library/` and `codex/` by `biome.json`. The new package gets its own boundary rule
      (no server, web, database, network, model or clock), proven by four violating
      fixtures (contracts/boundary-rule.md).
- [x] **IV. Event sourcing** — the log stays append-only (the new `appendBatch` only
      inserts, under the same lock, and an engine result lands whole or not at all); every new type is
      Zod-typed and versioned through `payload_version`; the server validates before it
      appends and a refusal writes nothing; secret trackers live in `dm`-visibility events
      and are filtered per viewer at projection time; projections skip unknown types and
      versions. LLM output reaching the log only as a proposal is TASK-0045's gate (this card
      adds no LLM write path).
- [x] **V. Citations** — N/A: no library-derived claim; no retrieval change.
- [x] **VI. 5e engine boundary** — mechanics reach the log only as engine events produced by
      `execute` (wrapped, unchanged); projections fold them with the engine's own `evolve`
      and recompute no rule; fixture recipes regenerate every engine event through
      `execute` with scripted dice. The engine package does not change apart from its
      boundary rule gaining `@the-stacks/session-model` as a denied import.
- [x] **VII. Structured first** — N/A: no generated artifact.
- [x] **VIII. Operator-owned content** — fixtures use original characters (Ana, Bram) and an
      SRD-generic goblin; no book text, no proprietary content.
- [x] **IX. Self-hostable** — no container, service or model call; compose is unchanged.

**Stack conformance**: TypeScript, Zod, Postgres through Drizzle's existing log functions.
No departure.

## Project Structure

### Documentation (this feature)

```text
specs/028-session-model/
├── plan.md              # this file
├── research.md          # Phase 0: R1–R11
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── session-events.md   # types, versions, payloads, visibility, refusal codes
│   ├── projections.md      # projection shapes, fold rules, invariants
│   ├── fixtures.md         # the fixtures contract (TASK-0045, TASK-0047)
│   ├── package-api.md      # package surface and server seam
│   └── boundary-rule.md    # Biome purity rule and violating fixtures
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
packages/session-model/                  # NEW workspace package @the-stacks/session-model
├── package.json                         # exports "." and "./fixtures"
├── tsconfig.json                        # extends tsconfig.base.json; types: []
├── src/
│   ├── index.ts                         # public surface (package-api.md)
│   ├── ids.ts                           # RefId, ActorId, Visibility, PUBLIC, DM_ONLY
│   ├── stored-event.ts                  # StoredEventSchema
│   ├── visibility.ts                    # Viewer, canSee
│   ├── events/
│   │   ├── talk.ts                      # TalkV1, NarrationV1
│   │   ├── actions.ts                   # ActionDeclared/Commented/Committed/ResolvedV1
│   │   ├── table-mode.ts                # TableModeSchema, TableModeChangedV1
│   │   ├── scene.ts  party.ts  tracker.ts  journal.ts
│   │   └── mechanics.ts                 # MechanicsEnvelopeV1 over EngineEventSchema
│   ├── catalog.ts                       # catalog, catalogEntry, currentVersion, decodeEvent
│   ├── projections/
│   │   ├── types.ts                     # SessionProjections and views
│   │   ├── apply.ts                     # emptyProjections, applyEvent, project
│   │   ├── actions.ts  party.ts  encounter.ts  ledger.ts
│   └── fixtures/
│       ├── index.ts                     # fixtures, recipes, fixtureIds
│       ├── build.ts                     # row helpers (seq, ts) — plain data, no engine call
│       ├── talk-only.ts  free-mode-action.ts  turn-mode-combat.ts
│       ├── secret-tracker.ts  unknown-and-invalid.ts
│       └── recipes.ts
└── test/                                # tsconfig.json (types: node) + the files in quickstart.md

apps/server/src/session/                 # NEW: session-plane seam
├── events.ts                            # appendSessionEvent, appendMechanicsBatch, toStoredEvent, SessionEventRefused
└── projections.ts                       # loadProjections

apps/server/src/events/log.ts            # + appendBatch (atomic, same lock); append/readFrom unchanged
apps/server/test/session.integration.test.ts   # NEW: DB-backed AC #7, refusal writes nothing, mid-batch failure writes nothing

biome.json                               # + session-model override; engine override denies @the-stacks/session-model
fixtures/boundary-violations/packages/session-model/src/{bad-server,bad-clock,bad-database}.ts
fixtures/boundary-violations/packages/dnd5e-engine/src/bad-session-model.ts
tsconfig.json                            # + packages/session-model, packages/session-model/test references
apps/server/package.json, apps/server/tsconfig.json   # + workspace deps and project references
specs/026-dnd5e-engine/contracts/engine-api.md        # consumer note: envelope version (research R2)
```

**Structure Decision**: pure package plus server seam (research R1). `apps/web` is not
touched; TASK-0047 adds its dependency on `@the-stacks/session-model` when it builds the
route.

## Phases (one implementer dispatch each; see tasks.md)

1. **Package scaffold and boundary rule** — the package, workspace wiring, the Biome
   override and its four violating fixtures. `pnpm check:boundaries` green.
2. **Event schemas and catalog** — every schema, the catalog, `decodeEvent`, `canSee`.
   Catalog, decode and visibility tests (AC #1, AC #6 schema side, AC #8 decode side).
3. **Projections** — the fold and every projection; talk isolation, actions, table mode,
   projections, ledger, secrecy, replay and tolerance tests over hand-built streams
   (AC #2–#8 in memory).
4. **Fixtures** — the five fixture streams and recipes; the fixtures test, and the secrecy,
   replay and tolerance tests extended to run over every fixture.
5. **Atomic batch append, server seam and database suite** — `appendBatch` in `log.ts`,
   `apps/server/src/session/`, and the integration suite on the worktree stack with
   `REQUIRE_DATABASE=1`: AC #7 on a real log, AC #5 refusal, the mid-batch failure-injection
   tests (zero rows land; AC #6, AC #7), no incomplete batch through the seam, and the
   engine-api.md consumer note.
6. **Gate** — `pnpm ci:check` green; evidence recorded.

## Open Questions (operator; defaults applied, nothing blocks dispatch)

1. **Mechanics type naming** (spec Open Question 1). Default: engine types verbatim in the
   `type` column, no prefix.
2. **Envelope version** (spec Open Question 2). Default: wrapper version 1 with the engine's
   `v` inside; engine-api.md's consumer note is updated in Phase 5.
3. **Atomic batch append** (research R10). **Resolved 2026-10-26 by orchestrator ruling:**
   this card owns it. `appendMechanicsBatch` appends one engine result in one transaction
   under the log's sequencing lock, or nothing. The fold keeps only a defensive
   incomplete-batch check that the database suite proves unreachable through the seam.
4. **DM live delivery** (research R3). Default (stands; the orchestrator records it on the
   TASK-0045 card): TASK-0045 adopts `canSee` in the WebSocket registry when it adds DM-only
   proposals; until then `dm` events reach no WebSocket
   connection, which fails safe. No M2 surface reads `dm` events live before TASK-0045.

No "for now" in this plan: every deferral above names its owning card (decision-0020).

## Complexity Tracking

No constitution violation. One new workspace package, justified in research R1 (the web
client must import the fold; a purity rule needs its own fence).
