# Quickstart: validate seed NPC presence

## Prerequisites

1. Run `pnpm install --frozen-lockfile` in the worktree.
2. For DB suites, run `pnpm env:up`, migrate both databases, and export only
   `TEST_DATABASE_URL` from the worktree `.env`.

## Scenarios

| # | Command | Expected |
|---|---|---|
| 1 | `pnpm --filter @the-stacks/server exec vitest run test/dm/seed.test.ts` | The shipped seed loads; each malformed beat or NPC is refused with its issue. |
| 2 | `pnpm --filter @the-stacks/server exec vitest run test/dm/seed-npc-presence.test.ts` | Snag reads `present` at seqs 295–301 of the recorded M2 log; one appended `fled` row makes him `absent`. |
| 3 | `pnpm --filter @the-stacks/session-model exec vitest run test/gate-plan.test.ts` | A `dm` scene-presence proposal writes a `dm` row; the default stays `public`. |
| 4 | `REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server exec vitest run test/dm/resolve.integration.test.ts` | Scene start writes `dm` rows for Pell and Snag; the reed-camp start writes two public `arrived` rows; no `director:` submission has kind `scene-presence`. |
| 5 | `pnpm ci:check` | Green. |
| 6 | `pnpm playtest run` (ci case, fake gateway) | The shipped scenario ends `ended` with a passing report. |

Contracts: [contracts/seed-presence.md](./contracts/seed-presence.md). Data:
[data-model.md](./data-model.md).
