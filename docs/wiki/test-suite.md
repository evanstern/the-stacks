---
name: test-suite
description: What this note's 12 core server test files / 93 tests cover, the environment-gated integration suites that loud-skip without a database (or throw under REQUIRE_DATABASE=1), and that apps/server/test/ is its own typechecked project reference. DB scene tests carry load-sized timeouts (TASK-0154). The CI latency gate (TASK-0300) is in a section below. The larger ingestion suite is [[ingestion]]; the bench suite is [[benchmarks]]; the web app's own SSR suite is [[react-router-app]].
kind: concept
sources:
  - apps/server/test/auth.integration.test.ts
  - apps/server/test/auth.password.test.ts
  - apps/server/test/config.test.ts
  - apps/server/test/db.test.ts
  - apps/server/test/echo.test.ts
  - apps/server/test/events.integration.test.ts
  - apps/server/test/events.test.ts
  - apps/server/test/health.test.ts
  - apps/server/test/static.test.ts
  - apps/server/test/ws.integration.test.ts
  - apps/server/test/ws.protocol.test.ts
  - apps/server/test/ws.subscribe.test.ts
  - apps/server/test/gate.integration.test.ts
  - apps/server/test/gate.restart.integration.test.ts
  - apps/server/test/write-boundary.test.ts
  - apps/server/test/helpers/import-graph.ts
  - apps/server/test/bench/load.test.ts
  - apps/server/test/bench/load.integration.test.ts
  - apps/server/test/bench/load-db.integration.test.ts
  - apps/server/test/dm/scene.integration.test.ts
  - apps/server/test/playtest/harness.integration.test.ts
  - apps/server/test/playtest/provider.integration.test.ts
  - apps/server/package.json
  - apps/server/tsconfig.json
  - apps/server/test/tsconfig.json
  - apps/server/vitest.config.ts
  - apps/server/vitest.timing.config.ts
  - apps/server/test/intent-latency.bench-test.ts
  - apps/server/test/ai-round.bench-test.ts
  - tsconfig.json
size_budget_exempt: spec 102 adds the server tsconfig reference to packages/intent in the one test-suite note; the suite map does not split without a TASK of its own
verified_against: a13be04e8a7cb8310bd0d5cfa3a518c5c29c310f
---

# Test suite

