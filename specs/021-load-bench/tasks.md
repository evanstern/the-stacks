# Tasks: Load and stress benchmark

**Input**: `specs/021-load-bench/` (spec.md, plan.md, research.md, data-model.md, contracts/,
quickstart.md)

**Card**: TASK-0030. **Depends on**: TASK-0024 (jobs + worker, merged), TASK-0021 (hosted
`dev`, merged), TASK-0033 (DB-only test stack, merged). **Sibling**: TASK-0029
(`specs/019-retrieval-bench/`): results conventions reused; no code import (research R13).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency).
- Paths are repo-relative. Every local run uses the worktree's test stack (`pnpm env:up`,
  `TEST_DATABASE_URL` from `.env`). No task runs a command on vm-104.

## Phase 1: Setup

**Purpose**: package wiring and data directories.

- [x] T001 Add `"bench:load": "tsc -b && node --env-file-if-exists=../../.env dist/bench/load/cli.js"` to `apps/server/package.json` scripts. Add root `"bench:load": "pnpm --filter @the-stacks/server bench:load"` to `package.json`.
- [x] T002 [P] Create `apps/server/bench/load/results/.gitkeep`. Create `apps/server/bench/load/profiles/commit.json`, `demand.json`, and `dev.json` with the values in data-model.md "Committed profiles". Use `commit.json` ingest volumes `[3, 6]`, workers `[1]`, `docBytes` 8192, `historyRows` 100, and concurrency users `[1, 3]` × 2000 ms. Format them with `pnpm format`.

## Phase 2: Foundational (blocks every story)

**Purpose**: the pure modules and the load database every case needs.

- [x] T003 [P] Create `apps/server/src/bench/load/profile.ts`: `TierSchema`, `ProfileSchema` (data-model.md, including the ascending, dev ≤ 25 users, dev ≤ 180 s, and dev `wsSend: false` rules), `loadProfile(path)`, and `profileHash` (sha-256 of canonical sorted-key JSON).
- [x] T004 [P] Create `apps/server/src/bench/load/stats.ts`: nearest-rank `percentile(sorted, p)`, `ingestVerdict(steps, thresholds)`, and `concurrencyVerdict(steps, thresholds)`. Apply research R5 rules exactly, including the absolute floors (100 ms service, 20 ms enqueue, 50 ms latency). Compute one ingest verdict per worker count.
- [x] T005 [P] Create `apps/server/src/bench/load/synth.ts`: `synthDoc(seed, bytes)` per research R2. Use a mulberry32 PRNG and an in-code list of about 200 plain English words written for this file. Emit `#`/`##`/`###` headings, paragraphs, and bullet lists. Use no rulebook text.
- [x] T006 [P] Create `apps/server/src/bench/load/db.ts`: `resolveLoadUrl(env)` (research R3: `LOAD_DATABASE_URL`, else `TEST_DATABASE_URL || DATABASE_URL` with the database name suffixed `_load`; throw on equal URLs and on a non-loopback host); `recreateLoadDb` (refuse when `pg_stat_activity` shows another connection to it, then `DROP DATABASE IF EXISTS`, `CREATE DATABASE` with a quoted identifier, and migrate with `migrationsFolder` resolved from `import.meta.url`); `dropLoadDb`; `seedUsers(db, n)` (player users plus `createSession` cookies, research R9); and `preloadHistory(db, rows)` (one `INSERT ... SELECT generate_series` of `succeeded` jobs rows).
- [x] T007 Create `apps/server/src/bench/load/cases.ts` with the `Case` type and the `CASES` registry of all 7 cases from research R10, each with id, tier, target, and summary. Stub each `run` to return `fail` with reason `not implemented`. Add `selectCases(tier, only)`, which returns `run` and `skipped` per contracts/bench-cli.md with the fixed reasons.
- [x] T008 Create `apps/server/src/bench/load/results.ts`: `LoadResultsSchema` and `CaseOutcomeSchema` (contracts/results-format.md, data-model.md); `writeResults` (commit via `git rev-parse HEAD`, dirty via `git status --porcelain`, both with `execFileSync`; host facts from `node:os`; name `<date>-<sha7>-<runId8>.json`; two-space JSON plus a trailing newline).
- [x] T009 Create `apps/server/test/bench/load.test.ts`. Cover contract invariants 1–6 and 8, and add invariant 9 with fabricated outcomes. Run it; it needs no database.

