# Tasks: Intent contract package

**Input**: `specs/092-intent-contract/` (spec.md, plan.md, contracts/intent-schema.md).

**Prerequisites**: CP-4 ruled. The operator froze `contracts/intent-schema.md` and answered Q1–Q9.
Apply any ruling to the contract before Phase 1.

**Dispatch**: each implementer phase is one sonnet implementer dispatch. Phases run in order.
Tasks marked **[orchestrator]** are run by the orchestrator. Each implementer phase ends with
`pnpm ci:check` green and one commit led by `TASK-0266:`. No DB and no model run is needed.

**Before Phase 1**: merge `origin/main` into the branch. Run `pnpm install --frozen-lockfile`.

## Phase 1: Package skeleton, scalars, refs and boundary lint (FR-001–FR-004, FR-008, FR-017)

**Goal**: an empty but wired `@the-stacks/intent` that builds, lints and is guarded.

**Independent test**: `pnpm --filter @the-stacks/intent test` runs; `node scripts/check-boundaries.mjs`
flags the three new fixtures.

- [x] T001 Create `packages/intent/` with `package.json`, `tsconfig.json`, `vitest.config.ts` and
      `README.md`, following `packages/session-model`. Add the root `tsconfig` reference if the repo uses one.
- [x] T002 Create `src/version.ts`, `src/scalars.ts` and `src/refs.ts` per contract §1–§5.
- [x] T003 Create `test/engine-drift.test.ts` (plan "Test strategy").
- [x] T004 Add the `biome.json` override and three boundary fixtures (plan "Boundary lint").

## Phase 2: Kinds, KIND_RULES, refusals and fixtures (FR-005–FR-010)

**Goal**: all 57 kinds validate.

**Independent test**: `schema.test.ts` passes; the kind count test reads 57.

- [x] T005 Create `src/refusals.ts` per contract §9.
- [x] T006 Create `src/kinds.ts`: params schemas, `KIND_RULES`, `INTENT_GROUPS`, `IntentSchema`,
      the nested `Readyable`, `Predeclarable` and `IntentBody` rules, and the `MODEL_NUMBER` refinement.
- [x] T007 Create `src/fixtures/index.ts` with `VALID` (every kind) and `INVALID` (schema codes).
- [x] T008 Create `test/schema.test.ts`, including the count and coverage tests.

## Phase 3: Text form (FR-011–FR-015)

**Goal**: `parse` and `toText` for every kind, canonical form and aliases.

**Independent test**: `round-trip.test.ts` and `parse.test.ts` pass.

- [x] T009 Create `src/text/tokens.ts` (contract §8.1).
- [x] T010 Create `src/text/to-text.ts` and `src/text/parse.ts` (contract §8.2, §8.3).
- [x] T011 Add parse refusal inputs to `INVALID`. Create `test/round-trip.test.ts` and `test/parse.test.ts`,
      covering every edge case in spec "Edge Cases".

## Phase 4: Property, totality and latency tests (SC-002–SC-004)

**Goal**: generated Intents round-trip; `parse` never throws; parse is fast.

**Independent test**: `property.test.ts` passes on three consecutive runs with logged seeds.

- [x] T012 Create `test/property.test.ts` with the seeded generator, totality and latency tests (plan).
- [x] T013 Fix any defect the property test finds in Phase 3 code. Add each failing case as a fixture.

## Phase 5: Freeze and close [orchestrator]

- [ ] T014 [orchestrator] Create the CP-4 decision with `backlog decision create`. It pins
      `contracts/intent-schema.md` at its commit and states `INTENT_SCHEMA_VERSION = 1` (FR-018, AC #3).
- [ ] T015 [orchestrator] Card the spec 066 and spec 091 amendments under TASK-0199 and TASK-0247
      (plan "Downstream amendments").
- [ ] T016 [orchestrator] Run `/grounding-wiki:wiki-update` if a note lists touched sources
      (`biome.json`). Add a wiki note for the package.
- [ ] T017 [orchestrator] Tick TASK-0266 AC #1–#4. Record the `Dispatch:` line per phase.
