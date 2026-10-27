# Quickstart: validate the debug API (TASK-0116)

## Prerequisites

1. Run `pnpm env:up` in the worktree.
2. Migrate both databases by hand. Fresh stacks come up unmigrated (TASK-0098).
3. Restart the app container.
4. Use the fake gateway only. No paid provider run.

## C1 — unit suites (no database)

Run `pnpm --filter @the-stacks/server test -- ai.gateway call`.
Expect `onUsage` and the call-record usage tests to pass.

## C2 — merge condition (database)

Run `REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server test -- full-turn`.
Expect one `dm_model_calls` row per model call of the turn. Expect each row to match an entry
of `jobs.result.calls` on purpose, prompt version, attempt and the six usage fields.

## C3 — routes (database)

Run `REQUIRE_DATABASE=1 pnpm --filter @the-stacks/server test -- routes`.
Expect `401` and `403` on all four new routes. Expect `/turns` assertions unchanged.

## C4 — by hand, against the running stack

1. Sign in as the operator. Start a fake-gateway scene (`POST /dm/sessions/:id/start`).
2. Call `GET /dm/sessions/:id/events?after=0`. Expect DM-visibility rows in the list.
3. Call `GET /dm/sessions/:id/jobs`. Expect the scene-start turn with its checkpoint.
4. Call `GET /dm/sessions/:id/calls`. Expect rows and non-zero token totals.
5. Call `GET /dm/sessions/:id/seed`. Expect `dmOnlyPaths` to be non-empty.
6. Repeat step 2 as a player. Expect `403`.

## C5 — gates

Run `pnpm ci:check`. Run the wiki freshness and spec-bridge checks the runbook names.