**Checkpoint**: `pnpm --filter @the-stacks/server test -- test/bench/load.test.ts` is green without a database.

## Phase 3: User Story 1 — find where ingest degrades (P1, AC #1)

**Goal**: the decision-0005 measurement. **Independent test**: `pnpm bench:load run --tier demand --case ingest-scaling` prints a table and a verdict per worker count.

- [x] T010 [US1] Create `apps/server/src/bench/load/worker-proc.ts`, the forked worker entry (research R4). Build a gateway with a `fake` provider, purpose `load-embed` (op `embed`), and call `startIngestWorker` against `LOAD_DATABASE_URL` with its own `uploadDir`. Send IPC `ready` after start and stop on IPC `stop`. With `LOAD_HOLD_EMBED=1`, register a `fake` adapter whose `embed()` sends IPC `embed-held` and never resolves (research R6).
- [x] T011 [US1] Create `apps/server/src/bench/load/ingest.ts`: `runIngestSeries(ctx, profile, { inProcess })`. Per worker count: recreate the load database, preload history, start workers (forked `dist/bench/load/worker-proc.js`, or one in-process `startIngestWorker` when `inProcess`), then for each cumulative volume write `synthDoc` files and `enqueueIngest` each with book `load-<runId8>-<n>`, timing each call. Wait until the step's jobs are terminal or `stepTimeoutMs` passes. Compute the step metrics from `jobs` rows per research R4. Stop workers in a `finally`. Implement the `ingest-smoke` (in-process, `commit` profile) and `ingest-scaling` (forked) case `run`s in `cases.ts`. `ingest-smoke` passes only when every job succeeds and each book has exactly one `library_documents` row.
- [x] T012 [US1] Print the ingest step table and `VERDICT` lines in the format of contracts/bench-cli.md, from a `printIngest` function in `ingest.ts`.

**Checkpoint**: `ingest-smoke` passes on the test stack; `ingest-scaling` prints two series and two verdicts.

## Phase 4: User Story 2 — find where concurrent users degrade (P1, AC #2)

**Goal**: HTTP and WebSocket latency and errors by user count. **Independent test**: `pnpm bench:load run --tier demand --case concurrency-local` prints a table and a verdict.

- [x] T013 [US2] Create `apps/server/src/bench/load/users.ts`: `runUsers({ baseUrl, cookies, users, durationMs, thinkMs, wsSend, wsSessionId, userAgent })` per research R8. Use global `fetch` with `AbortSignal.timeout(10_000)` and the installed `ws` client with the cookie header. Record per-sample latencies and classify errors into the fixed `errorKinds`. Return one concurrency step. Add no dependency.
- [x] T014 [US2] Create `apps/server/src/bench/load/app-proc.ts`: `startApp({ databaseUrl })` spawns `node dist/index.js` with `APP_PORT` set to a free port (bind port 0, read it, close), fake AI config, and `GIT_COMMIT`; it waits for `/health` `ok`, and returns `{ url, pid, alive(), stop() }`. `stop()` sends `SIGTERM`, then `SIGKILL` after 5 s.
- [x] T015 [US2] Create `apps/server/src/bench/load/concurrency.ts` with three case `run`s. `concurrency-smoke`: build `createApp` plus the WS `createGateway` in process on port 0 (pattern of `apps/server/test/ws.integration.test.ts`); run 3 users for 2 s with `wsSend: true`; pass only when errors are 0 and every round trip arrived. `concurrency-local`: `startApp` against the load database; `seedUsers` for the largest step; run each step; compute the verdict. `concurrency-dev`: follow research R11 steps 1–5 exactly. Use one sign-in, force `wsSend: false`, use a random v4 `wsSessionId`, a 45 s first-health timeout, and sign-out plus the 401 check in a `finally`. Record `sessionEnded`. Never retry a write.
- [x] T016 [US2] Print the concurrency table and `VERDICT` line from `printConcurrency` in `concurrency.ts`.

