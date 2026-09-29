# Contract: retrieval bench CLI and module

Code: `apps/server/src/bench/retrieval/`. Data: `apps/server/bench/retrieval/`.
Entry: root `pnpm bench:retrieval <subcommand>` → server script
`bench:retrieval` → `node --env-file-if-exists=../../.env dist/bench/retrieval/cli.js`.
The script builds first (`tsc -b`), so it never runs stale code.

## Subcommands

```
pnpm bench:retrieval run --matrix <path> [--dry-run] [--allow-paid] [--write-baseline] [--no-save]
pnpm bench:retrieval report [--dir <path>]
```

A relative `--matrix` resolves against `apps/server/bench/retrieval/` first, then the cwd.

### `run`

1. Load and validate the matrix (Zod, data-model.md). A dim above 1024, an unknown purpose, or a
   purpose whose `op` is not `embed` exits 1 and names it. No database or provider call yet.
2. Load the corpus and questions. A quote with zero or 2+ matches exits 1 and names the id.
3. Compute and print the estimate (research R10).
4. `--dry-run`: exit 0 here.
5. Any non-`fake` provider without `--allow-paid`: print "paid run refused; re-run with
   --allow-paid after operator sign-off" and exit 2.
6. Resolve the bench URL (research R7). Equal to the base URL → exit 1. Create the database when
   absent; apply migrations.
7. For each chunking strategy: delete all bench documents; `chunkBook` each parsed document
   with `maxChars`; `storeParsedBook` each. For each (model, dim): embed every chunk through the
   (wrapped) gateway in batches of 256; `attachEmbeddings`. For each mode: `retrieve` every
   question with `{ mode, k: 10 }`, timing each call with `performance.now()`.
8. Print the table. Unless `--no-save`, write the results file (contracts/results-format.md)
   and print its path.
9. `--write-baseline`: allowed only when every model is `builtin: "bow"`; writes
   `baseline.json` from the run's recall@5.

Exit codes: 0 ok, 1 invalid input or runtime error, 2 paid run refused.

### `report`

Reads every `*.json` in the results directory, validates each against the results schema
(invalid → warn and skip, naming the file), and prints one table per `corpusHash`, rows sorted
by `startedAt` then cell key. Columns: date, sha7, dirty, cell key, R@1, R@5, R@10, MRR, p50,
p95, corpus tokens, cost.

## Table format (stdout)

Fixed-width text, one row per cell, recall and MRR to three decimals, latency to one decimal,
cost as `$0.0000` or `unpriced`, `-` where not applicable (fts embed columns).

## Module API (agent-operable, constitution I)

```ts
// apps/server/src/bench/retrieval/index.ts
export function loadMatrix(path: string): Matrix;
export function loadCorpus(dir: string): { books: ParsedBook[]; hash: string };
export function loadQuestions(path: string, books: ParsedBook[]): { questions: ResolvedQuestion[]; hash: string };
export function scoreQuestion(q: ResolvedQuestion, passages: RetrievedPassage[]): { rank: number | null };  // 1-based first hit, null = miss
export function summarize(ranks: (number | null)[]): { recall1: number; recall5: number; recall10: number; mrr10: number };
export function estimate(matrix: Matrix, corpus: ParsedBook[], questions: number, ai: AiConfig): Estimate;
export function runMatrix(deps: { db: DbClient; ai: AiConfig; env: NodeJS.ProcessEnv }, input: {
  matrix: Matrix; books: ParsedBook[]; questions: ResolvedQuestion[];
}): Promise<BenchRow[]>;
export function bowEmbed(text: string): number[];            // research R8, length 1024, unit norm
export function truncateVector(v: number[], dim: number): number[];  // first dim, L2-renorm, zero-pad to 1024
export function resolveBenchUrl(env: NodeJS.ProcessEnv): { baseUrl: string; benchUrl: string };
```

## Invariants (each has a test)

1. `scoreQuestion` counts a hit only for the expected book with overlap ≥ half the quote span;
   any expected target suffices; the rank is the first hit's 1-based position.
2. `summarize` of all misses is all zeros; of all rank-1 hits is all ones; MRR uses 1/rank for
   rank ≤ 10.
3. `bowEmbed` is deterministic, unit-norm, length 1024; two texts sharing content words have
   higher cosine than two sharing none.
4. `truncateVector(v, 1024)` returns `v` normalized; for d < 1024 components d..1023 are zero
   and the norm is 1.
5. `resolveBenchUrl` appends `_bench` to the database name, honors `BENCH_DATABASE_URL`, and
   throws when the bench URL equals the base URL.
6. `runMatrix` enqueues no job: the bench database's `jobs` table is empty after a run.
7. `fts` rows make zero embed calls and have `null` embed fields.
8. A written results file contains no question text and no expected quote (the test
   searches the JSON for each).
9. A matrix with a non-fake provider and no `--allow-paid` exits 2 with no database connection
   opened.
