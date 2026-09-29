---
name: benchmarks
description: The load and stress bench (specs/021-load-bench, TASK-0030) — the case registry and its three tiers, the isolated `_load` database, synthetic content, the decision-0005 ingest-scaling measurement, concurrency, both stress cases, results/report, and the dev-tier's read-only safety design. Load for any load/stress/throughput/degradation or "how do I bench this" question.
kind: pipeline
sources:
  - apps/server/src/bench/load/cases.ts
  - apps/server/src/bench/load/cli.ts
  - apps/server/src/bench/load/index.ts
  - apps/server/src/bench/load/db.ts
  - apps/server/src/bench/load/profile.ts
  - apps/server/src/bench/load/synth.ts
  - apps/server/src/bench/load/ingest.ts
  - apps/server/src/bench/load/concurrency.ts
  - apps/server/src/bench/load/stress.ts
  - apps/server/src/bench/load/users.ts
  - apps/server/src/bench/load/stats.ts
  - apps/server/src/bench/load/results.ts
  - apps/server/src/bench/load/app-proc.ts
  - apps/server/src/bench/load/worker-proc.ts
  - apps/server/bench/load/profiles/commit.json
  - apps/server/bench/load/profiles/demand.json
  - apps/server/bench/load/profiles/dev.json
  - apps/server/test/bench/load.test.ts
  - apps/server/test/bench/load.integration.test.ts
  - apps/server/test/bench/load-db.integration.test.ts
  - apps/server/package.json
  - package.json
  - specs/021-load-bench/tasks.md
  - specs/021-load-bench/research.md
  - specs/021-load-bench/quickstart.md
  - specs/021-load-bench/contracts/results-format.md
verified_against: 66f6c026d9aee137ccb9c236dd7874359c02d6ae
---

# Benchmarks

The load and stress bench (specs/021-load-bench, TASK-0030): a case registry, run either
through Vitest (every commit) or the standalone CLI (on demand, or against the real hosted
`dev` environment under an operator checkpoint). This note's "Load and stress" section is the
first in this file; TASK-0029's separate retrieval-quality benchmark (embedding models,
chunking strategies, recall@k) is expected to add its own section here once it lands.

## Load and stress

**Tiers and visible skips.** Every case in `cases.ts`'s `CASES` registry declares exactly one
tier — `commit`, `demand`, or `dev` — and a target (`local` or `dev`). `selectCases(tier,
only)` splits the full registry into cases to run and every other case as a named `skipped`
outcome with a fixed reason (`"tier X not selected"` or `"not selected by --case"`); `run ∪
skipped` is always all 7 cases, so a reader of any run's output never has to wonder whether a
case ran silently. `commit` (`ingest-smoke`, `concurrency-smoke`) runs inside
`apps/server/test/bench/load.integration.test.ts` on every `pnpm test` — see [[test-suite]] and
[[ci-pipeline]] — where the other 5 cases show up as individually named `it.skip` entries
(`<id> [tier <tier>] — tier <tier> not selected`), not an absence. `demand` (`ingest-scaling`,
`concurrency-local`, `db-exhaustion`, `restart-mid-ingest`) and `dev` (`concurrency-dev`) run
only through the CLI (`pnpm bench:load run --tier demand|dev`), never under Vitest —
`db-exhaustion` and `restart-mid-ingest` explicitly refuse (`status: "skipped"`) when
`process.env.VITEST` is set, since both disrupt or kill real processes/connections that other
suites in the same run depend on.

