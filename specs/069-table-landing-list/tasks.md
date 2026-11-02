# Tasks: The Table landing lists your tables

**Input**: `specs/069-table-landing-list/` (spec.md, plan.md)

**Board task**: TASK-0175. Card AC #1: a read route returns the sessions the signed-in account has
a seat at or started, with scene title and last activity, and an integration test covers a player
and the operator. Card AC #2: `/play` lists those tables newest activity first, each linking to
`play/:sessionId`, in light and dark mode. Card AC #3: a player never sees a table they have no
seat at, with a test.

**Prerequisites**: OQ-1 (spec.md). The tasks implement (a). A ruling of (b) amends plan.md and
these tasks before Phase 1 dispatches.

**Dispatch**: one phase is one implementer dispatch (sonnet), re-grounded from this spec dir and the
branch commits. Tasks marked **[orchestrator]** are run by the orchestrator. Work only in
`/Users/evanstern/projects/the-stacks/.worktrees/task-0175`. A fresh worktree runs
`pnpm install --frozen-lockfile` first. Each implementer phase ends with `pnpm ci:check` green and
one commit led by `TASK-0175:`. No modal: slide-out panels or autocomplete dropdowns only. Browser
automation uses Brave. Do not change the `ws-protocol` frames, `specs/029-proposal-gate/contracts/`
or `specs/030-play-route/contracts/proposal-seam.md`. Tests are written first and seen to fail.

## Phase 1: The read route (card AC #1, #3; FR-001 to FR-006, FR-010)

**Goal**: `GET /api/tables` returns the signed-in account's tables per plan.md "Contract".

**Independent test**: `REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server exec vitest run test/tables.integration.test.ts`
with only `TEST_DATABASE_URL` exported from the worktree `.env`.

- [x] T001 **[orchestrator]** On the worktree stack: `pnpm env:up`, migrate both databases by
      hand, restart the app. Leave the stack up.
