# Implementation Plan: Zone fog, `zone.revealed` and the per-viewer spatial projection

**Branch**: `task-0271-spatial-events` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/100-spatial-events/spec.md`

## Summary

Add one session event, `zone.revealed`, and one pure gate rule, `fogRows`, that sets the
visibility of every spatial engine row and writes the reveals it needs. Clients keep receiving
rows through the existing `canSee` filter, so hidden zones and placements never leave the server.
`project()` folds a per-viewer `SpatialView`. Seeds declare zones; the DM runtime defines the
space and places combatants; the actor snapshot renders zones and reach per view.

## Technical Context

**Language/Version**: TypeScript, Node 22, ES2022 target, as the repo.

**Primary Dependencies**: no new third-party dependency. Workspace edges added:
`@the-stacks/session-model` → `@the-stacks/space` and `@the-stacks/server` → `@the-stacks/space`
(`workspace:*`). Reason: `ZoneRevealedV1` and the seed schema reuse `ZoneSchema`, `EdgeSchema`
and `SpaceSchema` instead of copying them (spec OQ-11). `zod` already covers validation.

**Storage**: none. **No migration.** `zone.revealed` is a row in the existing `events` table.

**Testing**: Vitest in `packages/session-model/test/` and `apps/server/test/dm/`.

**Target Platform**: session-model stays pure and client-importable (boundary rule unchanged).

**Performance Goals**: `fogRows` < 1 ms for a 64-zone space and a 12-row plan (SC-005).

**Constraints**: no change to `apps/server/src/ws/`, `apps/server/src/events/log.ts`,
`apps/server/src/session/events.ts`, `docs/wiki/ws-protocol.md` frame shapes, or the engine.

**Scale/Scope**: about 6 session-model source files, 5 server source files, 4 seeds.

## Design

### Session model

**New `src/events/space.ts`**: `ZoneRevealedV1` and `ZoneRevealed` per
contracts/zone-revealed.md §2.

**`src/catalog.ts`**: add `session("zone.revealed", "state-change", ZoneRevealedV1)` to
`sessionEntries` and `"zone.revealed"` to `SessionPayloads`.

**New `src/projections/spatial.ts`**: `EMPTY_SPATIAL`, `foldReveal(spatial, viewer, payload)`,
`foldPlacement(spatial, engineEvent)`, `spatialFor`, `reachOf`, `targetStatus`
(contracts/spatial-projection.md §2–§3). One file, pure functions.

**`src/projections/types.ts`**: add `SpatialView` and `spatial` to `SessionProjections`.

**`src/projections/apply.ts`**: `emptyProjections` sets `spatial`; `applyKnown` gains a
`zone.revealed` case (fold, plus `sessionChangeRow`); `applyMechanics` calls `foldPlacement`
after `evolve` for `space.defined`, `combatant.added`, `combatant.placed`, `combatant.moved`,
`combatant.removed`.

**`src/projections/ledger.ts`**: `sessionChangeRow` accepts `zone.revealed`
(`subject: null`, `before: null`, `after: { zones: names, reset }`).

**New `src/gate/fog.ts`**: `fogRows(p, rows)` and `revealRows(p, actor, zoneIds, reason)` per
contracts/zone-revealed.md §3–§4. It imports `evolve` from the engine to advance its running
state across a plan's rows. It builds `zone.revealed` payloads with `ZoneRevealedV1.parse` so a
bad reveal throws in tests, never at runtime silently.

**`src/gate/plan.ts`**: `planProposal` becomes `validate(fog(p, plan(...)))`, where `fog` applies
`fogRows` to an `ok` result's rows and leaves a refusal alone. `batchId` is unchanged.

**`src/index.ts`**: the exports in contracts/spatial-projection.md §5.

**New fixture `src/fixtures/spatial-fog.ts`** (+ `fixtures/index.ts`): a scripted session built by
planning gate proposals: space defined with two hidden zones, party placed, a party move into a
hidden zone, a monster arrival in a hidden zone, a goblin crossing into fog, a DM-only move. The
viewers are the DM and two players. Tests in phases 1 and 2 share it.

### Server

**`src/dm/seed/schema.ts`**: `SceneSeedSchema` gains

```ts
space: z.object({
  zones: SpaceSchema.shape.zones, edges: SpaceSchema.shape.edges, start: ZoneIdSchema,
}).optional(),
// npcs[]: zone: ZoneIdSchema.optional()
// encounters[]: zone: ZoneIdSchema.optional()
```

and runs `SpaceSchema.safeParse({zones, edges})` in its refinement.

**`src/dm/seed/load.ts`**: `crossCheckSeed` adds the FR-021 checks.

**`src/dm/nodes/resolve.ts`** (the only runtime writer touched):

- Scene-start Director group: when `seed.space` is set, `run.mech("director:space", {type:
  "space.define", ...})` before the party loop; each party `combatant.add` gains
  `placement: { zoneId: seed.space.start }`.
- `arriveOne` (spec 088 monster arrival) and the encounter-start monster loop: add `placement`
  from the encounter's `zone`.
- Encounter start, after the monster loop and before `seedPresence`: `combatant.place` to the
  encounter zone for each party combatant placed elsewhere, key
  `director:gather:<encounterId>:<combatantId>` (FR-023a, spec OQ-13).
- `pullIn`: `placement` per FR-023.
- Every reason string written here names only the zone the row names (contracts/zone-revealed.md §6).

**`src/dm/snapshot/types.ts`**: `SnapshotActor.zone: string | null`, `reach: string[]`;
`SnapshotStage.zones: { id; name; kind; revealed }[] | null`.

**`src/dm/snapshot/build.ts`**: fill them from `projections.spatial` (DM projection) with
`reachOf`. `revealed` is membership in `spatial.map`.

**`src/dm/snapshot/render.ts`**: `dm` view renders a `Zones:` stage line (fogged zones suffixed
`(hidden)`) and `zone <id>; reach <ids|none>` per placed actor. `seat` renders only revealed
zones and omits a fogged actor's zone. `fiction` renders `Places:` with zone names and
`in <zone name>` per placed actor in a revealed zone, nothing for fogged ones. Token caps are
unchanged; overflow behaviour is unchanged.

`snapshot/diff.ts` is unchanged: zones are not a diffed field.

### Seed layouts

`greyhollow-ford`, `-duo`, `-trio` share one layout (their non-character content is identical):

| Zone | Kind | Hidden | Edges |
|---|---|---|---|
| `near-bank` (start) | area | no | `ferry-house` door 10; `ferry` open 10; `causeway` open 30 |
| `ferry-house` | room | no | `ferry-house-door` open 5; `loft` climb 10 |
| `ferry-house-door` | feature | no | — |
| `loft` | room | yes | — |
| `ferry` | area | no | — |
| `causeway` | area | no | `reed-marsh` squeeze 60 |
| `reed-marsh` | area | yes | `reed-camp` squeeze 30 |
| `reed-camp` | area | yes | `camp-post` open 5 |
| `camp-post` | feature | yes | — |

NPC zones: `wenna` `loft`, `pell` `reed-camp`, `snag` none (an encounter monster).
Encounter `reed-camp` zone `reed-camp`.

`greyhollow-ford-reed-camp`: `causeway` (start), `reed-marsh` (not hidden), `reed-camp` (hidden),
`camp-post` (hidden feature), edges as above. NPC zones: `wenna` `causeway`, `pell` `reed-camp`.
Encounter zone `reed-camp`.

Zone names are plain English ("Near bank", "Ferry-house door", "Camp post").

## Files touched

| File | Change |
|---|---|
| `packages/session-model/package.json`, `tsconfig.json` | `@the-stacks/space` dependency and reference |
| `packages/session-model/src/events/space.ts` | new: `ZoneRevealedV1` |
| `packages/session-model/src/catalog.ts` | `zone.revealed` entry and payload type |
| `packages/session-model/src/projections/spatial.ts` | new: fold helpers, `spatialFor`, `reachOf`, `targetStatus` |
| `packages/session-model/src/projections/{apply,types,ledger}.ts` | `spatial` field, fold cases, ledger row |
| `packages/session-model/src/gate/fog.ts` | new: `fogRows`, `revealRows` |
| `packages/session-model/src/gate/plan.ts` | `planProposal` applies `fogRows` |
| `packages/session-model/src/index.ts` | exports |
| `packages/session-model/src/fixtures/{spatial-fog,index}.ts` | new fixture |
| `packages/session-model/test/catalog.test.ts` | counts 19 → 20, 42 → 43 |
| `packages/session-model/test/{exports,fixtures}.test.ts` | new names, fixture list |
| `packages/session-model/test/spatial-fold.test.ts` | new (phase 1) |
| `packages/session-model/test/spatial-targets.test.ts` | new (phase 1): `targetStatus`, `reachOf` |
| `packages/session-model/test/gate-fog.test.ts` | new (phase 2): every fog rule branch, `revealRows`, timing |
| `packages/session-model/test/fog-secrecy.test.ts` | new (phase 2): SC-001 |
| `packages/session-model/test/spatial-parity.test.ts` | new (phase 2): SC-002 |
| `specs/028-session-model/contracts/{session-events,projections}.md` | amendment note pointing at spec 100 contracts |
| `specs/029-proposal-gate/contracts/gate-api.md` | amendment note (only with the OQ-1 ruling) |
| `apps/server/package.json`, `tsconfig.json` | `@the-stacks/space` dependency and reference |
| `apps/server/src/dm/seed/{schema,load}.ts` | seed `space`, zones, cross-checks |
| `apps/server/seeds/*.json` (4) | layouts above |
| `apps/server/src/dm/nodes/resolve.ts` | space define, placements, gathering |
| `apps/server/src/dm/snapshot/{types,build,render}.ts` | zone, reach, zones line |
| `apps/server/test/dm/seed.test.ts` | layouts parse; cross-check refusals |
| `apps/server/test/dm/scene-start-space.test.ts` | new: scene start and encounter start rows (scripted DM) |
| `apps/server/test/dm/snapshot-space.test.ts` | new: three views |
| `apps/server/test/dm/snapshot-fixtures.ts`, other tests building `SessionProjections` or `SnapshotActor` literals | add the new fields where typecheck demands |
| `pnpm-lock.yaml` | workspace links |
| `docs/wiki/*` | wiki phase (tasks.md Phase 5) |

Not touched: `apps/server/src/ws/**`, `apps/server/src/session/events.ts`,
`apps/server/src/gate/gate.ts`, `apps/server/src/dm/facts.ts` (spec OQ-12), `apps/web/**`
(TASK-0277), the engine, `Dockerfile` (it already copies `packages/space`), `biome.json` (the
session-model rule bans server and web imports only).

**Runbook overlap**: the runbook lists `dm/nodes/assemble.ts` and `dm/facts.ts` for 0271; this
plan touches neither. It adds `dm/nodes/resolve.ts` and `dm/snapshot/` (spec OQ-10).

## Test strategy

- **Hidden information (SC-001)**: for the `spatialFog` fixture and each US1/US2 scenario, take
  every row a player's `canSee` passes, `JSON.stringify` it, and assert no fogged zone id or name
  occurs. Do the same for `JSON.stringify(project(log, player))`.
- **Parity (SC-002)**: for every prefix of each scripted log, `project(prefix, player).spatial`
  deep-equals `spatialFor(project(prefix, dm), player)`; the DM's placements equal
  `spaceViewOf(engine).placements`.
- **Fog rule**: one test per §3 rule and per FR-009 row type; batch envelopes unchanged;
  `dm` proposals never loosened; the non-DM projection guard.
- **Server**: scene start with the scripted DM (`DM_FAKE_SCRIPT`) on `greyhollow-ford` asserts
  the row order of FR-022 and that no player-visible row names `loft` or `reed-camp`. Encounter
  start asserts the reveal precedes the first public goblin row and the party is gathered.
- **Snapshot**: three views against fixture projections, including the no-space case (byte
  equal to today's output for an existing fixture).
- Existing DB integration suites run with `REQUIRE_DATABASE=1`. Scripted-DM tests that count
  rows at scene start may shift by the new rows; update counts, never weaken assertions.

## Constitution Check

Against `.specify/memory/constitution.md` 3.0.0.

- [x] **I. Agent-operable**: the AI DM and a human DM drive spaces and moves through the same
      `mechanics` proposals; the fog rule is seat-blind. Explicit reveal arrives as the `reveal`
      Intent via TASK-0268 (OQ-4).
- [x] **II. One Intent vocabulary**: no client write path; `zone.revealed` is gate-written; no
      surface calls the engine.
- [x] **III. Event sourcing**: hidden zones and placements live only in `dm` rows; the server
      filters with `canSee`; `zone.revealed` is versioned; projections tolerate it as a known type
      and older readers skip it as unknown.
- [x] **IV. Data planes**: all new state is session-plane log state.
- [x] **V. Many views, one state**: `spatial` is a projection; each reveal and move is a ledger
      row in the stream; geometry stays in `space`.
- [x] **VI. Engine owns the numbers**: positions remain engine state; reveal occupants copy
      engine placements; no model writes a position.
- [x] **IX. UX quality bar**: `fogRows` is sub-millisecond (SC-005). No UI in this card.
- [x] **XI. Operator-owned content**: seed zones are original text.
- [x] **XII. Self-hostable**: no new container, dependency or service.
- [x] **XIII. Just-in-time**: R1 card; every deferral is an open question for the orchestrator
      to card (OQ-3, OQ-4, OQ-5, OQ-7, OQ-9, OQ-12, OQ-13). The gate contract amendment waits on
      the OQ-1 ruling.
- VII, VIII, X: not applicable (no prose slot, codex content or library claim).

**Stack conformance**: Zod is the single schema source; `space` is a declared package seam.

## Complexity Tracking

None.