The server's tests run under Vitest (`pnpm --filter @the-stacks/server test`, i.e. `vitest
run`). This note's scope is the 12 files below, at the top of `apps/server/test/`; TASK-0024
added a larger suite under `apps/server/test/library/` — see [[ingestion]]
for that one; its `ai.*.test.ts` siblings are not covered here either.
TASK-0029 and TASK-0030 share a third subdirectory, `apps/server/test/bench/` (retrieval and
load benches, loud-skip-or-throw like this note's three below): see [[benchmarks]], including why 5 of
the load bench's tests are always skipped.
TASK-0048 added `test/playtest/` ([[playtest-harness]]): unit files, three database-gated, one the CI playtest ([[m2-demo]]).
TASK-0045 added gate suites at the same level: `gate.integration.test.ts` (incl. the absent-declare refusal and the presence-plus-order batch) and
`gate.restart.integration.test.ts` (database-gated; approvals, restart) and `write-boundary.test.ts` (no database; AC #1 import-graph check, plus only `resolve.ts` and `intent-runner.ts` (spec 104) build `scene-presence` and only `dm/floor.ts` builds `floor` proposals, [[turn-floor]]; spec 066 adds two pins: only `dm/talk-turn.ts` builds an `action.suggest` proposal and no `src/` file builds `action.accept`). It extended `events.integration.test.ts` (`expectedLastSeq`,
`SeqConflictError`, `readLatestOfType`), `ws.integration.test.ts` (per-viewer delivery, the
send-path classification, `UNKNOWN_EVENT_TYPE`, error `code`; `sendTalkAndAwait` no longer resends on `CONFLICT`) and `ws.subscribe.test.ts` (the DM-seat subscribe race).
TASK-0157 added a retry-wait test and a "per-session ordering" suite (burst fan-out, `recordPresence`, isolation) to `gate.integration.test.ts`, an all-in-flight burst to `ws.integration.test.ts`, and a `CONFLICT` label case to `apps/web/test/play/reduce-frame.test.mjs`.
Spec 104 migrated the scripted turn tests and `test/dm/scripts/*.json` to Intent stages and added `intent-runner.integration.test.ts`, `interpret-intents.test.ts` and `narrate-window.test.ts`; `scene.integration.test.ts` now expects the social check ruled by a `ruling` Intent (an `intent.recorded` row answering `act-persuade.0`), not a `ruling-` journal entry. TASK-0046 added `apps/server/test/dm/` (unit tests and `skipIf(!reachable)` integration suites over a scripted `FakeProvider`; see [[dm-runtime]]).
It also extended `ai.gateway`-level fake scripting (`scriptChatFor`, `strict`; [[ai-gateway]]).
Their counts are not in the totals below.
Of these 12, three are integration suites that require a reachable Postgres —
`auth.integration.test.ts`, `events.integration.test.ts`, `ws.integration.test.ts` — covering
session auth (US1–US4, plus the shared `identityLookup` case from TASK-0040), the event log's
append/read/visibility, and the WebSocket gateway's Phase 2–7 behavior (fan-out, server
authority, the replay/live boundary, visibility filtering) respectively. The rest are
unit-level: password hashing, `loadConfig`'s `uploadMaxBytes` validation (`config.test.ts`,
TASK-0024), the DB reachability probe, the echo route (including a generic
`PayloadTooLargeError` → 413 case added for TASK-0024, see [[error-contract]]), plain
event-log helpers, `/health`, the web middleware's reserved-path/asset/handler-seam behavior
(`static.test.ts`, rewritten for TASK-0040 — see [[static-serving]]; TASK-0028 added one case
asserting the load context's `jobs()` resolves `null` with no cookie and never calls the
injected `listJobs`), and the protocol/subscribe modules in isolation. `ws.subscribe.test.ts` is the one unit-level
file that also carries a database-gated test (TASK-0095): a `describe.skipIf(!reachable)` block
with the same loud-skip notice, thrown under `REQUIRE_DATABASE=1`. It asserts that a replay
which already delivered an event does not send it again when that event's `broadcast` runs
after `subscribe` returns.

## How it works

**The environment-gated pattern (loud-skip, or throw under `REQUIRE_DATABASE`).** Each
integration file resolves `TEST_DATABASE_URL || DATABASE_URL` at module load, builds a client
and probes it with `probeReachable`, and wraps its whole `describe` block in
`describe.skipIf(!reachable)`. When unreachable, it builds a multi-line notice naming the
file, which spec/user-story it would have exercised, and the exact `docker compose up -d db`
+ `TEST_DATABASE_URL=...` incantation to fix it. By default it only `console.warn`s that
notice and Vitest reports the suite `skipped`, not `failed` — deliberate, since **a silent
skip and a fake pass would both be green**, and the notice's job is to make "proved nothing"
visibly different from "proved something" in the run's output. When `REQUIRE_DATABASE=1` is
set, the same notice is `throw`n instead of warned, turning an unreachable database into a
hard failure — this is what [[ci-pipeline]] sets so CI cannot silently skip the suites it
exists to run.

**Verified counts, run without a database configured** (`unset TEST_DATABASE_URL
DATABASE_URL REQUIRE_DATABASE`, `pnpm install` + building `packages/shared` first so imports
resolve): **9 test files pass, 3 skip** (the three integration files above), out of 12 — **48
tests pass, 45 skip**, out of 93 (TASK-0095 added one gated case to `ws.subscribe.test.ts`, whose file still reports as passing because its other two tests run; TASK-0024 added `config.test.ts`'s 5 always-run cases and one `echo.test.ts` case; TASK-0028 added one `static.test.ts` case). A green run in this state proves the unit-level behavior only; every
session-auth flow, every event-log write/read, and the entire WebSocket gateway (including
[[replay-live-boundary]] and [[subscriber-registry]]) goes unverified. Anyone reading only a
pass/fail summary, not the warning text, would not notice. With a reachable database and
`REQUIRE_DATABASE=1` (as [[ci-pipeline]] runs it), all **93 tests pass, 0 skip**.
`env up` migrates first ([[runtime-stacks]]).

**`apps/server/vitest.config.ts`** (TASK-0024) sets `fileParallelism: false` for the whole
package — every suite in this note's scope included — because [[ingestion]]'s integration
suites share one real Postgres `jobs` queue across files; see that note for the full race it
closes. This only serializes file execution order, changing nothing about any individual
suite's pass/fail outcome.

The DB tests in `dm/scene.integration.test.ts`, `playtest/harness.integration.test.ts` and
`playtest/provider.integration.test.ts` set per-test timeouts of 3x the measured worst case, 30 s
floor (TASK-0154). The default stays 5 s. The load is turbo running every package at once;
`fileParallelism: false` already serialises server files.

**`test/` is now its own typechecked project reference.** `apps/server/test/tsconfig.json`
(`extends` the shared base, `noEmit: true`, `include: ["."]`, `references` `apps/server`,
`packages/shared`, `packages/dnd5e-engine` and `packages/session-model`; the server project also references `packages/intent` and, since spec 104, `packages/planner`) is an entry in root `tsconfig.json`'s `references` array,
alongside `packages/shared`, `packages/dnd5e-engine` (and its own `test` project, see
[[dnd5e-engine]]), `packages/session-model` (and its `test` project, see [[session-model]]), `packages/srd` (and its `test` project, see [[srd-data]]), `apps/server`, `apps/web`. `pnpm typecheck` (`tsc -b` at the
root) now builds this reference too, so a type error introduced only in a test fails
`typecheck` — it is no longer invisible until Vitest transpiles and runs the file. This
closes the gap TASK-0017 tracked; `apps/server/tsconfig.json` still
scopes `"include": ["src"]` (its `references` now also name the engine, session-model and srd packages), so `test/` stays out of the `src` build's own output).

## Latency gate (TASK-0300, spec 106)

`apps/server/test/intent-latency.bench-test.ts` runs in `pnpm check:timing` (the server's
`test:timing`, config `vitest.timing.config.ts`, which sets `fileParallelism: false` so the ddb
bench never overlaps it, and `reporters: ["default"]` so the stdout latency lines show in the CI log), never in `pnpm test`. It loud-skips without a database and throws
under `REQUIRE_DATABASE=1`. `BUDGET_MS = 1000` is constitution IX's p95, one constant with no
retry and no multiplier. Clock seam: `performance.now()` before `gate.handle`, stopped inside a
`gate.onAppended` listener on the batch whose `intent.recorded` row carries the sample's Intent
id (rows stored); that batch must hold `attack.resolved` or `check.resolved`, so a refusal is
never a sample. Two `createWorld` tables in turn mode: an AI-seat `attack` (Tamsin, a miss every
time) and a human-seat `check` (the DM's `ruling` that rolls the player's open check). Each kind
runs 20 discarded warm-up samples then 200 serial samples. p95 is nearest-rank via `percentile()`
in `src/bench/load/stats.ts`. Dice are scripted (1993 faces of 2 after initiative; the script
schema caps dice at 2000), and the gate asserts zero model calls. It prints one `latency <kind>`
line per kind and `latency gate: PASS`; a breach prints the five slowest samples and fails. Hit
samples and the hosted half (TASK-0278) are out of scope. `scripts/check-no-wallclock-tests.mjs`
requires wall-clock assertions to live in `*.bench-test.ts`.

## Connections

Exercises [[websocket-gateway]], [[replay-live-boundary]], [[subscriber-registry]],
[[ws-protocol]], [[session-auth]], [[event-log]], and, for `config.test.ts`, [[configuration]].
The manual, human-run counterpart that exercises the same seams end to end through the real
client is [[m0-demo]]. [[ci-pipeline]] runs this suite (and [[ingestion]]'s and
[[benchmarks]]' every-commit-tier suite) on every PR and push with `REQUIRE_DATABASE=1`; the
manual demo is still run and pasted into each PR by hand.

## Operational notes

`packages/shared` must be built (`tsc -b`) before the server's tests can resolve
`@the-stacks/shared` — a fresh `pnpm install` alone is not sufficient; Turborepo's task graph
normally handles this ordering, but a bare `vitest run` in `apps/server` does not.

## 4v4 round bench (TASK-0299, spec 107)

`apps/server/test/ai-round.bench-test.ts` also runs in `pnpm check:timing`. It loads the fixture seed
`test/dm/fixtures/greyhollow-ford-4v4.json` (one human seat, three companions, four goblins) with
the script `test/dm/scripts/ai-round-4v4.json`, and times one round through the real gate, queue and
worker: from the human's `action.commit` of a slash attack to the `table-mode.changed` row that makes
the human active in round 2. `BUDGET_MS = 60000` is constitution IX's round budget. The strict fake
gateway scripts no `dm.interpret`; the test asserts zero interpret calls, three `dm.companion`
calls and eight `dm.narrate` calls, prints one `ai-round 4v4 ms=... budget=60000ms OK` line with
the per-purpose counts and each job's duration, and fails past the budget. `createWorld({ seed })`
now also feeds that seed to the planner inputs.