- [x] T002 [US1] [US2] Create `apps/server/test/tables.integration.test.ts`. Follow the DB guard
      and `cookieFor` helper of `apps/server/test/dm/human-dm-scene.integration.test.ts`, and
      `createApp` with a reachable probe. Write rows with `append`/`appendBatch` from
      `src/events/log.ts`, using fresh session ids. Cases:
      1. A player seated by `party.member.changed` at sessions A and B gets both, the later-written
         first, each with `relation: "player"`, the latest `scene.changed` title and an ISO
         `lastActivityAt` (card AC #1).
      2. The same player does not get session C, where another user is seated (card AC #3).
      3. A later `party.member.changed` row with `after: null` for the player's character removes
         session A from their list (card AC #3).
      4. A user named by the latest `dm.seat.changed` `after: { kind: "human", userId }` gets
         `relation: "dm"`; a later row returning the seat to `{ kind: "ai" }` drops it.
      5. The operator gets A, B and C (containment, not equality: the test database is shared),
         C marked `"started"` and in activity order relative to A and B (card AC #1).
      6. A `dm-only` `scene.changed` row written last does not change a player's title, and a
         `dm-only` row written last does not move their `lastActivityAt` (FR-005).
      7. A session with no `scene.changed` row returns `title: null`.
      8. No cookie → 401 in the error-contract shape.
      See them fail (no route).
- [x] T003 [US1] [US2] Create `apps/server/src/routes/tables.ts`: export `TableSummary`,
      `listTables(db, { userId, role })` (one SQL query per plan.md, `sql` from `drizzle-orm`,
      50-row cap, the ordering rule) and `createTablesRoute({ db, validateSession })`
      (`createAuthMiddleware`, `UnauthorizedError` on no identity, `GET /` returns
      `{ tables }`). Add the plan's `ponytail:` comment on the missing index.
- [x] T004 In `apps/server/src/app.ts`, mount `app.route("/api/tables", createTablesRoute({ db,
      validateSession }))` after `/api/echo` and before the web middleware. T002 passes.
- [x] T005 Run `pnpm ci:check`, then `REQUIRE_DATABASE=1` on the new test file. Commit
      `TASK-0175: GET /api/tables lists the account's tables`.

## Phase 2: The landing list (card AC #2; FR-007 to FR-009)

**Goal**: `/play` shows "Your tables" under Join; Start, Join and the fixtures link are unchanged.

**Independent test**: `pnpm --filter @the-stacks/web exec vitest run test/table-list.test.tsx` and
`node --test apps/web/test/no-dialog.test.mjs`.

- [ ] T006 [US1] [US3] Create `apps/web/test/table-list.test.tsx` (`renderToStaticMarkup`). Cases
      for an exported pure `TableList({ state })`, where `state` is `{ kind: "loading" }`,
      `{ kind: "error" }` or `{ kind: "ready", tables }`:
      1. Ready with two tables renders two links in the given order, hrefs `/play/<sessionId>`,
         each showing the title (card AC #2).
      2. A null title renders "Untitled table" and the first 8 characters of the id.
      3. Relations render as "DM", "Player" and "Started".
      4. `lastActivityAt` renders through `toLocaleString` inside a `<time dateTime=...>`; null
         renders no time.
      5. Ready with no tables renders "No tables yet."
      6. Error renders "Could not load your tables." with `role="alert"`.
      7. No markup contains `dialog`.
      See them fail.
- [ ] T007 [US1] [US3] In `apps/web/app/routes/table.tsx`: restate the `TableSummary` type; add
      and export `TableList` (a `<section aria-labelledby>` with an `h2` "Your tables" and a `ul`
      of React Router `Link`s, styled with existing tokens: `border-border`, `hover:bg-accent`,
      `text-muted-foreground`; legible in both schemes); fetch `/api/tables` with
      `credentials: "same-origin"` in a `useEffect` after mount; render the list below the Join
      form and above the fixtures link. Do not change Start, Join or the fixtures link. T006
      passes.
- [ ] T008 Run `pnpm ci:check`. Commit `TASK-0175: the Table landing lists your tables`.

## Phase 3: Live check and Brave screenshots (card AC #2; merge condition; SC-001 to SC-004)

**Goal**: evidence that a player and the operator see the right lists in the real app, light and
dark.

**Independent test**: `specs/069-table-landing-list/evidence/live-run.md` records PASS for each
check, and `shots/` holds the eight screenshots.

- [ ] T009 **[orchestrator]** On the worktree stack, turn script mode on with
      `DM_FAKE_SCRIPT=greyhollow-live` and recreate the app container (plan.md "Quickstart" step
      1). Create the operator with a generated password in a scratchpad outside the repo.
- [ ] T010 Write `specs/069-table-landing-list/evidence/shoot.mjs`, modeled on
      `specs/061-trio-seed/evidence/shoot-live.mjs` (playwright-core resolved through
      `PLAYWRIGHT_CORE`, Brave executable, a creds file outside the repo, never printing a password
      or token). It runs plan.md "Quickstart" steps 2-5 and prints one PASS/FAIL line per check:
      operator lists A and B newest first with titles; `player2` lists A only; `player2` never
      lists B; an entry navigates to `/play/<sessionId>`; `GET /api/tables` with no cookie is 401.
- [ ] T011 Run it. Save shots as `shots/landing-<operator|player2>-<1280|390>-<light|dark>.png`
      (eight files). Record the PASS lines in `evidence/live-run.md`. Confirm by eye that the list
      is legible in dark mode.
- [ ] T012 Run `REQUIRE_DATABASE=1 pnpm ci:check` once on the stack (export only
      `TEST_DATABASE_URL`). Record the result in `evidence/db-run.md`. Re-run a flaky WS gateway
      test once and report it; do not fix it.
- [ ] T013 Commit `TASK-0175: live check and screenshots`. Leave the stack up.

## Phase 4: Wiki (re-ground)

**Goal**: the freshness gate prints `OK` with every touched note honestly re-verified.

**Independent test**: `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/1.0.1/gates/cli.mjs freshness . docs/wiki`
prints `OK`.

- [ ] T014 Run `/grounding-wiki:wiki-update`. Review these notes against the diff (NEEDS-REVIEW):
      `play-route` (the landing's list and its link to `play/:sessionId`), `react-router-app`
      (`/play` now reads server data after hydration), `server-entrypoint-and-app` (the
      `/api/tables` mount and its place in the order; add `routes/tables.ts` to its sources).
- [ ] T015 Review `chat-ui` (it lists `routes/table.tsx`: update its Table landing sentence) and
      `static-serving` (it lists `app.ts`: `/api` stays reserved; re-pin when no claim changes).
- [ ] T016 Update `docs/wiki/INDEX.md` and `docs/wiki/CAPSULES.md`: one sentence that `/play`
      lists the account's tables from `GET /api/tables` (TASK-0175, specs/069).
- [ ] T017 Run the freshness gate and the spec-bridge gate
      (`node ~/.claude/plugins/cache/praxisflux/spec-bridge/1.0.1/gates/cli.mjs check .`). Both
      pass. Commit `TASK-0175: re-ground the wiki`.

## Dependencies

Phase 1 → Phase 2 (the list needs the route) → Phase 3 (the live check needs both) → Phase 4.
No task runs in parallel across phases.
