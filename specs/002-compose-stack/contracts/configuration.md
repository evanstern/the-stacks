# Contract — the stack's configuration surface

The committed example environment file is **the authoritative list of what an operator
must supply** (research D3). SC-004: an operator never discovers a required variable by
reading source or hitting a runtime error.

## Required variables

| Variable | Purpose | Example value | Secret? |
|---|---|---|---|
| `POSTGRES_USER` | Database role the app connects as | `stacks` | no |
| `POSTGRES_PASSWORD` | That role's password | *placeholder only* | **yes** |
| `POSTGRES_DB` | Database name | `stacks` | no |
| `DATABASE_URL` | Connection string the app reads | `postgres://stacks:...@db:5432/stacks` | **yes** (embeds the password) |
| `APP_PORT` | Host port the app is published on | `3000` | no |

The database host in `DATABASE_URL` is the compose service name, not `localhost` —
containers reach each other by service name on the compose network. This is the most
common first-run mistake and the example file should make it obvious.

## Rules

1. **No real secret is ever committed.** The example carries placeholders. FR-006, SC-005.
2. **The operator's filled-in copy is git-ignored**, shipped with this feature — an
   operator who edits the example in place must not find real credentials staged for
   commit.
3. **Every variable the stack reads appears here.** A variable consumed but undocumented
   is a defect, not an omission.
4. **Missing configuration fails loudly and by name** (FR-010) — never as an opaque
   connection error.
