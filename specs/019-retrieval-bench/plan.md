# Implementation Plan: Retrieval benchmark

**Branch**: `task-0029-retrieval-bench` | **Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/019-retrieval-bench/spec.md`

## Summary

Commit an SRD 5.1 Markdown corpus (8 documents, ≤ 400 KB) with its CC-BY-4.0 attribution, and a
question set of ≥ 60 questions whose expected passages are exact quotes. Add a bench module and
CLI under `apps/server/src/bench/retrieval/` that runs a matrix of embedding model × dimension ×
chunking strategy (`chunkBook` `maxChars`) × retrieval mode (`retrieve`) in a dedicated
`_bench` database, stores chunks with `storeParsedBook`/`attachEmbeddings` (never ingestion
jobs), scores hits by span overlap, and prints recall@1/5/10, MRR@10, latency, and embed cost.
Each run writes one tracked JSON results file with config, commit, and hashes. A vitest
integration case runs a 10-cell matrix with a deterministic bag-of-words embedding on every
commit and fails when recall@5 drops more than one question below a committed baseline.
Dimension varies by truncation below 1024; no schema change, no migration, no new dependency,
no CI workflow change.

## Technical Context

**Language/Version**: TypeScript 5.9 on Node 22 (existing server package)

**Primary Dependencies**: `drizzle-orm` (migrator, `sql`), `pg`, `zod`, `node:util` `parseArgs`,
`node:crypto` — all installed. **No new runtime dependency.** `pdftotext` is used once at
authoring time to extract SRD text; it is not a project dependency.

**Storage**: Postgres 17 + pgvector, same image. A second database `<name>_bench` on the same
server, created by the bench and migrated with the existing migrations (research R7). Results
are JSON files in git (research R9).

**Testing**: vitest. Pure units (scoring, `bowEmbed`, truncation, URL resolution, matrix and
question loading) need no DB. The per-commit case is an integration test with the loud-skip
harness; `REQUIRE_DATABASE=1` turns a skip into a failure.

**Target Platform**: developer machine and GitHub Actions `ubuntu-latest` with the pgvector
service container.

**Project Type**: server package tooling (CLI + test); no route, no client change.

**Performance Goals**: CI matrix < 60 s (SC-001). Corpus ≈ 250 KB → a few hundred chunks per
strategy.

**Constraints**: vector dim 1024 (decision-0002); every model call through the gateway
(decision-0007, constitution IX); SRD text only (decision-0003, constitution VIII); paid runs
only on demand with a flag and an operator checkpoint.

**Scale/Scope**: 8 documents, ≥ 60 questions, matrices up to ~50 cells.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Agent-operable** — agents drive the bench through `pnpm bench:retrieval` and the
      exported `runMatrix`/`loadMatrix` functions (contracts/bench-cli.md), the same path CI
      and the operator use.
- [x] **II. Content contract** — not applicable: no codex entity.
- [x] **III. Data planes** — the bench reads and writes library-plane tables only, through the
      library's own `storeParsedBook`/`attachEmbeddings`/`retrieve`, in a separate database. No
      codex or session import. `src/bench/` sits outside the plane zones, like tests.
- [x] **IV. Event sourcing** — not applicable: no play state.
- [x] **V. Citations** — this task *is* the fixture-based retrieval eval the principle demands:
      scoring is on stored anchors, and a recall regression fails `pnpm test` in CI.
- [x] **VI. System-agnostic** — the harness takes any Markdown corpus and question file; SRD is
      data, not code.
- [x] **VII. Structured first** — not applicable: nothing generated. Results are Zod-validated
      JSON.
- [x] **VIII. Operator-owned content** — committed corpus is SRD 5.1 CC-BY-4.0 text with
      `ATTRIBUTION.md`; nothing from operator exports or `fixtures/private/`; results files
      carry ids and numbers only (contract invariant 8).
- [x] **IX. Self-hostable** — no new container or service; embeddings go through the gateway
      seam; the default CI case needs no key or network.

**Stack conformance** — TypeScript, Postgres, Drizzle, Zod only. No departure.

**Post-design re-check (after Phase 1)**: all nine hold. The second database is a database on
the existing server, not a new datastore.

## Project Structure

### Documentation (this feature)

```text
specs/019-retrieval-bench/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── bench-cli.md
│   └── results-format.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/server/
├── bench/retrieval/                 # data (tracked; biome ignores *.md, lints *.json)
│   ├── corpus/*.md                  # 8 SRD 5.1 documents
│   ├── corpus/ATTRIBUTION.md
│   ├── questions.json
│   ├── matrices/ci.json             # per-commit 10-cell matrix
│   ├── matrices/full.example.json   # on-demand template (purposes named by operator)
│   ├── baseline.json
│   └── results/.gitkeep
├── src/bench/retrieval/
│   ├── index.ts                     # public API (contracts/bench-cli.md)
│   ├── load.ts                      # matrix, corpus, questions (Zod + quote resolution)
│   ├── score.ts                     # scoreQuestion, summarize
│   ├── embed.ts                     # bowEmbed, truncateVector, dim-wrapping gateway, bow adapter
│   ├── db.ts                        # resolveBenchUrl, ensure database, migrate, reset
│   ├── run.ts                       # runMatrix, estimate
│   ├── results.ts                   # ResultsSchema, write, report table
│   └── cli.ts                       # parseArgs → run | report
├── test/bench/
│   ├── retrieval.test.ts            # pure units (invariants 1–5, 8, 9)
│   └── retrieval.integration.test.ts  # per-commit case + invariants 6, 7
└── package.json                     # + "bench:retrieval" script
package.json                         # + "bench:retrieval" pass-through
```

`apps/server/tsconfig.json` already includes `src/**`, so the bench compiles with the build.
`migrationsFolder` resolves from the module's own URL (`../../../drizzle`), not the cwd.

## Operator checkpoints

1. **Paid run** (research R10): before the first non-fake run, stop and report the provider
   list, model list, dims, strategies, and the printed `--dry-run` estimate. The operator
   supplies config and keys.
2. **Dimension beyond truncation** (research R5): benchmarking a model that cannot return 1024
   dims needs a gateway change. Not in scope; card it if the operator wants such a model.

No new runtime dependency. No migration. No CI workflow change: the per-commit case rides
`pnpm test` inside `ci:check`, so the `ci-pipeline` note is reviewed but likely re-pin only.

## Complexity Tracking

None.
