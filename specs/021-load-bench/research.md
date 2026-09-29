# Research: Load and stress benchmark

Each entry is a design call with its decision, rationale, and rejected alternatives. Sources:
the TASK-0030 card, doc-0001 ("Added requirement: benchmarks"), decision-0005, doc-0002, the
runbook's TASK-0030 merge condition, the wiki notes `ingestion`, `runtime-stacks`,
`websocket-gateway`, `ws-protocol`, `session-auth`, `hosted-dev`, and the sibling TASK-0029
spec (`specs/019-retrieval-bench/` on `task-0029-retrieval-bench`, unmerged at authoring).

## R1 — How ingest volume is driven

**Decision.** Direct enqueue. The bench writes each synthetic document to a temp file and calls
`enqueueIngest` with that path, exactly what `POST /library/uploads` does after streaming. The
worker then runs the real `runJob` (extract, parse, store, embed) against it.

**Rationale.** decision-0005's question is whether one in-process worker polling the `jobs`
table is enough. That is the claim/lease/drain path, not the HTTP body stream. TASK-0024's merge
condition already measured streaming (peak RSS during the MM upload). Direct enqueue also
removes HTTP and scrypt sign-in cost from the ingest numbers, so the throughput knee is the
queue's own.

**Rejected.** Real uploads through HTTP (mixes transport cost into queue numbers; needs a
running app and a session per step). Inserting `jobs` rows by raw SQL (bypasses the real
enqueue path and its `jobs_active_book_key` guard).

## R2 — Synthetic documents

**Decision.** A deterministic generator, `synthDoc(seed, bytes)`, emits Markdown: `#`/`##`/`###`
headings, paragraphs, and bullet lists built from a fixed list of about 200 plain English words
in code, chosen by a seeded PRNG (mulberry32). Each job gets a unique book name
`load-<runId8>-<n>`, so the active-book unique index never refuses an enqueue. The default size
is 32 KiB (a mid-size chapter). The format is Markdown so the parse stage is `parseMarkdown`,
the cheapest real path; the stage cost is measured, not faked.

**Rationale.** Constitution VIII and decision-0003: no book text, and SRD text is not needed
because nothing scores content. Original generated text commits nothing at all: no corpus file
exists.

**Rejected.** Reusing TASK-0029's SRD corpus (couples two benches; volume needs hundreds of
distinct books anyway). DDB-shaped HTML (the DDB parser has its own perf test,
`ddb.perf.test.ts`).

## R3 — Isolation: the load database

**Decision.** Every local case runs in a dedicated database named `<base>_load`, where `base`
is `TEST_DATABASE_URL || DATABASE_URL` (the `db:migrate` precedence). `LOAD_DATABASE_URL`
overrides it. The rules:

- Refuse when the load URL equals the base URL.
- Refuse when the load URL's host is not loopback (`localhost`, `127.0.0.1`, `::1`). A local
  case never touches a shared server.
- Refuse when `pg_stat_activity` shows another connection to the load database (a concurrent
  run).
- Otherwise `DROP DATABASE IF EXISTS`, `CREATE DATABASE`, and apply migrations with drizzle's
  migrator, before **each** case. Cases never see each other's rows.

On a worktree the base is `.env`'s `TEST_DATABASE_URL`, the TASK-0033 DB-only test stack. No
app process polls that server, so no foreign worker races the bench's workers (the TASK-0024
flake). The worktree's app container uses the app database on another server and never sees
the load database. In CI the base is the service database on `localhost:5432`, where the role
is superuser and may create databases.

The suffix `_load` differs from TASK-0029's `_bench`, so the two benches never share a
database.

**Rejected.** Sharing the test database (other suites' rows and the `worker.integration` queue).
Running against the worktree's app database (the app container's own worker would claim bench
jobs, which is exactly what TASK-0033 exists to prevent). A Postgres schema per run (drizzle
table objects are schema-bound).

## R4 — Workers and the worker-count axis

**Decision.** The `demand` ingest case drains each step with **N worker processes**, N from the
profile (default `[1, 2]`). Each worker is a forked Node child running
`dist/bench/load/worker-proc.js`, which calls the app's own `startIngestWorker` against the load
database with a fake embed gateway (R8 of spec 017's fake provider, kind `fake`, purpose
`load-embed`, op `embed`). Children report `ready` over IPC and stop on an IPC `stop`.

