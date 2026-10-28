# Research: DB integration tests survive full-suite load

No NEEDS CLARIFICATION items reached planning. These notes record what the code showed.

## R1. Where the load comes from

- **Decision**: treat the load as cross-package and cross-lane CPU contention.
- **Rationale**: `apps/server/vitest.config.ts` sets `fileParallelism: false`, so server files
  run one at a time. Root `pnpm test` is `turbo run test` (`package.json`, `turbo.json`), which
  runs `@the-stacks/server`, `web`, `dnd5e-engine`, `session-model` and `srd` tests at once.
  Sweep lanes run stacks and suites on the same host.
- **Alternatives considered**: per-file contention inside the server. Ruled out by
  `fileParallelism: false`.

## R2. Why these tests sit near 5 s

- **Decision**: the budget is too small for the work, not a fresh code defect.
- **Rationale**: each test plays a whole scripted scene through `enqueueTurn`, the gate and the
  DM worker. `drainAll` (`apps/server/test/dm/worker-world.ts`) waits 50 ms per idle tick. The
  harness and provider tests run `runPlaytest` over the shipped Greyhollow scenario. Alone,
  about 3 s. One real defect (a per-turn full-log replay in `gate.recordPresence`) was fixed in
  2b09a07; D2's 120 s ceiling sends any further outlier back as a finding.
- **Alternatives considered**: profiling the DM pipeline. Out of scope for a low-priority card
  whose AC #1 names timeouts as a sufficient fix.

## R3. Existing timeout convention

- **Decision**: inline numeric third argument to `it(...)`.
- **Rationale**: used by `gate.integration.test.ts` (30 000, 60 000),
  `bench/load-db.integration.test.ts` (30 000), `bench/load.integration.test.ts` (30 000),
  `library/uploads.integration.test.ts` (120 000), `bench/retrieval.integration.test.ts`
  (120 000), `db.test.ts` and `health.test.ts` (10 000), `library/ddb.perf.test.ts` (15 000).
  These pass green on vitest 5.0.1.
- **Alternatives considered**: `describe(name, { timeout }, fn)` options. Equivalent, but no
  call site in the repo uses it.

## R4. Measuring durations

- **Decision**: vitest's default reporter output, filtered to turbo's `@the-stacks/server:test:`
  prefix. Fallback: `--reporter=verbose` through `pnpm turbo run test --filter='!@the-stacks/shared' --`.
- **Rationale**: the default reporter lists tests over the 300 ms slow threshold with their
  durations, so the plain full run is both the load condition and the measurement.
  `@the-stacks/shared`'s `test` script (`echo "no tests yet" && exit 0`) breaks on extra args.
