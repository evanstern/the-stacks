# Research — 020 test compose stack

Every decision below was made against the code at the branch point and, where marked,
probed locally (Docker Compose v5.3.0, 2026-09-29).

## R1 — Image pin: one line in `docker-compose.yml`; the other two consumers read that file

- **Decision**: the image stays on `docker-compose.yml`'s `db` service, the only place it is
  written. `docker-compose.test.yml` reaches it with `extends: { file: docker-compose.yml,
  service: db }`. CI stops declaring a `services:` container and instead runs
  `docker compose -f docker-compose.test.yml up -d --wait`, so CI reads the image from the
  same file chain a developer uses. A guard test fails `pnpm ci:check` if `pgvector/` appears
  anywhere in `docker-compose.test.yml`, `deploy/**`, or `.github/workflows/**`.
- **Why**: "CI YAML cannot read a compose file" is true only of `services:` containers.
  Removing the `services:` block removes the problem instead of synchronizing around it.
  The pin then has exactly one home, and parity is literal: CI's database is the test
  compose file's database.
- **Probe**: `extends` inherits `image`, `healthcheck`, and `labels`; `!reset []` drops
  `env_file` and `volumes`; `!override` replaces `ports`. `docker compose -f
  docker-compose.test.yml config` resolves to `image: pgvector/pgvector:pg17` with tmpfs.
- **Found by the probe**: `extends` interpolates the whole base file. Its
  `"${APP_PORT}:${APP_PORT}"` has no default, so with `APP_PORT` unset (CI) the test file
  fails with `no port specified: :<empty>`. Fix: `${APP_PORT:-3000}` in both places. That is
  `config.ts`'s own default, so a self-hoster sees no change. Re-probed: resolves, exit 0.
- **Alternatives rejected**:
  - *A pin file (`.db-image`) read by a CI step into `$GITHUB_ENV`, and by compose as
    `image: ${STACKS_DB_IMAGE}`*: compose cannot read an arbitrary file, so a self-hoster's
    plain `docker compose up` would need the variable set, or a `:-default` that is a second
    copy of the pin. Breaks constitution IX or the one-place rule.
  - *A check script that diffs the pins*: keeps three copies and only detects drift. The
    ruling asks for one place; the guard test here enforces one place instead.
  - *Keep `services:` and a `docker compose config` step exporting the image*: `services:`
    containers start before any step runs, so a step cannot feed their image.

## R2 — Test data is tmpfs

- **Decision**: `tmpfs: [/var/lib/postgresql/data]`, `volumes: !reset []`. No named volume.
- **Why**: AC #1. A test database is disposable by definition; memory-backed storage is
  faster and leaves nothing behind for `down -v` to miss. A container restart empties it;
  the documented response is to re-run migrations.

## R3 — Port scheme: `25000 + n`

- **Decision**: `task-<n>` (1 ≤ n ≤ 999) → test db port `25000+n` (25001–25999). Hashed names
  → `25000+k`, k from the existing R3 hash (1000–8999) → 26000–33999. The same `k` feeds
  all three ports, so one worktree's ports stay a readable triple (`3033/15033/25033`).
- **Why**: app is 3001–11999, app db is 15001–23999. 25001–33999 overlaps neither, stays
  under the ephemeral range (49152+), and stays under macOS's default `net.inet.ip.portrange`
  start. `main` gets no test stack (R6), so it needs no fixed test port.
- **Rejected**: `DB_PORT + 10000` expressed as an offset — identical numbers, but stating
  the base alongside the other two bases keeps `derivePorts` one table.

## R4 — `env:up` starts both stacks; no new verb

- **Decision**: `env:up` probes all three ports, writes `.env`, starts the test stack
  (`docker compose -p stacks-<env>-test -f docker-compose.test.yml up -d --wait`, no build),
  then the app stack as today. `env:down` downs both. `env:status`/`prune` need no code
  change: they already group by compose project and read the labels `extends` inherits.
