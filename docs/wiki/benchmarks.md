---
name: benchmarks
description: The retrieval benchmark (specs/019-retrieval-bench, TASK-0029) — the licensed SRD corpus and its attribution, the question set, the model/dim/chunking/mode matrix, span-overlap scoring, the isolated `_bench` Postgres database, stored results and the report, and the deterministic per-commit recall gate that runs inside `pnpm test`. Load for any "how does the retrieval bench work" or "why did the recall gate fail" question.
kind: pipeline
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
  - apps/server/package.json
  - specs/019-retrieval-bench/contracts/bench-cli.md
  - specs/019-retrieval-bench/contracts/results-format.md
verified_against: 7d770d30026123ce10bd9c0fd693a8328de72803
---

# Benchmarks

The retrieval benchmark (specs/019-retrieval-bench, TASK-0029) is [[retrieval]]'s first real
caller: it ingests a fixed corpus, asks it a fixed set of questions through `retrieve()`, and
scores where the right passage landed in the ranking — across a matrix of embedding models,
vector dimensions, chunking strategies, and search modes. `pnpm bench:retrieval run --matrix
<path>` (root) or `pnpm bench:retrieval` inside `apps/server` runs it; `report` prints every
stored run. It never touches the app's own database.

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

_(placeholder — TASK-0030)_

## Connections

Calls [[retrieval]]'s `retrieve()` as its only read path and [[library-schema]]'s
`storeParsedBook`/`attachEmbeddings` as its only write path; embeds real matrices through
[[ai-gateway]]. [[ci-pipeline]] runs the per-commit gate as part of `pnpm test` under
`REQUIRE_DATABASE=1`, alongside every other integration suite ([[test-suite]]). The corpus is
parsed with [[ingestion]]'s own `parseMarkdown`/`chunkBook`, so a chunker change is measured
here before it reaches production ingestion.

## Operational notes

`pnpm bench:retrieval` (root, delegates to `apps/server`'s `tsc -b && node dist/bench/retrieval/
cli.js`) requires a built `dist/`; the CI/integration-test path instead imports the `src/`
module directly. `du -sk apps/server/bench/retrieval/corpus` must stay ≤400 (currently ~200) —
the corpus is a benchmark fixture, not a general-purpose library seed, and nothing under a
`fixtures/private/` path is ever tracked. A paid matrix run is an **operator checkpoint**: it is
never run without sign-off on the provider/model list and the `--dry-run` estimate.