**Checkpoint**: `concurrency-smoke` passes; `concurrency-local` prints 5 steps and a verdict.

## Phase 5: User Story 4 — tiers, visible skips, and the CLI (P1, AC #4)

**Goal**: one command per tier; every other case skips visibly. **Independent test**: quickstart steps 1–3 and 5.

- [x] T017 [US4] Create `apps/server/src/bench/load/cli.ts` and `index.ts` per contracts/bench-cli.md. Implement `list`, `run` steps 1–7, and exit codes 0/1/2 with `node:util` `parseArgs`. The dev guards in step 4 run before any network call. Credentials are read from env only and never printed.
- [x] T018 [US4] Create `apps/server/test/bench/load.integration.test.ts` with the loud-skip harness copied from `apps/server/test/library/worker.integration.test.ts` (under `REQUIRE_DATABASE=1` it throws). Iterate `CASES`: run each `commit` case as `it(id)` against a load database from `resolveLoadUrl`, and register every other case as `it.skip("<id> [tier <tier>] — <reason>")` plus a `console.info` skip line. Drop the load database in `afterAll`. Give the file a 30 s budget.
- [x] T019 [US4] Add contract invariant 7 to `apps/server/test/bench/load.test.ts`: a dev run without `--allow-dev` exits 2, and a `fetch` spy plus a `ws` constructor spy see zero calls. Add the unset-URL case: skip line and exit 0.

**Checkpoint**: `REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server test -- test/bench` shows 2 passing and 5 named skips.

## Phase 6: User Story 3 — stress cases (P2, AC #3)

**Goal**: record how the system fails and recovers. **Independent test**: `pnpm bench:load run --tier demand --case db-exhaustion --case restart-mid-ingest` prints each expectation with pass or fail.

- [x] T020 [US3] Implement `db-exhaustion` in `apps/server/src/bench/load/stress.ts` per research R7. Refuse under `VITEST`. `startApp`, seed and warm one session, wait 11 s, read `max_connections`, and open raw `pg` clients until `53300` or the limit. Probe for `holdMs` once per second: `/health` degraded within 5 s, `/auth/me` any 5xx within 10 s, WS upgrade `503` not `401`, process alive. End every held client in a `finally`. Record `recoverySec` until `/health` is `ok` and `/auth/me` is 200, `heldConnections`, and `maxConnections`.
- [x] T021 [US3] Implement `restart-mid-ingest` in `apps/server/src/bench/load/stress.ts` per research R6. Enqueue 1 target and `followers` jobs, fork a `LOAD_HOLD_EMBED=1` worker, wait for `embed-held`, and `SIGKILL` it. Fork a normal worker. Poll until all jobs are terminal or `reclaimTimeoutMs` (default 120 000) passes. Record `followers-succeeded`, `target-attempts-2`, `target-succeeded`, `one-document-per-book`, and `reclaimSec`. Stop the worker in a `finally`.

**Checkpoint**: both stress cases run to completion and record every expectation.

## Phase 7: User Story 5 — compare runs over time (P2, AC #5)

**Goal**: stored, comparable runs. **Independent test**: quickstart step 7.

- [x] T022 [US5] Add `report(dir)` to `apps/server/src/bench/load/results.ts` and wire it to `cli.ts`. Validate each file, warn and skip on invalid or unknown versions, and print one table per (case id, target kind) sorted by `startedAt`.
- [x] T023 [US5] Add a `report` case to `apps/server/test/bench/load.test.ts`: two fabricated files, one local and one dev, for the same case print two groups.
- [x] T024 [US5] Run `pnpm bench:load run --tier commit` and `pnpm bench:load run --tier demand` once each on the worktree test stack. Commit both results files under `apps/server/bench/load/results/`. Copy the `ingest-scaling` verdicts and the `reclaimSec` finding into the PR body as the decision-0005 measurement.

