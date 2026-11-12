# Feature Specification: CI latency gate on fixture tables

**Feature**: `106-latency-gate` | **Task**: TASK-0300 | **Date**: 2026-11-12
**Epic**: TASK-0258 (EP-1, R1 Fast Table) | **Runbook**: `docs/design/r1-fast-table-runbook.md` (F5, gap G3, lane LZ)
**Authored against**: `origin/main` `fa6b3c11`

## Summary

Add a per-commit wall-clock gate. It plays confirmed Intents through the real gate on a fixture
table and measures the time from `gate.handle` entry to the stored fact rows. `pnpm ci:check` fails
when the p95 for any measured Intent kind reaches the constitution budget. The gate uses the
scripted fake provider and needs no provider key.

## The budget (constitution 3.0.0)

- Principle IX: "A mechanic resolved in code MUST show its fact rows in under 1 s p95 from a
  confirmed Intent."
- Quality Gates, Latency gate: "CI MUST record time from confirmed Intent to fact rows on fixture
  tables."
- R1 exit criterion 1: "p95 confirmed Intent → fact rows < 1 s, hosted". TASK-0278 owns the hosted
  half. This spec owns the CI half only.

**Budget**: `BUDGET_MS = 1000`. The gate passes only when p95 < 1000 ms for every measured kind.
The constant names its source (constitution IX) in a comment. It is never raised to absorb noise.

## Scope

In: one `*.bench-test.ts` in `apps/server/test/`, run by `pnpm check:timing`, on a fresh session
over the CI Postgres. Out: hosted measurement (TASK-0278), narration latency (IX first token),
round wall time (IX 60 s), any new gate hook, any change to `gate.ts`.

## Clock seam (spec 102 OQ-13, ruled: no new hook)

- **Start**: `performance.now()` read immediately before `gate.handle(sessionId, proposer, request)`.
- **Stop**: `performance.now()` read inside a `gate.onAppended` listener, on the call whose
  `events` holds an `intent.recorded` row whose `payload.intent.id` is the sample's Intent id.
- The listener runs inside `run()` after the append commits and before `handle` resolves, so the
  stop point is "rows stored", not "promise resolved".
- A sample whose batch lacks the expected engine fact row (`attack.resolved` or `check.resolved`)
  fails the test. This guard stops the gate from timing a refusal or a no-op.
- A refused `handle` fails the test with its refusal code. A refusal is never a sample.

## Fixture tables

Two worlds from `apps/server/test/dm/world.ts` (`createWorld`, `startScene`), seed
`greyhollow-ford`, encounter `reed-camp` in turn mode, the same setup as
`gate.intent.integration.test.ts`'s `turnWorld()`.

- **Dice**: `[20, 1, 1, 1, 1, 1, 1]` (initiative, Tamsin first), then 2000 faces of `2`. A `2` is
  valid on every die. A d20 of 2 misses goblin AC and fails a medium check, so no target dies and
  every sample takes the same path. `scriptedRng` throws on exhaustion, so a mis-sized script fails
  loudly.
