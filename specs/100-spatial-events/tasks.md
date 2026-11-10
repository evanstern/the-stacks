---
description: "Tasks for spec 100: zone fog, zone.revealed and the per-viewer spatial projection (TASK-0271)"
---

# Tasks: Zone fog, `zone.revealed` and the per-viewer spatial projection

**Input**: `specs/100-spatial-events/` (spec.md, plan.md, contracts/)

**Tests**: required. The runbook's "Projection PRs" gate requires the parity and
hidden-information tests.

**Dispatch**: one phase is one sonnet implementer dispatch. Run phases in order. Each phase ends
with `pnpm ci:check` green and one commit led by `TASK-0271`. Phase 2 starts only with the
operator's OQ-1 ruling quoted in its brief.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency).
- **[Story]**: US1–US4 from spec.md.

## Phase 1: Event and projection (US1, US4; AC #2, #5)

**Goal**: `zone.revealed` is in the catalog, and `project()` folds a per-viewer `SpatialView`.

- [x] T001 [US1] Add `@the-stacks/space` to `packages/session-model/package.json` dependencies and `tsconfig.json` references; run `pnpm install`.
- [x] T002 [US1] Write `packages/session-model/src/events/space.ts`: `ZoneRevealedV1` with the five refinements of contracts/zone-revealed.md §2.
- [x] T003 [US1] Add `zone.revealed` to `src/catalog.ts` (`sessionEntries`, `SessionPayloads`); update `test/catalog.test.ts` counts (19 → 20, 42 → 43).
- [x] T004 [US1] Write `src/projections/spatial.ts`: `EMPTY_SPATIAL`, `foldReveal`, `foldPlacement`, `spatialFor`, `reachOf`, `targetStatus` (contracts/spatial-projection.md §1–§3).
- [x] T005 [US1] Add `SpatialView` and `spatial` to `src/projections/types.ts`; wire `emptyProjections`, the `zone.revealed` case and the `applyMechanics` placement fold in `src/projections/apply.ts`; add the ledger row in `src/projections/ledger.ts`.
- [x] T006 [US1] Export the Phase 1 names from `src/index.ts`; extend `test/exports.test.ts`.
- [x] T007 [P] [US1] Write `test/spatial-fold.test.ts`: every row of the contract §2 fold table for both viewers; DM placements equal `spaceViewOf(engine).placements`; unknown-type tolerance unchanged.
- [x] T008 [P] [US4] Write `test/spatial-targets.test.ts`: `targetStatus` for every row of contract §3 (feature zone `unseen` then `ok`; area as entity `unknown`; DM never `unseen`); `reachOf`.
- [x] T009 [US1] Add the `spatial` field to every `SessionProjections` literal that typecheck flags in existing tests.

**Checkpoint**: `pnpm --filter @the-stacks/session-model test` and `pnpm ci:check` green.

---

## Phase 2: The fog rule in the gate (US1, US2; AC #1, #2, #3)

**Goal**: every plan passes through `fogRows`; players never receive a fogged zone.

- [x] T010 [US1] Write `packages/session-model/src/gate/fog.ts`: `fogRows` and `revealRows` per contracts/zone-revealed.md §3, §4, §6 (reset reason fixed text).
- [x] T011 [US1] Apply `fogRows` inside `planProposal` in `src/gate/plan.ts` (`validate(fog(plan(...)))`); export `fogRows`, `revealRows`.
- [x] T012 [US2] Write `src/fixtures/spatial-fog.ts` (rows produced by `planProposal` over public proposals plus one `dm` mechanics proposal) and register it in `src/fixtures/index.ts`; update `test/fixtures.test.ts` (nine → ten).
- [x] T013 [P] [US2] Write `test/gate-fog.test.ts`: each §3 rule; each FR-009 row type; crossing both ways; arrival; occupants on a later reveal; `dm` proposals never loosened; non-DM guard; envelopes' `index`/`count` unchanged; `revealRows` refusals and no-op; 64-zone timing < 1 ms.
- [x] T014 [P] [US1] Write `test/fog-secrecy.test.ts`: SC-001 over the fixture and each US1/US2 scenario (stringified visible rows and the stringified player projection hold no fogged id or name).
- [x] T015 [P] [US1] Write `test/spatial-parity.test.ts`: SC-002 over every prefix of each scripted public log.
- [x] T016 [US1] Add amendment notes to `specs/028-session-model/contracts/session-events.md` and `projections.md`, and (per the OQ-1 ruling) `specs/029-proposal-gate/contracts/gate-api.md`, each pointing at spec 100's contracts.

