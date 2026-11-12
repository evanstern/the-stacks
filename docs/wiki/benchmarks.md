---
name: benchmarks
description: Two independent benches. Retrieval (specs/019-retrieval-bench, TASK-0029) — SRD corpus, question set, model/dim/chunking/mode matrix, span-overlap scoring, `_bench` database, per-commit recall gate. Load and stress (specs/021-load-bench, TASK-0030) — tiers, visible skips, `_load` database, synthetic content, decision-0005's ingest-scaling measurement, concurrency, stress cases, dev tier's read-only design. Load for "how does a bench work" or "why a bench gate failed".
kind: pipeline
size_budget_exempt: two independent benches (TASK-0029 retrieval, TASK-0030 load/stress) share one note by explicit orchestrator instruction (no new note); each bench's own section is independently well under budget.
sources:
  - apps/server/bench/retrieval/corpus/ATTRIBUTION.md
  - apps/server/bench/retrieval/questions.json
  - apps/server/bench/retrieval/baseline.json
  - apps/server/bench/retrieval/matrices/ci.json
  - apps/server/bench/retrieval/matrices/local.json
  - apps/server/bench/retrieval/matrices/full.example.json
  - apps/server/src/bench/retrieval/index.ts
  - apps/server/src/bench/retrieval/load.ts
  - apps/server/src/bench/retrieval/score.ts
  - apps/server/src/bench/retrieval/embed.ts
  - apps/server/src/bench/retrieval/db.ts
  - apps/server/src/bench/retrieval/run.ts
  - apps/server/src/bench/retrieval/results.ts
  - apps/server/src/bench/retrieval/cli.ts
  - apps/server/test/bench/retrieval.test.ts
  - apps/server/test/bench/retrieval.integration.test.ts
  - specs/019-retrieval-bench/contracts/bench-cli.md
  - specs/019-retrieval-bench/contracts/results-format.md
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
  - specs/021-load-bench/contracts/results-format.md
verified_against: 17849584ad75728e4df27bee4a34d3e35cb86229
---

# Benchmarks

The retrieval benchmark (specs/019-retrieval-bench, TASK-0029) is [[retrieval]]'s first real
caller: it ingests a fixed corpus, asks it a fixed set of questions through `retrieve()`, and
scores where the right passage landed in the ranking — across a matrix of embedding models,
vector dimensions, chunking strategies, and search modes. `pnpm bench:retrieval run --matrix
<path>` (root) or `pnpm bench:retrieval` inside `apps/server` runs it; `report` prints every
stored run. It never touches the app's own database. The load and stress bench
(specs/021-load-bench, TASK-0030) is a separate case registry, run either through Vitest
(every commit) or its own standalone CLI (`pnpm bench:load`, on demand, or against the real
hosted `dev` environment under an operator checkpoint).

## How it works

**Corpus and attribution.** `apps/server/bench/retrieval/corpus/` holds 8 Markdown files (200
KiB total) extracted once from Wizards of the Coast's SRD 5.1 PDF, licensed CC-BY-4.0.
`corpus/ATTRIBUTION.md` (`loadCorpus` skips it by name — prose, not a question document)
records the source URL, its SHA-256, the extraction command (`pdftotext -raw SRD_CC_v5.1.pdf
...`), and the required "changes" disclosure: `-raw` is the only poppler mode that reads this
PDF's two-column pages (spell/monster stat blocks) in correct, non-interleaved order. Edits
are limited to rejoining page-layout line breaks, stripping headers/page numbers, and adding
Markdown structure; no wording changed, and the three largest sections carry only a
representative subset, to hold the corpus to budget.

**Question set.** `questions.json` (64 questions, min 50 enforced by `QuestionSetSchema`) each
name a target document and an exact quote; `loadQuestions` resolves each quote to a `{start,
end}` span in the parsed book's text and throws if it's missing or ambiguous (occurs more than
once). At least half must be `style: "paraphrase"` rather than `"lexical"` (53 of 64) — `bow`
scores lexical overlap almost trivially, so paraphrase questions are what stresses semantic
retrieval.