- **Fake provider**: `createWorld` scripts zero model calls. Any model call throws. The test asserts
  every `world.scripted.remaining().calls` count is 0 at the end (AC #3).
- No `DM_FAKE_SCRIPT` and no provider key are read. The gate does not need a `.env`.

## Measured Intent kinds

| Kind | World | Timed request | Expected fact row |
|------|-------|---------------|-------------------|
| `attack` | AI seat, turn mode | Tamsin (player) sends a confirmed `attack`, actor `pc:tamsin`, target `goblin-2`, `weapon: "Longsword"` | `attack.resolved` |
| `check` | human DM seat (`dm.seat` to `HUMAN_DM`), turn mode | The seated DM sends a confirmed `ruling` (`decision: "accept"`, `difficulty: "medium"`) that answers Tamsin's open `check` request | `check.resolved` |

- A player `check` with no DC settles as `needs_ruling` and resolves no mechanic. It is setup for
  the `check` sample, untimed. The timed request is the ruling that rolls the check. This is the
  first moment the check's fact rows exist.
- Each sample uses unique Intent ids (`atk-<n>`, `chk-<n>`, `dc-<n>`).

## Sample design

- **Warm-up**: 20 samples per kind, run first and discarded. They absorb JIT, the pg pool's first
  connections, and the first `loadProjections` of the session.
- **Measured**: 200 samples per kind, run serially (one `handle` in flight). Each kind uses its own
  world, so the two logs grow independently.
- **p95**: nearest rank over the sorted samples, via `percentile()` from
  `apps/server/src/bench/load/stats.ts`. For n = 200, p95 is the 190th value. Ten outliers per kind
  cannot fail the gate. An eleventh can.
- The log grows by about 5 rows per sample, to about 1,200 rows per session. `gate.handle` loads
  the whole projection per attempt, so the fixture also covers a mid-session log length.

## Output

- **Pass**: one line per kind, then `latency gate: PASS`:
  `latency attack n=200 warmup=20 p50=<ms> p95=<ms> max=<ms> budget=1000ms OK`.
- **Fail**: the same lines with `FAIL` on each breaching kind, then the 5 slowest sample ids and
  times for that kind, then the assertion failure `p95 <ms> >= budget 1000ms (constitution IX)`.
- Times print with one decimal.

## Acceptance criteria map

| AC | Text | Met by |
|----|------|--------|
| #1 | `pnpm ci:check` runs a fixture table and records confirmed-Intent-to-fact-rows time. | FR-001–FR-005, FR-008 |
| #2 | CI fails when the fixture p95 exceeds the budget in the constitution. | FR-006, FR-007 |
| #3 | The gate uses the fake model and needs no provider key. | FR-009 |

## Functional requirements

- **FR-001**: The gate MUST live in `apps/server/test/intent-latency.bench-test.ts`. It MUST NOT be
  a regular `*.test.ts` (`scripts/check-no-wallclock-tests.mjs`, TASK-0308).
- **FR-002**: `pnpm check:timing` MUST run it through the existing `@the-stacks/server`
  `test:timing` script. `ci:check` already runs `check:timing`. No change to root `package.json`.
- **FR-003**: The clock MUST start before `gate.handle` and stop in the `onAppended` listener on the
  batch carrying the sample's `intent.recorded` row. No new hook, no edit to `gate.ts`.
- **FR-004**: The gate MUST measure `attack` and `check` as in "Measured Intent kinds".
- **FR-005**: Each kind MUST run 20 discarded warm-up samples, then 200 measured samples, serially.
- **FR-006**: p95 MUST be the nearest-rank percentile from `bench/load/stats.ts`. The test MUST fail
  when any kind's p95 is ≥ 1000 ms.
- **FR-007**: The budget MUST be one constant, `BUDGET_MS = 1000`, with a comment quoting
  constitution IX. No retry, no re-run-until-green, no multiplier.
- **FR-008**: The gate MUST print the pass and fail output in "Output".
- **FR-009**: The gate MUST use `createWorld`'s scripted fake provider, MUST assert zero model calls,
  and MUST NOT read a provider key or `DM_FAKE_SCRIPT`.
- **FR-010**: Without a reachable database the file MUST call `loudSkip`, which throws under
  `REQUIRE_DATABASE=1`. CI sets `REQUIRE_DATABASE=1`, so the gate cannot skip silently in CI.
- **FR-011**: `apps/server/vitest.timing.config.ts` MUST set `fileParallelism: false`, so the ddb
  parse bench never runs beside the latency gate.

## Success criteria

- **SC-001**: `pnpm ci:check` on the branch prints both `latency` lines and `PASS`.
- **SC-002**: Setting `BUDGET_MS` to `0.001` locally makes `pnpm check:timing` exit nonzero with the
  fail output. Revert before commit.
- **SC-003**: `node scripts/check-no-wallclock-tests.mjs` stays green.

## Relation to TASK-0278

TASK-0278 adds the hosted metric (auditor, playtest logs). It measures a different interval on a
different stack. Shared code: only `percentile()` in `apps/server/src/bench/load/stats.ts`. This
spec reuses it. TASK-0278 should reuse it too. Neither card owns the other's measurement.

## Open questions

- **OQ-1 — Miss-only attacks.** All attack samples miss, so the damage roll path is never timed.
  **Recommend:** accept. The damage roll is one engine call. A dying goblin would add
  `TARGET_DEAD` refusals and break serial sampling. Add hit samples when the fixture can reset HP.
- **OQ-2 — Check via ruling, not a direct DC.** The `check` sample times the human-seat `ruling`
  that rolls the check. **Recommend:** accept. It is the only gate path today where a confirmed
  Intent produces `check.resolved` without a model call. Spec 102's integration test already proves
  it.
- **OQ-3 — Sample count.** 200 measured samples per kind. **Recommend:** keep. At an expected
  10–50 ms per sample the file adds under 30 s to `check:timing`. Raise to 500 only if the reported
  p95 jitters across CI runs by more than 2×.
- **OQ-4 — Gate on the pooled p95 too.** **Recommend:** no. Per-kind p95 is stricter. A pooled
  figure hides a slow kind behind a fast one.
- **OQ-5 — Same batch.** The spec assumes the ruling's `check.resolved` rows and its
  `intent.recorded` carrier land in one append batch. **Recommend:** the implementer confirms it in
  phase 1. If they land in separate batches, stop the clock on the later of the two and record the
  finding in the card notes.