**Checkpoint**: session-model and server gate suites green (`REQUIRE_DATABASE=1` for `gate.integration`); `pnpm ci:check` green.

---

## Phase 3: Seeds and the DM runtime (US4; AC #5)

**Goal**: shipped seeds declare zones; scene and encounter start define, place and gather.

- [x] T017 [US4] Add `@the-stacks/space` to `apps/server/package.json` and `tsconfig.json`; run `pnpm install`.
- [x] T018 [US4] Extend `apps/server/src/dm/seed/schema.ts` (`space`, `npcs[].zone`, `encounters[].zone`) and `crossCheckSeed` in `src/dm/seed/load.ts` (FR-020, FR-021).
- [x] T019 [US4] Add the plan "Seed layouts" to the four `apps/server/seeds/*.json`.
- [x] T020 [US4] Edit `apps/server/src/dm/nodes/resolve.ts`: `space.define` before the party loop; party `placement`; monster and pull-in `placement`; encounter-start gathering (FR-022, FR-023, FR-023a). Reasons name only the zone their row names.
- [x] T021 [P] [US4] Extend `apps/server/test/dm/seed.test.ts`: every shipped seed parses with its space; each FR-021 refusal.
- [x] T022 [US4] Write `apps/server/test/dm/scene-start-space.test.ts` (scripted DM, `REQUIRE_DATABASE=1`): FR-022 row order; no player-visible row names `loft`, `reed-marsh`, `reed-camp` or `camp-post` before their reveal; encounter start reveals `reed-camp` before the first public goblin row; the party is gathered; no feature zone id is a combatant or in initiative.
- [x] T023 [US4] Update row counts in existing scene-start and playtest tests that shift by the new rows. Never weaken an assertion.

**Checkpoint**: server suite green with `REQUIRE_DATABASE=1`; `pnpm ci:check` green.

---

## Phase 4: Zones and reach in the AI context (US3; AC #4)

**Goal**: the snapshot carries zone and reach per actor and a zones line per view.

- [ ] T024 [US3] Add `zone`, `reach` and `stage.zones` to `apps/server/src/dm/snapshot/types.ts`; fill them in `build.ts` from `projections.spatial` and `reachOf`.
- [ ] T025 [US3] Render them in `apps/server/src/dm/snapshot/render.ts` per plan "Server" (dm, seat, fiction).
- [ ] T026 [US3] Write `apps/server/test/dm/snapshot-space.test.ts`: US3 #1–#3; the no-space output byte-equal to today's for an existing fixture.
- [ ] T027 [US3] Add the new fields to `apps/server/test/dm/snapshot-fixtures.ts` and other `SnapshotActor` literals where typecheck demands.

**Checkpoint**: server suite green; `pnpm ci:check` green.

---

## Phase 5: Wiki

**Goal**: the corpus describes fog, `zone.revealed` and the spatial projection, re-pinned honestly.

- [ ] T028 Update `docs/wiki/session-model.md` (catalog row, `spatial` fold, `fogRows` in `planProposal`, new exports) and re-pin.
- [ ] T029 Update `docs/wiki/space.md` (fog, feature zones as entity targets, `spatialFor`/`reachOf`) and add `packages/session-model/src/projections/spatial.ts` to its sources; re-pin.
- [ ] T030 Review and re-pin the runbook's list: `actor-snapshot.md` (zone, reach, zones line), `seed-npc-presence.md` (seed zones), `dm-runtime.md` (space define, gathering). Review and re-pin every other note whose sources this branch touched: `proposal-gate.md`, `presence.md`, `turn-floor.md`, `dm-failure-and-gates.md`, `dm-narration-quality.md`, `dm-turn-jobs.md`, `party-panel.md`, `playtest-harness.md`, `subscriber-registry.md` (one sentence: spatial secrecy is row visibility).
- [ ] T031 Regenerate `docs/wiki/CAPSULES.md` for changed descriptions; update `docs/wiki/INDEX.md` routing for "fog", "zone.revealed", "spatial projection".
- [ ] T032 Run the freshness gate (`OK`) and the spec-bridge check (exit 0).

**Checkpoint**: both gates green; every task above ticked.