N = 1 is today's production shape: one worker loop in one process. N = 2 is the worker split
decision-0005 names. The pair answers the decision directly: does a second process raise
throughput, and does claim contention on `FOR UPDATE SKIP LOCKED` cost anything.

The `commit` smoke case runs one worker loop in the test process (vitest runs TypeScript
sources; the forked entry needs `dist/`).

**Steps.** For each N: fresh load database; preload `historyRows` terminal rows (default 10 000
in `demand`) by one `INSERT ... SELECT generate_series` of `succeeded` rows, so the claim query
runs against a realistic table; start N workers; then for each volume V in the profile's
cumulative list, enqueue V jobs (sequentially awaited, each insert timed) while workers run,
and wait until every job of the step is terminal or the step deadline passes.

**Per-step metrics** come from the `jobs` rows, not client timers:
- queue wait = `started_at − created_at`; service = `finished_at − started_at`;
- throughput = step jobs ÷ (last `finished_at` − first `created_at`), jobs per second;
- enqueue latency = client-timed `enqueueIngest` call;
- `tableRows` = `count(*)` of `jobs` at step end; `failed` = step jobs not `succeeded`.

**Rejected.** N worker loops in one process (shares one event loop; it measures SKIP LOCKED
contention but not the process split decision-0005 asks about). Spawning the whole app per
worker (adds an HTTP listener that plays no part).

## R5 — What "degrades" means

**Decision.** The first step of each series is the baseline. A later step is **degraded** when
any rule fires; the verdict names the first degraded step and every rule that fired there.

Ingest (per worker count):
- `throughput`: throughput < `throughputFloor` × baseline (default 0.7);
- `service`: service p95 > `serviceMultiple` × baseline p95 (default 2.0) and > 100 ms;
- `enqueue`: enqueue p95 > `enqueueMultiple` × baseline p95 (default 3.0) and > 20 ms;
- `failed` > 0 or the step timed out.

Concurrency:
- `latency`: HTTP p95 > `latencyMultiple` × the one-user step's p95 (default 3.0) and > 50 ms;
- `errors`: error rate > `errorRate` (default 0.01).

The absolute floors keep millisecond noise on tiny numbers from reading as a knee. Thresholds
live in the profile and are copied into the results, so a verdict is always read beside the
rule that produced it. The verdict is a report, not a failure: a `demand` case exits 0 with a
degradation found. Only broken expectations (failed jobs, a crash, a hang) fail a case.

