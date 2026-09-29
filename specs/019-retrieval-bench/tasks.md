# Tasks: Retrieval benchmark

**Input**: `specs/019-retrieval-bench/` (spec.md, plan.md, research.md, data-model.md,
contracts/, quickstart.md)

**Card**: TASK-0029. **Depends on**: TASK-0026 (retrieve, merged) and TASK-0024 (chunkBook,
merged).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency).
- Paths are repo-relative.

## Phase 1: Corpus and question set (AC #1)

**Purpose**: the committed, licensed data every later phase measures against.

- [ ] T001 Download `https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf` to a scratch path outside the repo. Record its sha-256. Run `pdftotext -layout` on it into the same scratch dir. Commit neither file.
- [ ] T002 Create the 8 corpus files in `apps/server/bench/retrieval/corpus/` per research R1: `using-ability-scores.md`, `adventuring.md`, `combat.md`, `spellcasting.md`, `spells.md`, `equipment.md`, `conditions.md`, `monsters.md`. Keep SRD words verbatim. Only rejoin hyphenated line breaks, drop page headers and footers, and add Markdown structure. Use only the SRD PDF as the source. Never copy from `/Volumes/evan/dnd-sourcebooks`, `fixtures/private/`, or any web mirror. Keep the directory at or under 400 KB (`du -sk`).
- [ ] T003 Create `apps/server/bench/retrieval/corpus/ATTRIBUTION.md`. Include the SRD 5.1 attribution statement verbatim, the CC-BY-4.0 legalcode URL, the source URL, the PDF sha-256 from T001, the extraction command, and the list of changes made in T002.
- [ ] T004 Create `apps/server/bench/retrieval/questions.json` per data-model.md and research R3. Write about 60 questions, about 8 per document. Mark at least half `paraphrase`, phrased without the passage's distinctive terms. Make each `quote` a 40–400 char exact excerpt of the parsed document text.
- [ ] T005 Commit Phase 1 as `TASK-0029: T001–T005 SRD 5.1 corpus and question set`. The loader validates quotes in T009; fix any quote it rejects there. Format `questions.json` and the matrices with `pnpm format`, because Biome lints JSON under `apps/server/bench/`.

**Checkpoint**: licensed corpus, attribution, and questions are committed. No code yet.

## Phase 2: Foundational — load, score, embed helpers (pure)

**Purpose**: the pure modules every run needs. No database.

- [ ] T006 [P] Create `apps/server/src/bench/retrieval/load.ts`: `MatrixSchema` and `QuestionSetSchema` (data-model.md), `loadMatrix`, `loadCorpus` (each `.md` except `ATTRIBUTION.md`, `parseMarkdown` with book = file stem, `corpusHash`), and `loadQuestions` (resolve each quote with `indexOf` on the parsed text; zero or 2+ matches throws naming the id; unique ids; ≥ half paraphrase; `questionsHash`). Add `matrixHash` over canonical sorted-key JSON.
- [ ] T007 [P] Create `apps/server/src/bench/retrieval/score.ts`: `scoreQuestion` (research R4 half-overlap rule) and `summarize` (recall@1/5/10, MRR@10).
- [ ] T008 [P] Create `apps/server/src/bench/retrieval/embed.ts`: `bowEmbed` (research R8: lowercase, split on non-letters, small stop list, strip trailing `s`, FNV-1a into 1024 buckets with hash sign, L2-normalize); `truncateVector` (research R5); a `bow` `Provider` built on `bowEmbed`; and `withDim(gateway, dim)`, which truncates every returned vector and rewrites its `model` to `<model>@<dim>`. At 1024 it rewrites the name to `<model>@1024` too, so rows at every dim use one naming rule.
- [ ] T009 Create `apps/server/test/bench/retrieval.test.ts`. Cover contract invariants 1–4. Add loader cases: the committed questions load against the committed corpus; a missing quote and a duplicated quote each throw naming the id; a matrix dim of 1025 is rejected. Run it and fix any T004 quote it rejects.

**Checkpoint**: `pnpm --filter @the-stacks/server test` is green without a database.

## Phase 3: User Story 1 — run a matrix and print a comparable table (P1, AC #2, #3)

