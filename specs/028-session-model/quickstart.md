# Quickstart: validate the session model

Run every command from the worktree root (`.worktrees/task-0044`).

## Prerequisites

- `pnpm install` has run (no new external packages; the new workspace package links).
- For the database suite: the worktree's own stack. Run `pnpm env:up`. Run `pnpm env:down`
  before removing the worktree.

## 1. Package tests (no database)

```sh
pnpm --filter @the-stacks/session-model test
```

Expected: green. The suite covers:

| Test file | Proves |
|---|---|
| `test/catalog.test.ts` | every type validates its fixture examples; session and engine type names are disjoint; every `state-change` schema requires `reason`, `before`, `after`; every `marker` requires `reason` (AC #1, AC #6) |
| `test/decode.test.ts` | unknown type, unknown version, invalid payload and type mismatch decode to their statuses without throwing (AC #8) |
| `test/visibility.test.ts` | the `canSee` table (session-events.md) |
| `test/talk-isolation.test.ts` | a talk event changes only the transcript (AC #2) |
| `test/actions.test.ts` | lifecycle transitions and ignored transitions (AC #1) |
| `test/table-mode.test.ts` | free → turn → turn → free, active player recorded (AC #3) |
| `test/projections.test.ts` | scene, party, encounter and journal from the log alone (AC #4) |
| `test/secrecy.test.ts` | player projections never contain tracker data, for every fixture and every player viewer (AC #5) |
| `test/ledger.test.ts` | one roll row per roll with its reason; one change row per state change with before and after (AC #6) |
| `test/replay.test.ts` | `project` twice and the incremental fold are deeply equal (AC #7, in memory) |
| `test/tolerance.test.ts` | the `unknown-and-invalid` fixture folds with the expected counters (AC #8) |
| `test/fixtures.test.ts` | fixture guarantees 1–5, including recipe regeneration through the engine |

## 2. Database suite (AC #7 on a real log; atomic batches)

```sh
pnpm env:up
REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server test -- session
```

Expected: `apps/server/test/session.integration.test.ts` runs (it must not skip: with
`REQUIRE_DATABASE=1` a missing database throws). It appends each fixture's events to a fresh
session through `appendSessionEvent` and `appendMechanicsBatch`, folds each returned row
incrementally, then calls `loadProjections` twice, and asserts all three results are deeply
equal for the DM and each player viewer, with no incomplete batch. It also asserts a
non-`dm` tracker append is refused with `VISIBILITY_NOT_ALLOWED` and writes no row, and that a
failure injected mid-batch (through `appendBatch` and through `appendMechanicsBatch`) leaves
zero rows of that batch in the log (AC #6, AC #7).

## 3. Boundary rule

```sh
pnpm check:boundaries
```

Expected: every fixture flagged, including the four new ones (contracts/boundary-rule.md).

## 4. Whole gate

```sh
pnpm ci:check
```

Expected: green. Then `pnpm env:down`.