**Rejected.** A fitted curve or knee detector (more code, harder to read than "first step past
a named ratio"). Absolute SLOs (no hardware target exists yet; ratios compare within a host).

## R6 — App restart mid-ingest

**Decision.** `restart-mid-ingest` (tier `demand`) forks a worker child with
`LOAD_HOLD_EMBED=1`. That child's gateway registers an adapter for kind `fake` whose `embed()`
sends IPC `embed-held` and never resolves. The case enqueues one target job plus 3 followers,
waits for `embed-held` (the target is `running` at stage `embed`, its document stored), then
`SIGKILL`s the child. It forks a normal worker child and polls the `jobs` table.

Holding the embed call makes "mid-stage" certain: the kill can never land after the job
finishes. Expected, each asserted and recorded:
- the 3 followers succeed without waiting for the lease (they are `queued`, claimed first);
- the target is reclaimed after its lease expires (`LEASE_MS` 60 s + up to `POLL_MS`), its
  `attempts` is 2, and it ends `succeeded`;
- `library_documents` holds exactly one row for the target book (replace, not duplicate);
- kill-to-reclaim seconds, recorded as the finding: today a crash costs up to about 62 s per
  in-flight job.

The killed process runs the app's own `startIngestWorker`. Killing the whole app process
differs only by its HTTP listener, which plays no part in queue recovery.

**Rejected.** Killing mid-job without a hold (a race; small jobs finish first). Shortening
`LEASE_MS` for the bench (the recorded number must be production's). A `commit` variant (it
waits 60 s; lease recovery is already asserted in `jobs.integration.test.ts`).

## R7 — Database connection exhaustion

**Decision.** `db-exhaustion` (tier `demand`, local only). The case starts the built app as a
child (`node dist/index.js`, `DATABASE_URL` = load database, `APP_PORT` = a free port, fake AI
config), seeds one user and session, and warms it. It then waits 11 s so the app pool's idle
clients close (pg's default idle timeout is 10 s). It reads `max_connections` and opens raw
`pg` clients to the load server until Postgres refuses with `53300` or the count reaches
`max_connections`. It holds them for a 15 s probe window and probes once per second:

- `GET /health`: expect 200 with `status: "degraded"` within 5 s (the probe timeout is 3 s);
- `GET /auth/me` with the session cookie: expect a bounded failure (any 5xx) within 10 s — a
  response slower than 10 s is recorded as a hang;
- a WebSocket upgrade with the cookie: expect `503`, never `401` (datastore failure must not
  read as signed out, per `websocket-gateway`);
- the child process is still alive.

It then ends every held client and records seconds until `/health` reports `ok` and `/auth/me`
returns 200. Each expectation is a pass or fail in the results.

**Safety.** The loopback guard (R3) is the safety: only the worktree's own throwaway test stack
server is exhausted. Held clients are ended in a `finally`, and the test stack is `tmpfs`, so
even a crashed run leaves nothing after `pnpm env:down`. The run notes that other tests on the
same test stack fail during the window, so the case refuses to start under `VITEST`.

**Rejected.** Lowering `max_connections` in `docker-compose.test.yml` (changes the shared test
stack for every suite). Exhausting the app's pool only (pg's pool queues without a bound; that
measures pool queuing, not exhaustion; noted as a follow-up observation, not a case).

## R8 — HTTP and WebSocket load with no new dependency

**Decision.** Node 22's global `fetch` for HTTP and the `ws` package's client for WebSocket.
`ws` is already a runtime dependency of `apps/server` (the gateway uses it). **No new
dependency.**

Each simulated user is an async loop in the bench process for the step's `durationMs`:
- HTTP: alternate `GET /auth/me` (cookie) and `GET /health`, then sleep `thinkMs` (default
  250). Each request is timed with `performance.now()` and classified ok, HTTP error, or
  network error/timeout (`AbortSignal.timeout(10_000)`).
- WebSocket: connect with the cookie header (connect time), send `subscribe` for the step's
  `wsSessionId`, time until `replay-complete` (subscribe time). With `wsSend: true` (local
  only), send one `send` frame per second and time until its own `event` frame (round trip).

Percentiles use nearest-rank over the sorted samples. One Node process drives up to 100 users
on a 10-core Mac; the results record the host's CPU count so a client-bound run is visible.

**Rejected.** autocannon or k6 (a new dependency or a new binary for what a loop does).
Worker threads for the client (not needed at 100 users; revisit if the bench process saturates
before the app, which the report shows as flat latency with high client CPU).

## R9 — Sessions for simulated users

**Decision.** Local cases seed users straight into the load database and mint cookies with
`createSession`. One user per simulated user, role `player`, a fixed non-secret password hash.
Sign-in (scrypt) is kept out of the loop so it does not dominate latency.

The dev case signs in **once** with the operator-named account and shares that one cookie
across all simulated users, then signs out (R11).

## R10 — Tiers and visible skips

**Decision.** Every case declares one tier in a registry (`cases.ts`):

| Case | Tier | Why this tier |
|---|---|---|
| `ingest-smoke` | commit | 2 steps (3, 6 jobs), 1 in-process worker; asserts every job succeeds, one document per book, step rows complete, verdict computed. No timing assertion. |
| `concurrency-smoke` | commit | in-process app on port 0, 3 users, 2 s; asserts zero errors and every WebSocket round trip arrives. No timing assertion. |
| `ingest-scaling` | demand | the decision-0005 measurement; minutes of work. |
| `concurrency-local` | demand | users 1–100 against the built app; minutes. |
| `db-exhaustion` | demand | disrupts every connection to the test stack server. |
| `restart-mid-ingest` | demand | waits out a 60 s lease. |
| `concurrency-dev` | dev | only meaningful on real deployed hardware and network; read-only. |

A run names one tier. Every other case prints
`SKIP <id> [tier <tier>]: <reason>` and is recorded `skipped` with that reason. Reasons are
fixed strings: `tier <t> not selected`, `dev target not configured (LOAD_DEV_URL unset)`,
`not selected by --case`.

In `pnpm test`, `apps/server/test/bench/load.integration.test.ts` iterates the registry. Commit
cases are `it(...)`; every other case is `it.skip("<id> [tier <tier>] — <reason>")` plus a
`console.info` skip line, so the vitest output names each one. The file uses the loud-skip
harness; under `REQUIRE_DATABASE=1` it cannot skip the commit cases.

No case needs dev when running locally, and none of `ingest-*`, `db-exhaustion`, or `restart-*`
is ever offered a dev target: those write or disrupt, which dev forbids. A scheduled dev run is
out of scope: every dev run is an operator checkpoint, and a schedule would bypass it. Card it
if the operator wants one.

## R11 — The dev tier: exactly what a run does

**Decision.** `concurrency-dev` runs **from the operator's Mac**, over the tailnet, against
`LOAD_DEV_URL` (`https://vm-104.tailb3c1b6.ts.net:8443`). **No command runs on vm-104.** It
needs `LOAD_DEV_USERNAME` and `LOAD_DEV_PASSWORD` (an existing dev account the operator names)
and the flag `--allow-dev`. Without the flag it exits 2 before any network call. Without the
URL it skips with a reason and exits 0.

The run, in order:
1. `GET /health`. Record the commit. Stop unless `status` is `ok`. (First request may wait
   about 30 s for the tailnet certificate; a 45 s timeout covers it.)
2. `POST /auth/sign-in` once. This writes one `auth_sessions` row: the run's only write.
3. Steps of 1, 5, 10, 25 users, 20 s each: `GET /auth/me`, `GET /health`, and a WebSocket
   `subscribe` to a random v4 `wsSessionId` that no real play session uses. Subscribe is a read:
   it replays an empty log and returns `replay-complete`. `wsSend` is forced `false`: no event
   is appended.
4. In a `finally`: `POST /auth/sign-out`, then `GET /auth/me` with the old cookie must return
   401. That proves the session row is gone.
5. Write the results file locally.

Every request carries `user-agent: the-stacks-load-bench/<sha7>`. Total wall time is about
100 s. Peak load is 25 users. Nothing touches the library, the `jobs` table, or the event log.
If sign-out fails, the case fails and prints: "dev session not ended; it expires on <date>;
ask the operator before any removal". The bench never retries a write on dev.

Credentials are read from the environment only. They are never printed, logged, or written to
results.

## R12 — Results storage and comparison

**Decision.** Follow TASK-0029's convention (contracts/results-format.md there): one JSON file
per run in `apps/server/bench/load/results/<YYYY-MM-DD>-<sha7>-<runId8>.json`, tracked in git,
`schemaVersion: 1`, two-space JSON with a trailing newline, commit from `git rev-parse HEAD`,
dirty from `git status --porcelain`. A run worth comparing is committed; a scratch run is
deleted. `report` reads every file, skips invalid ones with a warning, and prints one table per
(case id, target) group, rows sorted by date. Local and dev results never share a group.
Files hold numbers, ids, fixed strings, and the dev target's observed commit. Never a URL,
credential, cookie, or document text.

The `commit`-tier vitest case writes no results file. `pnpm bench:load run --tier commit` does.

## R13 — Where the code lives; relation to TASK-0029

**Decision.** Code in `apps/server/src/bench/load/`, beside TASK-0029's
`src/bench/retrieval/`. Profiles and results in `apps/server/bench/load/`. The CLI is compiled
by the server's `tsc -b` and run as `node dist/bench/load/cli.js` through a server script
`bench:load` and a root pass-through, the same as `bench:retrieval`.

Because the CLI is compiled by `pnpm build` inside `ci:check`, it is not a strip-types host
script; `check:host-scripts` needs no extension.

Both benches need git provenance and a suffixed-database resolver. This feature writes its own
small copies. `ponytail:` two copies of `gitProvenance`/suffixed-URL logic; fold into
`src/bench/common.ts` once both have merged (a refactor-triage item, not this PR).

**Rejected.** Importing from `src/bench/retrieval/` (TASK-0029 is unmerged; a cross-bench import
couples two PRs' merge order).

## R14 — Wiki

**Decision.** One note `docs/wiki/benchmarks.md` covers both benches. If TASK-0029 merges first
and creates it, this task adds a "Load and stress" section and its sources. If this task merges
first, it creates the note with a "Load and stress" section, and TASK-0029 extends it. Review
`test-suite`, `ci-pipeline`, `ingestion` (decision-0005's measurement now exists; the restart
finding), and `monorepo-and-toolchain` (root script).
