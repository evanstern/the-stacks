# Quickstart: validate presence

## Prerequisites

- Worktree `.worktrees/task-0051` with its own stack: `pnpm env:up`.
- Migrate both databases by hand (fresh stacks come up unmigrated, TASK-0098), then restart the
  app.
- Two accounts on the stack (operator provisioning plus one invitation), both party members of
  one table.

## Automated

1. `pnpm ci:check` is green.
2. `REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server test` runs the presence suites:
   tracker, ws presence integration, gate `recordPresence`, worker marker.
3. `pnpm --filter @the-stacks/session-model test` covers the catalog entry and the fold.
4. `pnpm --filter @the-stacks/web test` covers `reduceFrame` and the strip.

Expected: join, leave, reconnect inside grace, silent loss, multi-tab, non-opted-in, marker per
turn, and the `default` branch each have a passing test (spec FR-017).

## Manual — the merge condition (Brave)

1. Open the table in a Brave window signed in as user A.
2. Open the same table in a second Brave profile (or a private window) signed in as user B.
3. Within 2 s, each window's strip shows both users. Screenshot both windows.
4. Close B's tab. Within 10 s, A's strip shows B absent. Screenshot A's window.
5. Reopen B's tab. A's strip shows B present again. Screenshot both.
6. Attach the screenshots to the PR.

## Marker check

Run one DM turn (fake gateway). The table's log gains one `presence.recorded` row, actor
`system`, visibility `public`, purpose `director`, and the turn's `jobs.result.presenceSeq`
names it.