- [ ] T010 [US1] Create `apps/server/src/bench/retrieval/db.ts`: `resolveBenchUrl` (research R7; `BENCH_DATABASE_URL`, else `TEST_DATABASE_URL || DATABASE_URL` with the database name suffixed `_bench`; throw when equal to the base URL); `ensureBenchDb` (connect to the base URL, `CREATE DATABASE` when absent, quoting the identifier); `migrateBenchDb` (drizzle migrator, `migrationsFolder` resolved from `import.meta.url`); `resetLibrary` (`DELETE FROM library_documents`).
- [ ] T011 [US1] Create `apps/server/src/bench/retrieval/run.ts`: `estimate` (research R10) and `runMatrix` (contracts/bench-cli.md `run` steps 6–7). Build one gateway per run with `createGateway({ config, sink: memorySink(), adapters: { fake: () => bowProvider } })` when a `builtin: "bow"` model is listed. Under the `bow` model, add a synthetic provider `builtin` of kind `fake` and a purpose `bench-bow`. Embed chunks in batches of 256 through `withDim`. Split usage records into corpus and question phases. Run `fts` once per strategy. Time each `retrieve` call with `performance.now()` and report p50/p95. Record each row's misses.
- [ ] T012 [US1] Create `apps/server/src/bench/retrieval/cli.ts` and `index.ts` per contracts/bench-cli.md, with `node:util` `parseArgs`. Implement exit codes 0/1/2, the `--dry-run` path, and the paid-run refusal before any database connection. Print the table format in the contract.
- [ ] T013 [US1] Add `"bench:retrieval": "tsc -b && node --env-file-if-exists=../../.env dist/bench/retrieval/cli.js"` to `apps/server/package.json`. Add root `"bench:retrieval": "pnpm --filter @the-stacks/server bench:retrieval"`.
- [ ] T014 [US1] Create `apps/server/bench/retrieval/matrices/ci.json`: model `bow` (`builtin`) at dims `[1024, 256]`, chunking `block` (0) and `c2000` (2000), modes `vector`, `fts`, `hybrid`. Create `matrices/full.example.json` with two placeholder purposes (`embed-a`, `embed-b`) at `[1024, 512, 256]`, chunking `block`, `c1000`, `c2000`, `c4000`, and all three modes.
- [ ] T015 [US1] Extend `apps/server/test/bench/retrieval.test.ts` with invariants 5 and 9: a stub purpose of kind `openai-compatible` without `--allow-paid` exits 2 and opens no connection. Spy on `ensureBenchDb`, or run the CLI with an unreachable URL and assert no connection error surfaces.

**Checkpoint**: `pnpm bench:retrieval run --matrix matrices/ci.json --no-save` prints 10 rows on the worktree stack.

## Phase 4: User Story 3 — store results and compare over time (P2, AC #4)

- [ ] T016 [US3] Create `apps/server/src/bench/retrieval/results.ts`: `ResultsSchema` (contracts/results-format.md); `writeResults` (commit from `git rev-parse HEAD`, dirty from `git status --porcelain`, both through `node:child_process` `execFileSync`; file name `<date>-<sha7>-<runId8>.json`; two-space JSON plus a trailing newline); `report` (validate, group by `corpusHash`, sort, print; skip and warn on an invalid file or an unknown version).
- [ ] T017 [US3] Wire `run` (save unless `--no-save`) and `report` into `cli.ts`. Add `apps/server/bench/retrieval/results/.gitkeep`.
- [ ] T018 [US3] Add invariant 8 to `apps/server/test/bench/retrieval.test.ts`: write a results file to a tmp dir from fabricated rows, and assert no question text or quote appears in it. Add a `report` case over two fabricated files with different corpus hashes, which must print two groups.
- [ ] T019 [US3] Run the CI matrix once on the worktree stack. Commit the resulting file under `results/` as the first stored run.

## Phase 5: User Story 2 — per-commit recall regression gate (P1, AC #5)

- [ ] T020 [US2] Create `apps/server/test/bench/retrieval.integration.test.ts`. Use the loud-skip harness copied from `retrieve.integration.test.ts` and probe the base URL. Load `matrices/ci.json`, the corpus, and the questions. Call `ensureBenchDb` and `migrateBenchDb`, then `runMatrix`. Assert: the hashes equal `baseline.json`'s (on a mismatch, fail with "corpus/questions/matrix changed; run --write-baseline"); every cell's recall@5 ≥ `baseline − 1/N` (on failure, name the cell, the baseline, and the measured value); invariant 6 (`jobs` in the bench database has 0 rows); invariant 7 (fts rows have null embed fields, and the usage sink recorded no fts-phase embed). Print a notice when any cell beats its baseline. Give the case a 120 s timeout.
- [ ] T021 [US2] Implement `--write-baseline` in `cli.ts` (bow-only matrices). Generate `apps/server/bench/retrieval/baseline.json` from the CI matrix and commit it.
- [ ] T022 [US2] Prove the gate by hand. Raise one baseline value by 0.1 in a scratch edit, run the case, and record the failure text. Revert the edit. Record both outcomes in the PR body.

