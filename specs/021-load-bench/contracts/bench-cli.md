# Contract: load bench CLI and module

Code: `apps/server/src/bench/load/`. Data: `apps/server/bench/load/`.
Entry: root `pnpm bench:load <subcommand>` → server script
`bench:load` → `tsc -b && node --env-file-if-exists=../../.env dist/bench/load/cli.js`.
The script builds first, so it never runs stale code.

## Subcommands

```
pnpm bench:load list
pnpm bench:load run --tier <commit|demand|dev> [--case <id>]... [--profile <path>] [--allow-dev] [--no-save]
pnpm bench:load report [--dir <path>]
```

### `list`

Prints every case: id, tier, target, summary. No database, no network. Exit 0.

### `run`

1. Parse args (`node:util` `parseArgs`). Load and validate the profile (default
   `profiles/<tier>.json`). Invalid → exit 1 naming the field.
2. For every registered case not in the tier (or not named by `--case`), print
   `SKIP <id> [tier <tier>]: <reason>` and record it `skipped`.
3. Tier `commit` or `demand`: resolve the load URL (research R3). Equal to base, non-loopback
   host, or in use → exit 1 naming the rule. No write before this check passes.
4. Tier `dev`:
   - `LOAD_DEV_URL` unset → print `SKIP concurrency-dev [tier dev]: dev target not configured
     (LOAD_DEV_URL unset)`, write results unless `--no-save`, exit 0.
   - `--allow-dev` absent → print `dev run refused; re-run with --allow-dev after operator
     sign-off` and exit 2 before any network call.
   - `LOAD_DEV_USERNAME` or `LOAD_DEV_PASSWORD` unset → exit 1 naming the variable.
5. Run each selected case in registry order. Before each local case, recreate and migrate the
   load database. Print each case's table and verdict as it finishes.
6. Unless `--no-save`, write the results file (contracts/results-format.md) and print its path.
7. Drop the load database at the end (best effort; a failure is a warning).

Exit codes: 0 every run case passed (a degradation verdict is not a failure), 1 any case
failed or invalid input, 2 dev run refused.

### `report`

Reads every `*.json` in the results directory, validates each (invalid or unknown
`schemaVersion` → warn naming the file, skip), and prints one table per (case id, target),
rows sorted by `startedAt`. Columns: date, sha7, dirty, host cpus, then the case's step
columns, then the verdict.

## Output format (stdout)

Fixed-width text, one row per step. Latency in ms to one decimal, rates to three decimals,
throughput in jobs/s to two decimals. A verdict line follows each series:
`VERDICT ingest-scaling workers=1: degraded at volume 250 (throughput, service)` or
`VERDICT concurrency-local: no degradation up to 100 users`.

## Module API (agent-operable, constitution I)

```ts
// apps/server/src/bench/load/index.ts
export const CASES: readonly Case[];
export function selectCases(tier: Tier, only: string[] | undefined): { run: Case[]; skipped: CaseOutcome[] };
export function loadProfile(path: string): Profile;
export function resolveLoadUrl(env: NodeJS.ProcessEnv): { baseUrl: string; loadUrl: string };
export function recreateLoadDb(baseUrl: string, loadUrl: string): Promise<void>;
export function synthDoc(seed: number, bytes: number): string;
export function percentile(sorted: number[], p: number): number;   // nearest-rank
export function ingestVerdict(steps: IngestStep[], t: IngestThresholds): Verdict;
export function concurrencyVerdict(steps: ConcurrencyStep[], t: ConcurrencyThresholds): Verdict;
export function runTier(ctx: RunContext, tier: Tier, profile: Profile, only?: string[]): Promise<RunResult>;
```

## Invariants (each has a test)

1. Every case in `CASES` has exactly one tier; ids are unique; only `dev`-tier cases have
   target `dev`.
2. `selectCases` returns every non-selected case as `skipped` with a non-empty reason; the
   union of `run` and `skipped` is all of `CASES`.
3. `resolveLoadUrl` appends `_load`, honors `LOAD_DATABASE_URL`, throws when the load URL
   equals the base URL, and throws for a non-loopback host.
4. `synthDoc` is deterministic, within 5% of the requested bytes, and parses with
   `parseMarkdown` into at least one chunk.
5. `ingestVerdict` and `concurrencyVerdict` return `degraded: false` for flat series and name
   the first step and every rule that fired for a series crossing each threshold; the
   absolute floors suppress sub-floor changes.
6. `percentile` is nearest-rank: `[1..100]` p95 is 95; one sample returns it.
7. A `dev` run without `--allow-dev` exits 2 and opens no socket (fetch spy sees zero calls).
8. A `dev` profile with `wsSend: true` or more than 25 users fails validation.
9. A results file contains no string matching the dev URL, username, password, or a
   `session=` cookie (the test writes one from fabricated outcomes and searches it).