## Phase 8: Polish, gates, re-grounding, and the dev run

- [ ] T025 Merge `origin/main` into the branch (never rebase). If TASK-0029 merged, check for `src/bench/` or `docs/wiki/benchmarks.md` overlap and resolve by keeping both benches' sections.
- [ ] T026 Dev run: **OPERATOR CHECKPOINT; the orchestrator runs it, not an implementer.** Announce the exact command from quickstart step 6, the target URL, the account name, and research R11's step list. Wait for the operator's explicit go on that command. The operator supplies the credentials in the shell. Run it from the Mac. Confirm the output shows `session ended: yes`. Commit the results file. If sign-out fails or `dev` is unhealthy, stop and report; do not run any vm-104 command without a separate per-command go.
- [ ] T027 Run `REQUIRE_DATABASE=1 pnpm ci:check` on this worktree's stack. Export `TEST_DATABASE_URL` from the worktree `.env` first. It must be green with 0 DB suites skipped (the 5 non-commit cases show as named skips, which is expected). Record the counts and the commit-tier duration (SC-001) for the PR body. If CI's database role blocks `CREATE DATABASE`, stop and report; do not edit `.github/workflows/ci.yml` without that report.
- [ ] T028 Verify content hygiene. `git diff origin/main --stat -- apps/server/bench/load` lists only profiles, `.gitkeep`, and results. Search the results files for the dev URL host, `session=`, and the dev username; expect no match.
- [ ] T029 Wiki review with honest re-pins (`/grounding-wiki:wiki-update`). Classify each pinned note RE-PIN-ONLY or NEEDS-REVIEW against the diff. Expected: `test-suite` (new bench suites and visible skips), `ci-pipeline` (`ci:check` now runs the commit-tier cases inside `pnpm test`), `ingestion` (decision-0005's measurement exists; record the restart reclaim finding), `monorepo-and-toolchain` (root `bench:load` script). For `docs/wiki/benchmarks.md` (kind: pipeline): if TASK-0029 already merged it, add a "Load and stress" section and this feature's sources; otherwise create the note with that section, and TASK-0029 extends it. Cover the case registry and tiers, the load database isolation, direct enqueue and synthetic docs, forked workers, the degradation rules, the stress cases, the dev run's read-only steps, and the results format. Pin it and list it in `INDEX.md` under Testing and verification. State in the PR body which path was taken.
- [ ] T030 Regenerate `docs/wiki/CAPSULES.md`, because a note was added or extended and descriptions changed.
- [ ] T031 Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.65.3/gates/cli.mjs freshness . docs/wiki`. It must print `OK`. Never run `gates/freshness.mjs`.
- [ ] T032 Run `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.65.3/gates/cli.mjs check .`. It must exit 0. Tick this file's completed tasks.
- [ ] T033 Run `pnpm env:down`, then `pnpm env:prune --check`. The prune check must exit 0.

## Dependencies & Execution Order

- Phase 1 → Phase 2. T003–T006 run in parallel; T007 and T008 need T003; T009 needs T003–T008.
- Phase 3 (US1) and Phase 4 (US2) need Phase 2. They touch different files and can run in
  parallel, except both edit `cases.ts` (serialize those edits).
- Phase 5 (US4) needs Phases 3 and 4: the integration file runs the smoke cases.
- Phase 6 (US3) needs T010 (worker entry) and T014 (app process).
- Phase 7 (US5) needs Phase 5's CLI. T024 needs Phases 3, 4, and 6.
- Phase 8 needs everything. T026 (dev run) needs T017 and a merged-or-current `dev`.
- Dispatch: one implementer per phase at the sonnet tier (runbook). T026 is orchestrator-run.

## Parallel Examples

- Phase 2: T003, T004, T005, T006 at once.
- Phases 3 and 4 in two lanes after Phase 2, merging `cases.ts` edits in order.

## Implementation Strategy

MVP = Phases 1–5: the registry, the ingest measurement decision-0005 needs, the concurrency
measurement, and the every-commit cases with visible skips. Phase 6 adds stress cases. Phase 7
adds stored comparison. Phase 8 re-grounds, runs the gates, and records the one dev run. No new
dependency, no migration, no CI workflow change, no command on vm-104.

## Deviation

T009's checkpoint runs with no database, as written. In addition, this implementer added
`apps/server/test/bench/load-db.integration.test.ts` (loud-skip harness, `describe.skipIf`) to
exercise `db.ts`'s three refusal guards — equal-URL and non-loopback-host at the unit level in
`load.test.ts`, and the `pg_stat_activity` "database in use" guard, which needs a real Postgres
connection to trigger — against the worktree's test stack. This is a separate file from Phase
5's `load.integration.test.ts` (T018) to avoid colliding with that later task; it covers only
Phase 2's `db.ts`, not the case registry.

T020's `db-exhaustion` (research R7) describes a single sequential `/auth/me` request and a
single WebSocket upgrade attempt per probe. Running it for real showed why that never observes
the outage: the app's own `db` pool (shared by the ingest worker, which polls `jobs` every
`POLL_MS` regardless of whether any job exists) always keeps one connection warm, and a lone
request just reuses that idle connection rather than opening a new one — Postgres refusing
*new* connections never touches it. `/health` uses its own separate, otherwise-idle pool, so it
alone showed `degraded` as written. Fix: each probe round fires 8 concurrent attempts (`BURST`
in `stress.ts`) instead of one, so at least one needs a connection beyond that single warm one;
verified live against the worktree's test stack — all five expectations pass. Marked
`ponytail:` in `stress.ts` pointing back here.

T021's `restart-mid-ingest` was handed back reporting "worker did not reach embed-held within
15000ms" against the live case (1 target + 3 followers), with a standalone one-job repro of the
same fork+IPC path passing. Instrumented re-runs (targetId/followerIds logged before fork, and
every IPC message logged) across 3 live executions — isolated, and immediately after
`db-exhaustion` in the same process — all passed cleanly with the held worker claiming the
target job every time (`target-attempts-2`, `target-succeeded`, `one-document-per-book` all
pass), matching `claimJob`'s `ORDER BY created_at` and research R6: the target is enqueued
first, so it is the oldest queued row and is always the one claimed. No claim-ordering bug
found; the fork path was never observed to claim a follower instead. The prior failure is most
consistent with the 15s fork-to-embed-held budget being tight for real, unmocked I/O (process
fork, module load, DB connect, then extract/parse/store for the target job) under host load —
not a logic defect. Fix: raised `FORK_TIMEOUT_MS` in `stress.ts` from 15s to 30s for both the
held and normal fork waits; the assertion is unchanged (still fails hard on a genuine hang).

T024's full `--tier demand` run (decision-0005) shows `ingest-scaling` degrading by
`throughputFloor` at volume 50 for both worker counts, and genuinely exceeding
`stepTimeoutMs` (120s) at higher volumes: workers=1 completes volume 100 in 57.2s
(1.75 jobs/s) but times out at volume 250 (47 jobs unfinished) and 500 (373 unfinished);
workers=2 completes volume 250 in 76.9s (3.25 jobs/s, roughly double workers=1's rate) but
times out at volume 500 (185 unfinished). The knee moves from between 100-250 jobs at one
worker to between 250-500 at two — real local-Postgres throughput, not a bench defect — so
the case (and the CLI's exit code) correctly reports `fail` for this run. This is the
decision-0005 measurement, expected to fail the CLI's overall exit code at this volume/tier
combination; committed as-is per T024, not treated as a defect to fix.