**Matrix axes** (`MatrixSchema`, one JSON file per run — `matrices/ci.json`, `local.json`, and
`full.example.json` as a template). A matrix names: **models**, each either `{ builtin: "bow" }`
(the bench's own free, deterministic embedding) or `{ purpose: "<name>" }` (a real
[[ai-gateway]] embed purpose); **dims** per model (each ≤1024); **chunking** strategies (a name
plus [[ingestion]]'s `maxChars`, `0` meaning one chunk per structural block); and **modes**
(`vector`/`fts`/`hybrid`). Every combination is one scored cell, keyed
`"<model>@<dim>|<chunking>|<mode>"`.

**Dimension by truncation.** A model's vectors are always produced at their native size, then
`truncateVector` keeps the first `dim` components, L2-renormalizes them, and zero-pads back to
1024 — so every dim (including the native 1024) shares one naming rule: `withDim` wraps the
gateway's `embed()` to both truncate and suffix the model name `@<dim>`. `dimMethod` in each
result row is `"native"` at 1024, `"truncate"` otherwise.

**The `_bench` database.** `resolveBenchUrl` takes `BENCH_DATABASE_URL` if set, otherwise the
same base URL `db:migrate` resolves (`TEST_DATABASE_URL || DATABASE_URL`) with its database name
suffixed `_bench`, and refuses to run if that still equals the base URL — the bench must never
run against the app's or the test suite's own database. `ensureBenchDb`/`migrateBenchDb` create
and migrate it on demand with drizzle's committed migrations; `resetLibrary` (a bare `DELETE
FROM library_documents`, cascading to chunks/embeddings) wipes it between chunking strategies.
Every cell stores and embeds directly through [[library-schema]]'s `storeParsedBook`/
`attachEmbeddings` — the bench is a second caller of both, alongside [[ingestion]] — and never
enqueues a `jobs` row.

**Running a matrix** (`runMatrix`, model-outer / chunking-inner / dim-inner, operator ruling
2026-09-29): every cell for one model runs back to back, so a real (Ollama-hosted) model is
warmed up once and never evicted mid-run by another model's cells landing in between. Before a
non-bow model's first cell, `warmUpModel` posts straight to Ollama's own `/api/embed` (not
through the gateway) with `keep_alive: -1`, pinning the model in memory for every cell that
follows; `bow` needs no warm-up. Each cell embeds the corpus in batches of 256, then runs every
question through `retrieve()` at `k=10`, scoring with `scoreQuestion` (span-overlap, research
R4): a passage hits when its book matches a target and the two spans overlap by at least half
the target's length; the first hit's rank is the question's rank, `null` if none of the top-10
hit. `summarize` turns a set of ranks into recall@1/5/10 and MRR@10. `fts` cells need no
embedding model and run once per chunking strategy, independent of the model loop.

**Results format** (`schemaVersion: 1`, `contracts/results-format.md`). `writeResults` reads
`commit`/`dirty` straight from git (never a passed-in value) and writes one JSON file per run
under `bench/retrieval/results/<date>-<sha7>-<runId8>.json`. No corpus, passage, or question
text is ever written to a results or baseline file — only hashes, counts, ranks, and timings
(constitution VIII). `report` reads every stored file, groups rows by `corpusHash` so runs over
different corpora are never compared, and skips an invalid or unversioned file with a warning.

**The per-commit gate is now deterministic.** `apps/server/test/bench/retrieval.integration.test.ts`
runs `matrices/ci.json` — `bow` only, two dims, two chunking strategies, all three modes, no
network — against a real `_bench` Postgres and compares every cell's `recall5` to
`baseline.json`'s committed floor, failing if a cell drops more than one question's worth of
recall (`1 / questionCount`) below it. This is safe to gate on because `bow`'s hash-based
embedding is a pure function of the token stream and [[retrieval]]'s tie-break (operator ruling
2026-09-29) orders ties by content — book, then anchor start, chunk id last — not by
`library_chunks.id`, a random UUID regenerated on every ingest. Before that fix the same
corpus, re-ingested, could re-order tied results and flip a cell's recall with no code change;
the gate would have been comparing noise to a fixed baseline. It follows the same
loud-skip-or-throw pattern as every other integration suite ([[test-suite]]), and a
`matrixHash`/`corpusHash`/`questionsHash` mismatch against the baseline fails fast, naming
`--write-baseline` as the fix, rather than silently comparing incomparable runs.

**Local real-model runs.** `matrices/local.json` targets two local Ollama embed purposes
(`bge-m3` at 1024 dims, `nomic-embed-text` at 768) across four chunking strategies — real
network calls, gated behind `--allow-paid` (any model with a non-`fake` provider needs it),
never run in CI. `full.example.json` is an unfilled template for a wider, multi-provider paid
matrix; `run --dry-run` prints `estimate()`'s token/cost projection first, so a paid run is
sized before it is approved.

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
its host isn't loopback: a local case can never reach a shared server. `recreateLoadDb`
connects to the *base* URL to `DROP`/`CREATE` the load database (a database can't drop
itself), first refusing if `pg_stat_activity` shows any existing connection to it — no two
local cases, or two runs, can stomp each other. `dropLoadDb` is best-effort CLI cleanup.

**Synthetic content** (`synth.ts`, research R2). `synthDoc(seed, bytes)` is a small seedable
PRNG (`mulberry32` — no dependency) emitting deterministic Markdown from a fixed list of ~200
plain English words original to this file — no SRD, book text, or fixture content anywhere
near it (constitution VIII). Same `seed` and `bytes` always produce byte-identical output,
within 5% of the requested size.

**Ingest scaling — the decision-0005 measurement** (`ingest.ts`, `ingest-scaling`). Forks real
worker processes and measures wall time, throughput, queue-wait and service percentiles across
a profile's `volumes` × `workers` matrix, via `ingestVerdict`'s ratio-plus-floor rules to find
the degradation knee. Run for real on local Postgres: **1 worker sustains 1.75 jobs/s** (volume
100 in 57.2s), degrading between **100 and 250** queued jobs; **2 workers sustain 3.25 jobs/s**
— roughly double — degrading between **250 and 500**. A recorded measurement of real
local-Postgres throughput, not a capacity decision; see [[ingestion]] for what it implies about
the `jobs` queue's claim/lease/recovery path, and for the `restart-mid-ingest` finding below.

**Concurrency** (`concurrency.ts`, research R8/R9). Simulated users (`users.ts`'s `runUsers`)
each hold one HTTP+WebSocket session and loop HTTP requests plus optional WS traffic for a
fixed duration; `concurrency-smoke` (commit tier) runs 3 users in-process on port 0;
`concurrency-local` (demand tier) runs the profile's user counts against the real built app on
the load database; `concurrencyVerdict` finds the first user count where latency or error-rate
thresholds fire. Sessions come from `db.ts`'s `seedUsers` — one scrypt hash computed once and
reused for every seeded user, so sign-in cost never dominates a step's latency (research R9).
The optional WebSocket send is a `talk` gate request (out of character, no character) with a
fresh `randomUUID` nonce in its text (TASK-0099, which retired the uncatalogued `send` the bench
used before). The round trip is matched to its own `event` frame by that text; an `error` frame
ends the wait early and counts as `ws_refused`; no reply in 5 s counts as `timeout`.
`concurrency-smoke` wires `gate.onAppended(publish)` so the gate's rows reach subscribers.

**Both stress cases** (`stress.ts`, research R6/R7). `db-exhaustion` opens raw `pg` clients
against the load database until Postgres refuses new connections, then probes the running app:
`/health` degrading, `/auth/me` bounding its response, a WebSocket upgrade refused `503` not
`401`, and the process staying alive — each probe round fires 8 concurrent attempts (`BURST`)
rather than one, since the app's own pool always keeps one connection warm, so a single
sequential probe never observes the outage. Held connections are released in a `finally`, then
recovery is measured. `restart-mid-ingest` forks a worker, holds it mid-`embed`, `SIGKILL`s it,
forks a normal worker, and measures lease-reclaim: the target job (enqueued first, so it's the
oldest queued row) is always the one reclaimed — `claimJob`'s `ORDER BY created_at` verified
empirically — succeeding on its second attempt with followers unaffected and no duplicate
document stored (see [[ingestion]]).

**Results and report** (`results.ts`, contracts/results-format.md). Every run writes
`apps/server/bench/load/results/<date>-<sha7>-<runId8>.json` (schemaVersion 1): git
commit/dirty state, host facts, the tier, target provenance, the profile and its hash, and
every case's outcome — run or skipped, with reason. `pnpm bench:load report` groups results by
`(case id, target)` so local and dev runs for the same case never mix into one trend line.

**The dev-tier safety design** (`concurrency.ts`'s `runConcurrencyDev`, research R11).
Read-only end to end, gated hard: the CLI refuses (exit 2) without `--allow-dev`, checked
before any network call; `LOAD_DEV_URL` unset skips `concurrency-dev` cleanly (exit 0). A real
run does exactly one sign-in — one session — runs with `wsSend` forced `false`
(`ProfileSchema` also rejects `wsSend: true`, >25 users, or >180s total for a `dev` profile),
and signs that session out in a `finally` regardless of outcome, verifying it with a follow-up
`/auth/me` expecting `401`. A failed sign-out itself fails the case rather than silently
leaving a live session. No results file the dev tier writes ever carries the dev URL, host,
username, password, or session cookie — enforced by a dedicated unit test (invariant 9).

First real dev run (2026-09-30, `results/2026-09-30-3e58d52-6fbc6eae.json`): 0 errors at
1/5/10/25 users, http p95 21-28 ms, WebSocket connect p95 58-150 ms, verdict no degradation up
to 25 users; the session ended and `dev` held no sessions, events, or jobs afterwards. It ran
as the operator account TASK-0036 made creatable (see [[operator-provisioning]]).

## Connections

Calls [[retrieval]]'s `retrieve()` as its only read path and [[library-schema]]'s
`storeParsedBook`/`attachEmbeddings` as its only write path; embeds real matrices through
[[ai-gateway]]. [[ci-pipeline]] runs both benches' per-commit gates as part of `pnpm test`
under `REQUIRE_DATABASE=1`, alongside every other integration suite ([[test-suite]]). The
retrieval corpus is parsed with [[ingestion]]'s own `parseMarkdown`/`chunkBook`; the load
bench's `ingest-scaling`/`restart-mid-ingest` exercise [[ingestion]]'s `jobs` queue directly,
forking the same worker entry point it starts in production, and its concurrency cases
exercise [[websocket-gateway]] and [[session-auth]] through a real running app.
`concurrency-dev` is the only case that ever touches [[hosted-dev]]'s real deployed target,
and only under an operator-approved run (T026). Both benches' root scripts are covered by
[[monorepo-and-toolchain]].

## Operational notes

`pnpm bench:retrieval` (root, delegates to `apps/server`'s `tsc -b && node dist/bench/retrieval/
cli.js`) requires a built `dist/`; the CI/integration-test path instead imports the `src/`
module directly. `du -sk apps/server/bench/retrieval/corpus` must stay ≤400 (currently ~200) —
the corpus is a benchmark fixture, not a general-purpose library seed, and nothing under a
`fixtures/private/` path is ever tracked. A paid matrix run is an **operator checkpoint**: it
is never run without sign-off on the provider/model list and the `--dry-run` estimate.

The `pnpm playtest` CLI ([[playtest-harness]]) copies this pattern (root script delegating to the server's `tsc -b && node dist/...`, its own `_playtest` database, a cost guard before any paid run) but is not a bench: it has no baseline or tier.

`pnpm bench:load list` prints all 7 load-bench cases with their tier and target. A `--tier
demand` run takes roughly 10-15 minutes and drops its load database afterward (best-effort); a
`--tier commit` run finishes in seconds. Case tables and `VERDICT`/`PASS`/`FAIL`/`SKIP` lines
print as each case finishes, so a long `demand` run's progress is visible live.
