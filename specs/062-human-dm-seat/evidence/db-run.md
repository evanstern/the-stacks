# DB run (T026)

Run by the orchestrator on 2026-10-29 against 59b840c3, on the worktree stack `stacks-task-0177` (app :3177, test-db :25177).

1. `pnpm env:up`.
2. Migrated the app database in the build-stage container on the stack network: "Migrations applied.".
3. Migrated the test database with `pnpm --filter @the-stacks/server db:migrate`, with only `TEST_DATABASE_URL` exported: "Migrations applied.".
4. Restarted the app.
5. `REQUIRE_DATABASE=1 pnpm ci:check`: exit 0.

| Package | Test files | Tests |
|---|---|---|
| server | 120 passed, 1 skipped | 1350 passed, 5 skipped |
| web | 22 passed | 138 passed |
| session-model | 24 passed | 816 passed |
| dnd5e-engine | 16 passed | 241 passed |
| srd | 9 passed | 181 passed |

No WebSocket gateway re-run was needed. TASK-0177 changes no server source.
