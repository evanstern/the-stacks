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
| `APP_PORT` | Port the app binds to INSIDE the container, and the host port it is published on — the same number on both sides | `3000` | no |

## `APP_PORT` is one number on both sides of the port mapping

**This was underspecified and caused a real cross-task defect**, caught before either task
merged. The original wording — "host port the app is published on" — said nothing about
what the server binds to internally. Two implementers read it reasonably and reached
incompatible answers: the compose stack published and probed `APP_PORT`, while the server
read `PORT`. They agree at the shared default of 3000 and diverge silently the moment an
operator changes one — the healthcheck would then probe a port nothing is listening on and
report the container permanently unhealthy.

**The rule:** `APP_PORT` is the single source for both sides. The compose file publishes
`${APP_PORT}:${APP_PORT}`, the container healthcheck probes `APP_PORT` on `127.0.0.1`, and
**the application binds to `APP_PORT`**. There is no separate internal port variable.

A server that reads a differently-named variable must be reconciled to this one — the name
is fixed here because this file is the authoritative list of what an operator supplies, and
an operator sets one port value, not two.

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