**Checkpoint**: the gate fails on a real drop and passes on the committed baseline.

## Phase 6: Polish, re-grounding, and gates

- [ ] T023 Merge `origin/main` into the branch (never rebase). Re-run the Phase 5 case if `retrieve.ts`, `chunk.ts`, `markdown.ts`, or migrations changed.
- [ ] T024 Run `REQUIRE_DATABASE=1 pnpm ci:check` on this worktree's stack (`pnpm env:up`; `TEST_DATABASE_URL` from `.env`). It must be green with 0 DB suites skipped. Record the counts for the PR body. No CI workflow change is planned: the per-commit case runs inside `pnpm test`. If the runner's time budget (15 min) or its database role blocks `CREATE DATABASE`, stop and report; do not edit `.github/workflows/ci.yml` without that report.
- [ ] T025 Verify content hygiene (runbook TASK-0029 line). `git diff origin/main --stat -- apps/server/bench` lists only corpus, attribution, questions, matrices, baseline, and results. Nothing under `fixtures/private/` is tracked. `du -sk apps/server/bench/retrieval/corpus` ≤ 400.
- [ ] T026 Paid run: **OPERATOR CHECKPOINT**. Do not run it without sign-off. Report the provider and model list and the `--dry-run` estimate for `full.example.json` filled with the operator's purposes. If the operator approves and supplies config, run it and commit the results file. Otherwise record "paid run deferred by operator" in the PR body. The PR does not wait on it.
- [ ] T027 Wiki review with honest re-pins (`/grounding-wiki:wiki-update`). Classify each pinned note RE-PIN-ONLY or NEEDS-REVIEW against the diff. Expected: `test-suite` (new bench suites), `ci-pipeline` (review: `ci:check` now runs the recall gate inside `pnpm test`; state it in prose), `retrieval` (first real caller of `retrieve`; the RRF/CANDIDATES `ponytail:` now has a bench to measure with), `ingestion` (the chunker `ponytail:` now has a bench), `library-schema` (the bench is a second caller of `storeParsedBook`/`attachEmbeddings`), `monorepo-and-toolchain` if root `package.json` is pinned. Write a new note, `docs/wiki/benchmarks.md` (kind: pipeline). Cover the corpus and attribution, the question set, span-overlap scoring, the matrix axes, dimension by truncation, the `_bench` database isolation, the results format, the CI gate and its baseline, and the paid-run checkpoint. List its sources and pin it. Add it to `INDEX.md` under Testing and verification.
- [ ] T028 Regenerate `docs/wiki/CAPSULES.md`, because notes were added and descriptions changed.
- [ ] T029 Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.65.3/gates/cli.mjs freshness . docs/wiki`. It must print `OK`. Never run `gates/freshness.mjs`.
- [ ] T030 Run `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.65.3/gates/cli.mjs check .`. It must exit 0. Tick this file's completed tasks.
- [ ] T031 Run `pnpm env:down`, then `pnpm env:prune --check`. The prune check must exit 0.

## Dependencies & Execution Order

- Phase 1 blocks Phase 2's loader test (T009) and everything after.
- Phase 2 T006–T008 run in parallel; T009 needs all three.
- Phase 3 needs Phase 2. Phase 4 needs Phase 3's `runMatrix` and CLI.
- Phase 5 needs Phase 3; T021 needs T017's CLI wiring only for the save path.
- Phase 6 needs all of the above.
- Dispatch: one implementer per phase at the sonnet tier (runbook). Phase 1 is authoring work
  on licensed text. Keep it in its own dispatch, and have its PR body state the source.

## Implementation Strategy

MVP = Phases 1–3 plus Phase 5: the committed corpus, one command that prints the comparable
table, and the per-commit gate. Phase 4 adds stored, comparable runs. Phase 6 re-grounds the
wiki and runs the gates. No new runtime dependency, no migration, no CI workflow change.
