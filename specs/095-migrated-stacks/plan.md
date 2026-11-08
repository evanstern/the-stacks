# Implementation Plan: Migrated stacks

**Branch**: `task-0098-migrated-stacks` | **Date**: 2026-11-08 | **Spec**: [spec.md](spec.md)

**Input**: `specs/095-migrated-stacks/spec.md`, authored against `origin/main` `a8bda4ab`. Research
and design are small, so they live here: no separate research.md, data-model.md, contracts/ or
quickstart.md. The binding contract amended is `specs/010-worktree-stacks/contracts/env-cli.md`.

## Summary

Teach `runUp` in `scripts/env.mjs` to migrate before it starts the app. Build the Dockerfile's
`build` stage as `stacks-<env>-migrate` and run `scripts/migrate.ts` in it on each stack's compose
network. This is the shape `deploy/dev`'s `migrate` service and the TASK-0158 quickstart already
use. Verify the applied count against the journal and exit 1 when it is short. Back the ingest
worker off after a failed iteration. Make the two host CLIs print their target.

## Technical Context

**Language/Version**: Node 22 ESM (`scripts/*.mjs`), TypeScript (`apps/server`).
**Primary Dependencies**: Docker CLI with Compose, `drizzle-orm` migrator (installed). **No new dependency.**
**Storage**: Postgres. **No migration added.** The feature applies existing migrations.
**Testing**: `node:test` in `scripts/env-lib.test.mjs` (`pnpm check:scripts`, in `ci:check`);
Docker end-to-end `scripts/env.test.mjs` (`pnpm check:env`, not in CI); Vitest unit test in
`apps/server/test/library/`. No paid model run.
**Target Platform**: developer host with Docker Desktop.
**Constraints**: never read, print or interpolate `.env` passwords on the host. Root checkout stays
read-only. `env:main` touches only `.worktrees/env-main`.
**Scale/Scope**: 6 code files, 2 test files edited, 1 test file added, 3 doc files, wiki notes.

## Design

**D1 — `runUp` order.** Each step exits 1 on failure with a line naming the stack and the database.

1. Probe ports and write `.env` (unchanged).
2. Test stack only: `docker compose -p <testProject> -f docker-compose.test.yml up -d --wait`
   (unchanged).
3. `docker build --target build -t <project>-migrate .` in the
   checkout.
4. Test stack only: migrate the test database —
   `docker run --rm --network <testProject>_default -w /app/apps/server
   -e DATABASE_URL=postgres://stacks:stacks@db:5432/stacks -e TEST_DATABASE_URL=
   <project>-migrate node --experimental-strip-types scripts/migrate.ts`.
   These are spec 020's fixed throwaway credentials, already literal in `env-lib`; no `.env` read.
5. `docker compose -p <project> up -d --wait db`.
6. Migrate the app database — `docker run --rm --network <project>_default --env-file .env
   -e TEST_DATABASE_URL= -w /app/apps/server <project>-migrate node --experimental-strip-types
   scripts/migrate.ts`. Docker reads `.env` itself; the host never parses the password.
7. Verify each migrated database (D2).
8. `docker compose -p <project> up -d --build --wait` (unchanged; brings up `app`).

**D2 — verify.** Count rows with the database container's own env, so the host holds no credential:
`docker compose -p <p> [-f docker-compose.test.yml] exec -T db sh -c
'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "select count(*) from drizzle.__drizzle_migrations"'`.
A missing table (exit nonzero) counts as 0. Add a pure helper to `scripts/env-lib.mjs`:

```js
/** `null` when applied >= expected, else a one-line reason. Pure; unit-tested. */
export function migrationShortfall(journalText, appliedText) { … }
```

`journalText` is the checkout's `apps/server/drizzle/meta/_journal.json`; expected is
`entries.length`. `appliedText` is the trimmed `psql` stdout; non-integer text counts as 0.

**D3 — cleanup.** `down` and `prune` run `docker image rm -f <project>-migrate` after the project is
down, and ignore its exit status (the image may never have been built). `env down main` removes
`stacks-main-migrate`.

