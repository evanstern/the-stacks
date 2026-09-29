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

## Operator provisioning

**No default or pre-seeded credential ships with this project** (FR-011) — a fresh,
migrated database has no signable account. Create the first operator with:

```bash
pnpm --filter @the-stacks/server auth:create-operator
```

For a running stack with no host toolchain, run the same entry point in the container:

```bash
docker compose exec app node dist/cli/create-operator.js
```

Reads the password from `OPERATOR_PASSWORD`, or prompts for it interactively if unset.
`OPERATOR_USERNAME` overrides the default username (`operator`).

**Safe to run only once.** A second run **refuses** — it does not create a second
operator or overwrite the first (research D6, US3 scenario 2). This project is
single-tenant: one operator per install.

See [specs/005-session-auth/quickstart.md](../../specs/005-session-auth/quickstart.md) for
the full session-auth validation walkthrough, including invitations and the manual `curl`
checks for cookie flags.
