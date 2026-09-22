# @the-stacks/server

## Database migrations

**Prerequisites**: a reachable Postgres (`docker compose up -d db` from the repo root) and
a `.env` with `DATABASE_URL` set (copy `.env.example`).

Apply migrations with:

```bash
pnpm --filter @the-stacks/server db:migrate
```

This reproduces the full schema on an empty database (FR-010). It is safe to run
repeatedly: a second run against an already-migrated database applies nothing and exits 0
(FR-011, SC-006) — Drizzle's migrator tracks applied migrations and skips them.

See [specs/004-event-log/quickstart.md](../../specs/004-event-log/quickstart.md) for the
full validation walkthrough, including the manual `psql` checks that confirm the
append-only guard.