**The isolated `_load` database and its guards** (`db.ts`, research R3). Every `local`-target
case runs against its own database — `LOAD_DATABASE_URL`, or else `TEST_DATABASE_URL ||
DATABASE_URL` with `_load` appended — never the worktree's app database or the shared test
database other suites use. `resolveLoadUrl` throws if the load URL equals the base URL, or if
its host isn't loopback (`localhost`/`127.0.0.1`/`::1`): a local case can never reach a shared
server. `recreateLoadDb` connects to the *base* URL to `DROP`/`CREATE` the load database (a
database can't drop itself), first refusing if `pg_stat_activity` shows any existing connection
to it — no two local cases, or two runs, can stomp each other. `dropLoadDb` is best-effort
cleanup after a CLI run; a failure there only warns.

**Synthetic content** (`synth.ts`, research R2). `synthDoc(seed, bytes)` is a small seedable
PRNG (`mulberry32` — no dependency) emitting deterministic Markdown (headings, paragraphs,
bullet lists) from a fixed list of ~200 plain English words original to this file — no SRD,
book text, or fixture content anywhere near it (constitution VIII). Same `seed` and `bytes`
always produce byte-identical output, within 5% of the requested size.

**Ingest scaling — the decision-0005 measurement** (`ingest.ts`, `ingest-scaling`). Forks real
worker processes (not in-process) and measures wall time, throughput, queue-wait and service
percentiles across a profile's `volumes` × `workers` matrix, comparing each step's numbers
against the previous step's via `ingestVerdict`'s ratio-plus-floor rules (throughput floor,
service/enqueue multiples, any failure) to find the degradation knee. Run for real on this
worktree's local Postgres (`pnpm bench:load run --tier demand`): **1 worker sustains 1.75
jobs/s** (volume 100 in 57.2s), degrading somewhere **between 100 and 250** queued jobs; **2
workers sustain 3.25 jobs/s** — roughly double — degrading **between 250 and 500**. This is a
recorded measurement of real local-Postgres throughput, not a capacity decision; see
[[ingestion]] for what it implies about the `jobs` queue's claim/lease/recovery path,
specifically the `restart-mid-ingest` finding below.

**Concurrency** (`concurrency.ts`, research R8/R9). Simulated users (`users.ts`'s `runUsers`)
each hold one HTTP+WebSocket session and loop HTTP requests plus optional WS traffic for a
fixed duration; `concurrency-smoke` (commit tier) runs 3 users in-process on port 0;
`concurrency-local` (demand tier) runs the profile's user counts against the real built app on
the load database; `concurrencyVerdict` finds the first user count where latency or error-rate
thresholds fire. Sessions come from `db.ts`'s `seedUsers` — one scrypt hash computed once and
reused for every seeded user, so sign-in cost never dominates a step's latency (research R9).

**Both stress cases** (`stress.ts`, research R6/R7). `db-exhaustion` opens raw `pg` clients
against the load database until Postgres refuses new connections, then probes the running
app: `/health` degrading, `/auth/me` bounding its response, a WebSocket upgrade refused `503`
not `401`, and the process staying alive — each probe round fires 8 concurrent attempts
(`BURST`) rather than one, because the app's own pool always keeps one connection warm (the
ingest worker polls `jobs` regardless of load), so a single sequential probe never observes the
outage. Held connections are released in a `finally`, then recovery is measured. `restart-mid-
ingest` forks a worker, holds it mid-`embed` (an IPC flag), `SIGKILL`s it, forks a normal
worker, and measures lease-reclaim: the target job (enqueued first, so it's the oldest queued
row) is always the one reclaimed — `claimJob`'s `ORDER BY created_at` verified empirically, not
just by reading the SQL — succeeding on its second attempt with followers unaffected and no
duplicate document stored (see [[ingestion]]).

**Results and report** (`results.ts`, contracts/results-format.md). Every run writes
`apps/server/bench/load/results/<date>-<sha7>-<runId8>.json` (schemaVersion 1): git
commit/dirty state, host facts, the tier, target provenance (Postgres version and
`max_connections` for `local`; nothing but a boolean for `dev`), the profile and its hash, and
every case's outcome — run or skipped, with reason. `pnpm bench:load report` groups results by
`(case id, target)` so local and dev runs for the same case never mix into one trend line.

**The dev-tier safety design** (`concurrency.ts`'s `runConcurrencyDev`, research R11).
Read-only end to end, gated hard: the CLI refuses (exit 2) without `--allow-dev`, checked
before any network call; `LOAD_DEV_URL` unset skips `concurrency-dev` cleanly (exit 0). A real
run does exactly one sign-in — one session — runs with `wsSend` forced `false`
(`ProfileSchema` also rejects `wsSend: true`, >25 users, or >180s total for a `dev` profile),
and signs that session out in a `finally` regardless of outcome, verifying it with a follow-up
`/auth/me` expecting `401`. A failed sign-out itself fails the case rather than silently
leaving a live session (it still expires in 30 days on its own). No results file the dev tier
writes ever carries the dev URL, host, username, password, or session cookie — enforced by a
dedicated unit test (`load.test.ts`, invariant 9).

## Connections

`ingest-smoke` and `concurrency-smoke` run inside [[test-suite]]'s Vitest process, gated the
same loud-skip way as its own three integration suites; [[ci-pipeline]] runs them with
`REQUIRE_DATABASE=1` on every PR and push. `ingest-scaling` and `restart-mid-ingest` exercise
[[ingestion]]'s `jobs` queue directly, forking the same worker entry point it starts in
production. `concurrency-local`/`-smoke`/`-dev` exercise [[websocket-gateway]] and
[[session-auth]] through a real running app. `concurrency-dev` is the only case that ever
touches [[hosted-dev]]'s real deployed target, and only under an operator-approved run
(T026). Root `package.json`'s `bench:load` script and `apps/server`'s own are covered by
[[monorepo-and-toolchain]].

## Operational notes

`pnpm bench:load list` prints all 7 cases with their tier and target. A `--tier demand` run
takes roughly 10-15 minutes and drops its load database afterward (best-effort); a `--tier
commit` run finishes in seconds. Case tables and `VERDICT`/`PASS`/`FAIL`/`SKIP` lines print as
each case finishes, not only at the end, so a long `demand` run's progress is visible live.