- **Why**: AC #3 allows either. One verb keeps the CLAUDE.md "Runtime stacks" doctrine
  ("Run `pnpm env:up` in a worktree that needs a database"; "`pnpm env:down` before `git
  worktree remove`") true without amendment, and keeps the sweep runbook's DB-suite gate
  (`env:up` → tests → `env:down`) unchanged. The test stack costs a few seconds: a pulled
  image, no build. A separate `env:test` verb would add a second thing to forget, and a
  forgotten test stack means `TEST_DATABASE_URL` points at nothing and suites loud-skip.
- **CLAUDE.md impact**: none required. No new verb, no new cleanup rule.

## R5 — Credentials and `TEST_DATABASE_URL`

- **Decision**: the test stack uses fixed credentials `stacks/stacks/stacks`, set in
  `docker-compose.test.yml`'s `environment:` as literals (not interpolated from `.env`).
  `env:up` writes `TEST_DB_PORT=<25000+n>` and
  `TEST_DATABASE_URL=postgres://stacks:stacks@localhost:<TEST_DB_PORT>/stacks`.
- **Why**: identical to CI's current credentials, so the URL shape is the same locally and
  in CI. The database is loopback-bound and throwaway; a secret buys nothing. It also
  frees the test stack from needing a `.env` at all, which CI does not have.

## R6 — `env:main` gets no test stack

- **Decision**: `mainIdentity()` carries no test project. `env:main` and `env:down main` are
  unchanged.
- **Why**: the local-main stack exists to run `origin/main`'s app. Its tests run in a task
  worktree.

## R7 — Consumers of `TEST_DATABASE_URL`

- The eight integration suites read `TEST_DATABASE_URL || DATABASE_URL`: they now hit the
  test stack. No code change.
- `apps/server/scripts/migrate.ts` and `create-operator.ts` prefer `TEST_DATABASE_URL` on the
  host: `pnpm db:migrate` now migrates the **test** database — which is what tests need.
  Migrating the **app** stack's database from the host takes an explicit override, because
  Node's `--env-file-if-exists` never overrides an already-set variable:
  `TEST_DATABASE_URL=postgres://<user>:<pass>@localhost:<DB_PORT>/<db> pnpm --filter
  @the-stacks/server db:migrate`. Documented in `.env.example`, the README, and quickstart.
  No code change: a new variable (`APP_DATABASE_URL`) would be a second URL to keep
  consistent for a command run once per worktree.
- **Deliberately unchanged**: the suites' skip notices still say "set TEST_DATABASE_URL=
  …localhost:<DB_PORT>…". `env:up` writes the right value, so the hint is only read when
  someone bypasses `env:up`. Rewording eight test files is churn with no failing case.
- `turbo.json` `globalEnv`: no change. Tests read `TEST_DATABASE_URL`, not `TEST_DB_PORT`.

## R8 — No worker toggle

- **Decision**: the app stack keeps running its ingest worker.
- **Why**: the operator chose isolation over a toggle. With separate databases the app's
  worker polls a `jobs` table no test writes to. No remaining need was found: CI never ran
  an app, and hosted `dev` must run its worker.

## R9 — Reserved `-test` suffix

- **Decision**: `deriveIdentity` refuses a sanitized env ending in `-test`.
- **Why**: worktree `foo-test`'s app project `stacks-foo-test` would equal worktree `foo`'s
  test project. `down -v` on one would destroy the other.

## R10 — Default project name for hand use

- **Decision**: `docker-compose.test.yml` sets top-level `name: stacks-test`.
- **Why**: without it, a hand-run `docker compose -f docker-compose.test.yml up` takes the
  directory name — the same default project as the app stack — and would replace the app's
  `db` container. CI uses this default name.

## R11 — Backward compatibility for stacks already up

- **Decision**: no migration logic. A worktree up from before this change keeps working
  until its next `env:up`, which refuses while its app port is bound (existing behavior).
  Remedy: `pnpm env:down && pnpm env:up`. Stated in quickstart and the wiki.
- **Why**: the old stack's `down` still works (same project name), and `env:down` on a
  missing test project exits 0. The only stale state is `.env`'s `TEST_DATABASE_URL`, which
  the next `env:up` overwrites (derived keys always win).

## R12 — Guard test home

- **Decision**: one `node:test` case in `scripts/env-lib.test.mjs` (already in
  `check:scripts`, so already in `ci:check`) asserts the image reference appears exactly once
  across `docker-compose.yml`, `docker-compose.test.yml`, `deploy/**/*.yml`, and
  `.github/workflows/*.yml`, and that the one hit is `docker-compose.yml`.
- **Why**: no new script, no new `package.json` entry, stdlib `fs` only.
