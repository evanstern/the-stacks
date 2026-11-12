---
description: "Tasks for spec 106: CI latency gate on fixture tables (TASK-0300)"
---

# Tasks: CI latency gate on fixture tables

**Input**: `specs/106-latency-gate/` (spec.md, plan.md)

**Tests**: the deliverable is a test. Constitution IX and the Latency gate bind it.

**Dispatch**: one phase is one sonnet implementer dispatch. Run phases in order. Each phase ends
with `pnpm ci:check` green under `REQUIRE_DATABASE=1` on the worktree stack, and one commit led by
`TASK-0300`.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: The latency gate (AC #1, AC #2, AC #3)

**Goal**: `pnpm check:timing` times confirmed `attack` and `check` Intents on fixture tables and
fails at p95 ≥ 1000 ms.

- [x] T001 In `apps/server/vitest.timing.config.ts`, set `fileParallelism: false` (FR-011).
- [x] T002 Write `apps/server/test/intent-latency.bench-test.ts`: `loudSkip`, `BUDGET_MS` with the constitution IX quote, `WARMUP = 20`, `SAMPLES = 200`, the `timeOne` helper from plan "Design", and the dice script from spec "Fixture tables" (FR-001, FR-003, FR-005, FR-007, FR-010).
- [x] T003 In the same file, add the `attack` case (AI-seat turn world) and the `check` case (human-seat turn world; untimed player `check`, timed `ruling`). Assert each timed batch holds `attack.resolved` or `check.resolved`. Assert zero model calls per world (FR-004, FR-009). Confirm spec OQ-5 and note the result on the card.
- [x] T004 Compute p50, p95 and max with `percentile()` from `src/bench/load/stats.ts`. Print the pass and fail output from spec "Output". Fail when p95 ≥ `BUDGET_MS` (FR-006, FR-008).
- [x] T005 Verify: `pnpm check:timing` prints both lines and `PASS`; setting `BUDGET_MS` to `0.001` exits nonzero with the fail output (revert it); `node scripts/check-no-wallclock-tests.mjs` is green; `pnpm ci:check` is green. Paste the two `latency` lines into the card notes.

## Phase 2: Wiki re-ground

- [x] T006 Review and re-pin `test-suite` (NEEDS-REVIEW): add the latency gate to the timing-budget section, with its file, clock seam, sample design and budget. Re-pin every other note whose sources list a file this PR touched, through the wiki-update plan loop.
- [x] T007 Update `docs/wiki/INDEX.md` (state line: TASK-0300 CI latency gate) and `docs/wiki/CAPSULES.md` (test-suite capsule). Run the freshness gate (`OK`) and the spec-bridge check (exit 0).

## Dependencies & Execution Order

Phase 1 → Phase 2. Phase 1 tasks touch one new file and one config; run them in order in one
dispatch.
