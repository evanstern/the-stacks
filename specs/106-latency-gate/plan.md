# Implementation Plan: CI latency gate on fixture tables

**Branch**: `task-0300-latency-gate` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)
**Tasks**: 7 (T001–T007) in 2 phases: 1 implementation phase, 1 wiki phase.

## Summary

Write one bench test in `apps/server/test/` that plays confirmed `attack` and `check` Intents
through the real gate on two fixture worlds. Time `gate.handle` entry to the `onAppended` call
carrying the sample's `intent.recorded` row. Compute nearest-rank p95 over 200 samples per kind
after 20 warm-up samples. Fail at p95 ≥ 1000 ms. Run it in `pnpm check:timing`, serially.

## Technical context

- TypeScript, Vitest, Postgres via `TEST_DATABASE_URL`. Existing pieces only.
- CI database: `.github/workflows/ci.yml` starts `docker-compose.test.yml`, runs
  `db:migrate`, and sets `TEST_DATABASE_URL` and `REQUIRE_DATABASE=1` for the whole job. `ci:check`
  runs `check:timing` inside that job, so the gate has its database with no workflow change.
- Local: run `pnpm env:up`, migrate, and set `TEST_DATABASE_URL` as `VAR="$(sed …)"`. Without it the
  file loud-skips.

## Constitution Check (3.0.0)

| Principle | Status |
|-----------|--------|
| I. Agent-operable | PASS. The gate prints a one-line verdict per kind and fails with the slowest samples. |
| II. One Intent vocabulary | PASS. Samples are contract Intents through the `intent` gate request. |
| III. Event-sourced play | PASS. Times real appends; reads the log; no writer outside the gate. |
| VI. Engine owns the numbers | PASS. Scripted dice; the engine rolls. |
| IX. UX quality bar | PASS. This is the CI half of the 1 s p95 budget. |
| Quality Gates, Latency gate | PASS. Satisfies "CI MUST record time from confirmed Intent to fact rows on fixture tables." |
| C5 new runtime deps | NONE. No new package, dev or runtime. |
| Frozen contracts (C-GATE) | NONE touched. `gate.ts` is not edited. |

## Touched files

| File | Change |
|------|--------|
| `apps/server/test/intent-latency.bench-test.ts` | New. The gate. |
| `apps/server/vitest.timing.config.ts` | Add `fileParallelism: false`. |
| `docs/wiki/test-suite.md` | Phase 2. Add the latency gate. |
| `docs/wiki/INDEX.md`, `docs/wiki/CAPSULES.md` | Phase 2. State line and capsule. |
| any other note whose sources list a touched file | Phase 2. Re-pin. |

Not touched: `gate.ts`, `world.ts`, root `package.json`, `ci.yml`, `check-no-wallclock-tests.mjs`.
No runbook hotspot is touched, so this lane has no serial point with other R1 lanes.

## Design

```ts
// constitution IX: "A mechanic resolved in code MUST show its fact rows in under 1 s p95 from a confirmed Intent."
const BUDGET_MS = 1000;
const WARMUP = 20;
const SAMPLES = 200;

async function timeOne(w: World, who: Proposer, req: unknown, id: string, fact: string): Promise<number> {
  let stop = -1;
  let hasFact = false;
  const off = w.gate.onAppended((_s, events) => {
    const hit = events.some((e) => e.type === "intent.recorded" &&
      (e.payload as { intent: { id: string } }).intent.id === id);
    if (hit) {
      stop = performance.now();
      hasFact = events.some((e) => e.type === fact);
    }
  });
  const start = performance.now();
  const res = await w.gate.handle(w.sessionId, who, req);
  off();
  // assert res.ok, stop >= 0, fact row present
  return stop - start;
}
```

- `gate.ts` catches listener throws, so the listener records `{ stop, hasFact }`. The assertion runs
  after `handle` resolves.
- `check` sample: send the player `check` (`chk-<n>`, `skill: "athletics"`) untimed; then time the
  seated DM's `ruling` (`dc-<n>`, `requestId: "chk-<n>"`, `decision: "accept"`,
  `difficulty: "medium"`).
- Sort samples ascending, call `percentile(sorted, 50)` and `percentile(sorted, 95)`.
- `it(..., 120_000)` timeout per kind.
- The proposer for the ruling is the `operator` / `HUMAN_DM` pattern used by
  `gate.intent.integration.test.ts`. Reuse its `turnWorld` and `humanSeat` setup inline. Do not
  export them from that test file.

## CI-runner noise without weakening the gate

- **Serial run.** `check:timing` runs one package at a time (`--workspace-concurrency=1`). FR-011
  makes the server's timing files serial too, so the CPU-heavy ddb bench never overlaps.
- **Warm-up.** 20 discarded samples per kind absorb JIT and pool start-up.
- **Order statistic, not mean or max.** Nearest-rank p95 over 200 tolerates 10 slow samples per
  kind, such as a GC pause or a noisy neighbour. The budget does not move.
- **Headroom is real, not padded.** Expected samples run in tens of milliseconds on a local
  Postgres. A p95 near 1 s is a real regression and should fail.
- **No retry.** The test never re-runs a sample or the whole gate. A flake is reported and carded,
  never absorbed.

## Output

Pass and fail output is fixed by spec "Output". Print with `console.log` so vitest shows it in the
`check:timing` log. Print on pass too, so every CI run records the numbers (AC #1 "records").

## Gates for the PR

Runbook "Per-PR gates": frozen-lockfile install, `pnpm ci:check` green with `REQUIRE_DATABASE=1` on
the worktree stack, wiki freshness `OK`, spec-bridge check exit 0, a `Dispatch:` line per dispatch,
every `tasks.md` task ticked.
