---
description: "Tasks for spec 094: space package and zones in the engine (TASK-0270)"
---

# Tasks: Space package and zones in the engine

**Input**: `specs/094-space-and-zones/` (spec.md, plan.md)

**Tests**: required. Constitution VI requires scripted-dice tests for every engine command.

**Dispatch**: one phase is one sonnet implementer dispatch. Run phases in order. Each phase ends
with `pnpm ci:check` green and one commit led by `TASK-0270`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency).
- **[Story]**: US1–US4 from spec.md.

## Phase 1: The space package (US4, AC #4)

**Goal**: `@the-stacks/space` exists, is pure, and is boundary-checked.

- [x] T001 [US4] Create `packages/space/{package.json,tsconfig.json,vitest.config.ts,README.md}` per plan "packages/space layout". Runtime dependency `zod` only.
- [x] T002 [US4] Add `packages/space` and `packages/space/test` to root `tsconfig.json` references; run `pnpm install` to update `pnpm-lock.yaml`.
- [x] T003 [US4] Write `packages/space/src/schema.ts`: `ZoneIdSchema`, `ZoneSchema`, `EdgeSchema`, `SpaceSchema` (refinements and caps, FR-001–FR-004), `PlacementSchema`, `BandSchema`.
- [x] T004 [US2] Write `packages/space/src/graph.ts`: `path()` (Dijkstra, FR-005, lexicographic tie-break), `band()` (BFS, FR-006), `BAND_FEET` (FR-007).
- [x] T005 [US2] Write `packages/space/src/rules.ts`: `reachCovers()` (FR-008), `rangeOf()` (FR-009).
- [x] T006 [US4] Write `packages/space/src/view.ts` (`SpaceView`, `zoneOf`, `occupants`, `bandBetween`; FR-010) and `src/index.ts` (the spec's exports only).
- [x] T007 [P] [US4] Write `packages/space/test/schema.test.ts` and `test/view.test.ts`.
- [x] T008 [P] [US2] Write `packages/space/test/graph.test.ts`: costs, blocked edges, ties, bands, the seeded symmetry and brute-force minimality checks, and the 64-zone < 1 ms timing test (SC-005).
- [x] T009 [P] [US4] Write `packages/space/test/purity.test.ts`: sources import only `zod` or relative paths; `package.json` dependencies equal `["zod"]`.
- [x] T010 [US4] Add the `biome.json` override for `packages/space/src/**` per plan "Root and tooling".
- [x] T011 [US4] Add fixtures `fixtures/boundary-violations/packages/space/src/{bad-react,bad-pixi,bad-engine,bad-clock}.ts`; confirm `node scripts/check-boundaries.mjs` flags all four.
- [x] T012 [US4] Write the README band and edge-cost conventions (OQ-7, OQ-8), citing SRD 5.2.1 rule ids.

**Checkpoint**: `pnpm --filter @the-stacks/space test` and `pnpm ci:check` green.

---

## Phase 2: Engine placement, space and move (US1, AC #1)

**Goal**: the engine holds a space and placements, and `move` refuses blocked and over-speed moves.

- [x] T013 [US1] Add `@the-stacks/space` to `packages/dnd5e-engine/package.json` dependencies and `tsconfig.json` references; allow the specifier in `test/purity.test.ts`; run `pnpm install`.
- [x] T014 [US1] Extend `src/schema/state.ts`: `Combatant.placement`, `Combatant.speed`, `Encounter.movement`, `EngineState.space` with its placement refinement (FR-012).
- [x] T015 [US1] Extend `src/schema/commands.ts` with `space.define`, `combatant.place`, `move`, `movement.action`, and `CombatantInit.placement`/`speed`.
- [x] T016 [US1] Extend `src/schema/events.ts` with `space.defined`, `combatant.placed`, `combatant.moved`; add the nine refusal codes to `src/schema/refusals.ts`.
- [x] T017 [US1] Add the three cases to `src/evolve.ts`.
- [x] T018 [US1] Write `src/commands/move.ts`: the four handlers, `effectiveSpeed`, `movementLeft` (FR-013, FR-014, FR-016–FR-019) in the check order of plan "Engine changes".
- [x] T019 [US1] Copy `placement` and `speed` in `src/commands/combatants.ts` `combatant.add` (FR-015).
- [x] T020 [US1] Write `src/space.ts` (`spaceViewOf`); register handlers in `src/execute.ts`; export new functions and re-export space types in `src/index.ts` (FR-024).
- [x] T021 [US1] Write `test/commands/move.test.ts`: every US1 scenario and every move-related edge case in spec.md, with `scriptedRng([])`; each new refusal code asserted by `expectRefusal`.
- [x] T022 [P] [US1] Extend `test/commands/combatants.test.ts` (placement on add, `ZONE_UNKNOWN`) and `test/replay.test.ts` (the three new events replay).
- [x] T023 [US1] Extend `packages/session-model/test/helpers.ts` `engineExamples()` to emit the three new event types; update counts in `test/catalog.test.ts` (mechanics 20 → 23, catalog 39 → 42).
- [x] T024 [US1] Add README bullets for the four commands in `packages/dnd5e-engine/README.md`.

**Checkpoint**: engine coverage meta-test green; session-model tests green; `pnpm ci:check` green.

---

## Phase 3: Reach and range by band, and SRD mapping (US2, AC #2)

**Goal**: placed attacks check reach and range by band; seeds carry the numbers.

- [x] T025 [US2] Extend `AttackEntrySchema` in `src/schema/state.ts` with `reachFt` and `rangeFt` (FR-022).
- [x] T026 [US2] In `src/commands/attacks.ts`, add the band checks before any draw (FR-020, FR-021, FR-021a); a long-range use adds a disadvantage mode source.
- [x] T027 [US2] Extend `test/commands/attacks.test.ts`: each US2 scenario, `melee-or-ranged` both ways, explicit-expression skip, unplaced skip, `STAT_UNDEFINED` without `rangeFt`, refusals before draw (`expectRefusedBeforeDraw`).
- [x] T028 [US2] In `apps/server/src/dm/seed/combatants.ts`, map `speed`, `reachFt` and `rangeFt` (FR-025, plan "Server seed mapping").
- [x] T029 [US2] Add `speed` to each seed PC's `combatant` in `apps/server/seeds/*.json` (4 files).
- [x] T030 [US2] Extend `apps/server/test/dm/seed-stats.test.ts`: goblin speed 30, scimitar reach 5, shortbow 80/320; a PC weapon's range from SRD.

**Checkpoint**: `pnpm ci:check` green; DB suites untouched (no DB change).

---

## Phase 4: Opportunity attacks from leaving an engaged band (US3, AC #3)

**Goal**: the engine names who may take an opportunity attack; golden-dice tests prove the flow.

- [ ] T031 [US3] Add `provokers()` to `src/commands/move.ts` per FR-023, with the OQ-2 `ponytail:` comment; export it from `src/index.ts`.
- [ ] T032 [US3] Write `test/commands/opportunity.test.ts`: every US3 scenario as a golden event list with scripted faces (hit, miss, drop to 0 then `ACTOR_UNABLE` move, disengage, spent Reaction, incapacitated, no melee entry, other zone).

**Checkpoint**: `pnpm ci:check` green; every spec task in Phases 1–4 ticked.

---

## Phase 5: Wiki re-ground

**Goal**: the corpus describes the merged code and passes the freshness gate.

- [ ] T033 Merge `origin/main` into the branch first, so the wiki edits land on TASK-0231's split engine notes.
- [ ] T034 Write a new note `docs/wiki/space.md`: the package, schemas, bands, paths, rules, `SpaceView`, the boundary. Sources: `packages/space/**` files used.
- [ ] T035 Review `docs/wiki/dnd5e-engine.md` and its split notes (`dnd5e-engine-reactions.md`, `dnd5e-engine-derived-rolls.md`): placement, speed, the four commands, band checks, `provokers`, new refusal codes. Add `src/commands/move.ts` and `src/space.ts` to sources.
- [ ] T036 [P] Review `docs/wiki/monorepo-and-toolchain.md` (new package, references, boundary override), `docs/wiki/srd-data.md` (speed, reach, range mapping) and `docs/wiki/overview.md` (one sentence for TASK-0270).
- [ ] T037 Update `docs/wiki/INDEX.md` and `docs/wiki/CAPSULES.md` for the new `space` note and the changed engine notes.
- [ ] T038 Re-pin every touched note's `verified_against` honestly; run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/1.0.1/gates/cli.mjs freshness . docs/wiki` until it prints `OK`.
- [ ] T039 Run `node ~/.claude/plugins/cache/praxisflux/spec-bridge/1.0.1/gates/cli.mjs check .` and confirm exit 0.

**Checkpoint**: freshness `OK`; spec-bridge exit 0; `pnpm ci:check` green.

---

### Constitution Compliance (the-stacks)

Carried by the phases above:

- Scripted-dice tests cover every new or changed engine command (VI): T021, T022, T027, T032.
- Cross-plane boundary check updated for the new package (IV, V): T010, T011.
- Event types versioned (`v: 1`) with visibility left to TASK-0271 (III): T016, spec OQ-10.
- Projection tolerates the new event types (III): T023 (catalog derives them; ledger default row).
- Shipped SRD data keeps its attribution (XI): no SRD data changes; T028 reads existing records.

## Dependencies & Execution Order

- Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5. Each phase builds on the previous phase's files.
- Phase 3 and Phase 4 touch different engine files (`attacks.ts` vs `move.ts`), but both edit
  `src/index.ts` and `state.ts`. Run them in order, one dispatch each.
- Within a phase, `[P]` tasks touch different files.

## Implementation Strategy

Phase 1 alone satisfies AC #4. Phase 2 satisfies AC #1. Phase 3 satisfies AC #2. Phase 4
satisfies AC #3. Phase 5 makes the task done. One PR carries all five phases.
