# Implementation Plan: Load and stress benchmark

**Branch**: `task-0030-load-bench` | **Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/021-load-bench/spec.md`

## Summary

Add a load bench under `apps/server/src/bench/load/` with a case registry. Each case declares
one tier (`commit`, `demand`, `dev`). The ingest cases enqueue synthetic Markdown documents
directly with `enqueueIngest` into a dedicated `<base>_load` database on the worktree's DB-only
test stack (TASK-0033). They drain each cumulative step with 1 or 2 forked worker processes
running the app's own `startIngestWorker`, and derive throughput and latency from the `jobs`
rows. The concurrency cases drive signed-in users with stdlib `fetch` and the installed `ws`
client. Two stress cases exhaust the test server's connection slots and `SIGKILL` a worker held
mid-embed. A degradation verdict names the first step past a profile threshold. Every run
writes one tracked JSON results file with profile, commit, host, and every case outcome
(including visible skips). Two smoke cases run inside `pnpm test` on every commit. One
read-only dev case runs from the Mac against `dev` only with `--allow-dev` after operator
sign-off. No new dependency, no migration, no CI workflow change, no command on vm-104.

## Technical Context

**Language/Version**: TypeScript 5.9 on Node 22 (existing server package)

**Primary Dependencies**: `pg`, `drizzle-orm` (migrator), `zod`, `ws` (client), global
`fetch`, `node:child_process` `fork`, `node:util` `parseArgs`, `node:perf_hooks`,
`node:crypto` — all installed or stdlib. **No new runtime or dev dependency.**

**Storage**: Postgres 17 + pgvector, same image. A throwaway database `<base>_load` on the
test-stack server, recreated per case (research R3). Results are JSON files in git (R12).

**Testing**: vitest. Pure units (tier selection, URL guard, `synthDoc`, verdicts, percentile,
profile validation, results redaction, dev refusal) need no database. The two `commit` cases run
in one integration file with the loud-skip harness; `REQUIRE_DATABASE=1` turns a skip into a
failure.

**Target Platform**: operator Mac (worktree test stack) and GitHub Actions `ubuntu-latest`
with the pgvector service; `dev` over the tailnet for the dev tier.

**Project Type**: server package tooling (CLI + tests); no route, no client change.

**Performance Goals**: `commit` cases < 30 s together (SC-001). `demand` run about 10–15 min.
`dev` run about 100 s, ≤ 25 users (SC-005).

**Constraints**: no rulebook text (constitution VIII); local cases loopback-only in their own
database; dev cases read-only apart from one session row they delete; every model call through
the gateway's fake provider (decision-0007); production `LEASE_MS` unchanged.

**Scale/Scope**: up to 500 queued jobs over 10 000 history rows, 2 worker processes, 100
simulated users locally.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Agent-operable** — agents drive the bench through `pnpm bench:load` and the
      exported `runTier`/`selectCases`/`CASES` (contracts/bench-cli.md), the same path CI and
      the operator use.
- [x] **II. Content contract** — not applicable: no codex entity.
- [x] **III. Data planes** — local cases write only to the throwaway load database, through the
      library's own `enqueueIngest`/worker and auth's own `createSession`. The dev case writes
      no library, codex, or session-plane state; its one `auth_sessions` row is removed by
      sign-out. `src/bench/` sits outside the plane zones, like tests.
- [x] **IV. Event sourcing** — no play state. The local round-trip probe appends through the
      real gateway `send` path into the throwaway database only; dev forbids `send`.
- [x] **V. Citations** — not applicable: nothing retrieved or claimed.
- [x] **VI. System-agnostic** — synthetic generic Markdown; no 5e assumption.
- [x] **VII. Structured first** — results and profiles are Zod-validated JSON.
- [x] **VIII. Operator-owned content** — ships no rulebook content; synthetic text is generated
      from an original word list; results hold numbers and ids only (invariant 9).
- [x] **IX. Self-hostable** — no new container, service, or dependency; the fake AI provider
      means no key or network for local cases.

**Stack conformance** — TypeScript, Postgres, Drizzle, Zod, one Node process for the app. The
bench's forked workers are measurement harnesses, not a production topology change. No
departure.

**Post-design re-check (after Phase 1)**: all nine hold. The load database is a database on the
existing test server, not a new datastore.

## Project Structure

### Documentation (this feature)

```text
specs/021-load-bench/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── bench-cli.md
│   └── results-format.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/server/
├── bench/load/                        # data (tracked)
│   ├── profiles/commit.json
│   ├── profiles/demand.json
│   ├── profiles/dev.json
│   └── results/.gitkeep
├── src/bench/load/
│   ├── index.ts                       # public API (contracts/bench-cli.md)
│   ├── cases.ts                       # CASES registry, selectCases
│   ├── profile.ts                     # ProfileSchema, loadProfile, profileHash
│   ├── db.ts                          # resolveLoadUrl, recreateLoadDb, dropLoadDb, seedUsers
│   ├── synth.ts                       # synthDoc (seeded, original words)
│   ├── stats.ts                       # percentile, ingestVerdict, concurrencyVerdict
│   ├── ingest.ts                      # ingest-smoke, ingest-scaling
│   ├── worker-proc.ts                 # forked worker entry (IPC ready/stop, LOAD_HOLD_EMBED)
│   ├── users.ts                       # simulated user loop: fetch + ws
│   ├── concurrency.ts                 # concurrency-smoke, concurrency-local, concurrency-dev
│   ├── app-proc.ts                    # start/stop the built app as a child on a free port
│   ├── stress.ts                      # db-exhaustion, restart-mid-ingest
│   ├── results.ts                     # LoadResultsSchema, writeResults, report
│   └── cli.ts                         # parseArgs → list | run | report
├── test/bench/
│   ├── load.test.ts                   # pure units (invariants 1–9)
│   └── load.integration.test.ts       # commit-tier cases + visible skips
└── package.json                       # + "bench:load"
package.json                           # + "bench:load" pass-through
```

`apps/server/tsconfig.json` already compiles `src/**` to `dist/`, so the CLI and the forked
worker entry build with `pnpm build`. No strip-types host script is added, so
`check:host-scripts` is unchanged (research R13). `migrationsFolder` resolves from the module
URL, not the cwd.

## What a dev run does (operator checkpoint)

Exactly research R11. From the Mac, never on vm-104: one health read, one sign-in (one
`auth_sessions` row), 80 s of reads and WebSocket `subscribe` to a random unused session id at
1/5/10/25 users, sign-out in a `finally`, then a 401 check proving the session row is gone.
No library, job, or event write. Credentials come from env and never reach output or results.

## Operator checkpoints

1. **Dev run** (T026): the orchestrator announces the exact command, the target URL, the
   account it signs in as, and the R11 step list. The operator gives an explicit go for that
   command. The operator supplies `LOAD_DEV_USERNAME`/`LOAD_DEV_PASSWORD` in the shell
   (never committed, never pasted into a transcript by the implementer). The results file is
   committed.
2. **No vm-104 command** is in scope. If `dev` is down or a dev session is left behind, stop
   and report; any vm-104 command is a separate, per-command operator go (memory
   `vm-104-command-consent`).
3. **Decision-0005 follow-up**: the ingest verdict is reported to the operator. A worker split,
   if warranted, is a new decision record and card, never part of this PR.

No new runtime dependency. No migration. No CI workflow change: the `commit` cases ride
`pnpm test` inside `ci:check`.

## Complexity Tracking

None.
