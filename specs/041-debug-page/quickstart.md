# Quickstart: the debug page (TASK-0117)

## Unit and markup tests

```sh
pnpm --filter @the-stacks/web test        # node --test (pure modules) and vitest (markup)
pnpm ci:check
```

Expected: every `apps/web/test/debug/*` case passes; `no-dialog.test.mjs` and
`play-surfaces.test.mjs` stay green.

## Live check (needs TASK-0116 merged into this branch)

1. In the worktree, run `pnpm env:up`. Migrate both databases by hand (fresh stacks come up
   unmigrated, TASK-0098). Restart the app.
2. Start the app process with the `dm.*` purposes routed to a `fake` provider in that process's
   environment only. Never edit the root `.env`; never read or print a key.
3. Sign in as the operator in Brave. Open `/play`, start a table, start the scene through
   `POST /dm/sessions/:id/start`.
4. On `/play/:id`, confirm the Debug link shows. Open it: the page loads in a new tab.
5. As a seated player, declare and commit an action. On the debug page, confirm within 3 s:
   the strip shows the running turn with its stage and a counting heartbeat age; the timeline
   appends the job; the log appends its rows.
6. Select the job: its rows highlight. Click a highlighted row: the state column pins to that seq;
   "back to live" unpins.
7. Open Seed, Ledger, Journal and Cost. Each slides out from the right.
8. Run `evidence/shoot-debug.mjs` for light and dark captures at 1280 px and 390 px.
9. Sign in as a player and open the debug URL: the operator-only message shows, and the network
   log shows no `/dm/` request.

Record the run in `specs/041-debug-page/evidence/live-check.md` with the shot list.