**D4 — ingest backoff.** In `apps/server/src/library/ingest/worker.ts`'s loop `catch`, wait
`POLL_MS` through the same `wait`/`wakeSleep` pair the idle branch uses, unless `stopped`. This
mirrors `apps/server/src/dm/worker.ts` lines 664–671. `stop()` still wakes the sleep at once.

**D5 — host CLI target line.** In `apps/server/scripts/migrate.ts` and
`apps/server/src/cli/create-operator.ts`, after resolving `databaseUrl`, print
`` `target: ${u.hostname}:${u.port || 5432}${u.pathname}` `` with `const u = new URL(databaseUrl)`.
Name the source variable (`TEST_DATABASE_URL` or `DATABASE_URL`) in the line. Never print
`u.username` or `u.password`. Precedence is unchanged (OQ1).

**D6 — contract and docs.** `contracts/env-cli.md`: add D1 steps 3–7 to the `up` and `main` rows,
add a "Migration" section (where, when, which credentials, verify rule, the in-container
`create-operator` command), and add image removal to `down`/`prune`. Remove the hand
`db:migrate` line from `specs/010-worktree-stacks/quickstart.md`.

## Files touched

| File | Change |
|---|---|
| `scripts/env.mjs` | `runUp` steps 3–7 (D1, D2); `down`, `prune` image removal (D3) |
| `scripts/env-lib.mjs` | add `migrationShortfall` (D2) |
| `scripts/env-lib.test.mjs` | `migrationShortfall` cases: equal, short, missing table text, extra applied |
| `scripts/env.test.mjs` | after `up`, assert both databases' counts equal the journal (D2 command) |
| `apps/server/src/library/ingest/worker.ts` | loop `catch` backoff (D4) |
| `apps/server/test/library/worker.backoff.test.ts` | new: a fake `db` whose calls throw; at most two `execute` calls in 500 ms; `stop()` resolves promptly |
| `apps/server/scripts/migrate.ts` | target line (D5) |
| `apps/server/src/cli/create-operator.ts` | target line (D5) |
| `specs/010-worktree-stacks/contracts/env-cli.md` | Migration section, row updates (D6) |
| `specs/010-worktree-stacks/quickstart.md` | drop the hand migrate line (D6) |
| `docs/wiki/*` | Phase 2 |

Not touched: `Dockerfile`, `docker-compose.yml`, `docker-compose.test.yml`, `deploy/dev/`,
`scripts/deploy-dev.mjs`, `apps/server/src/jobs/queue.ts`. The runbook named `jobs/queue.ts` for
backoff, but the tight loop is in the ingest worker's loop; `queue.ts` holds only constants.

## Constitution Check

Against `.specify/memory/constitution.md` 3.0.0.

- [x] **I. Agent-operable**: the `pnpm env:*` verbs are non-interactive and exit-coded; an agent and
      a human run the same commands. No Intent kind: developer tooling.
- [x] **II. One Intent vocabulary**: no write to play state. N/A.
- [x] **III. Event sourcing**: no event change. N/A.
- [x] **IV. Data planes**: no new state. N/A.
- [x] **V. Many views, one state**: no view. N/A.
- [x] **VI. Engine owns the numbers**: no mechanic. N/A.
- [x] **VII. Narration around facts**: no narration. N/A.
- [x] **VIII. Campaign is data**: no content. N/A.
- [x] **IX. UX quality bar**: no UI. N/A.
- [x] **X. Citations**: no library claim. N/A.
- [x] **XI. Operator-owned content**: ships no content. N/A.
- [x] **XII. Self-hostable**: `docker-compose.yml` is unchanged; no new service. The migrate image
      is a dev-tooling build of an existing stage. The self-hoster gap is OQ2.
- [x] **XIII. Just-in-time**: R1 lane LP, signed runbook. OQ2 and OQ3 are named for the
      orchestrator to card.

**Stack conformance**: no departure. **Complexity Tracking**: none.

## Risks

- **Cold build time.** Step 3 runs the full `build` stage before the app build; the app build then
  reuses those layers. Net cost is one image tag.
- **Stale volume.** A `db` volume that predates a root password change still fails auth (existing
  caveat in the `runtime-stacks` note). Step 6 then fails with a named database, which is the fix.
