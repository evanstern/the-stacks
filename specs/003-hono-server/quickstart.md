# Quickstart — validating this feature

Runnable checks proving the feature works. Everything runs from the repo root.

## Prerequisites

- Node 22 and pnpm (pinned by TASK-0010: `.nvmrc`, `packageManager`)
- `pnpm install` has been run
- A reachable Postgres 17, configured by environment variables. Until TASK-0011 lands the
  compose stack, any local Postgres serves

## Automated checks

```
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

`pnpm test` is the meaningful one here: TASK-0010 defined `test` as a no-op placeholder,
and this feature is the first to put real tests behind it. It must cover all four cases
FR-008 names — health with the database up, health with it down, the route with valid
input, and the route with invalid input.

## Manual validation

### 1. Health reports honestly when everything is up

Start the server, then request `GET /health`. Expect `200`, `status: "ok"`, a positive
`process.uptimeSeconds`, and `database.reachable: true`.

### 2. Health stays honest — and bounded — when the database is down

Stop the database. Request `GET /health` again.

Expect: still `200` (the status code is not the health signal — see
[contracts/health.md](contracts/health.md)), `status: "degraded"`,
`database.reachable: false`, **and a response in well under 5 seconds**. A request that
hangs is the failure this check exists to catch (research D1).

Restart the database and request again: `status: "ok"`, with no server restart.

### 3. The typed route accepts valid input

`POST /api/echo` with `{"message": "hello"}`. Expect `200` and a body matching the
declared response shape, including `receivedAt`.

### 4. The typed route rejects invalid input, usefully

`POST /api/echo` with `{}`, then with `{"message": 123}`, then with a >500-character
string. Each: `400`, `error.kind: "validation"`, and an `issues` entry naming the
offending path. No stack trace.

### 5. Unknown paths return the same shape

`GET /api/nope`. Expect `error.kind: "not_found"` in the same structured shape — not a
framework default page (spec edge case 3).

## What "done" looks like

All four automated checks green, and all five manual validations behaving as described.
The terminal output of the automated run goes in the PR body — it stands in for the CI
that TASK-0017 has not built yet.
