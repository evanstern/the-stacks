# Research — 016 hosted dev on vm-104 with CD from main

Each decision below is settled for implementation. Sources of truth: `backlog/docs/doc-0002`
(decision-0006, ratified 2026-09-28), the TASK-0021 card notes (Tailscale runs in the
`tailscale` container; the host unit is masked on purpose), and a read-only survey of vm-104
taken 2026-09-29 as `stacks` over the tailnet.

## vm-104 survey (2026-09-29, read-only, as `stacks`)

- `stacks` = uid 1004, groups `stacks`, `users`, `docker`. Docker 29.4.0, Compose v5.1.2.
- Disk: 41 GiB free of 195 GiB (78% used).
- Host binaries: `git` 2.43, `node` v22.22.2, `curl`, `jq`, `openssl`. `pnpm` resolves through
  corepack to 12.x, not the repo's pinned 11.10.0.
- Nothing listens on 3000 or 5432. **Traefik holds `0.0.0.0:80` and `0.0.0.0:443`.**
- `docker exec tailscale tailscale serve status` → `No serve config`. The node is `vm-104`,
  tailnet IP 100.80.45.98, MagicDNS `vm-104.tailb3c1b6.ts.net`.
- Unrelated compose projects run there, including one named `the-stacks-prod`
  (`the-stacks-prod-*` containers, an older codebase). `stacks-dev` does not collide with it,
  and nothing in this feature may touch it.
- The runner workspace `/home/stacks/actions-runner/_work` exists and is empty.

## R1 — Trigger: `workflow_run` on CI, main, success only

**Decision:** `.github/workflows/deploy-dev.yml` triggers on
`workflow_run: { workflows: [CI], types: [completed], branches: [main] }` plus
`workflow_dispatch`. The one job runs on `[self-hosted, vm-104]` and is guarded by:

```
github.event_name == 'workflow_dispatch' ||
(github.event.workflow_run.conclusion == 'success' &&
 github.event.workflow_run.event == 'push' &&
 github.event.workflow_run.head_branch == 'main')
```

It checks out `github.event.workflow_run.head_sha` (or the dispatch input, see R6).

**Why:** `workflow_run` always executes the workflow file **from the default branch**, so a
pull request can never change what runs on vm-104. The `event == 'push'` guard excludes CI
runs that a pull request started against `main` (their `head_branch` is the PR branch, but the
guard makes it explicit). `ci.yml` itself stays on `ubuntu-latest`; no `pull_request` workflow
ever targets the self-hosted runner. A unit test asserts both facts (R8).

**Rejected:** a `deploy` job appended to `ci.yml` with `needs: check` and an
`if: github.event_name == 'push'` — it puts self-hosted runner code in a file that pull
requests execute, so a PR could edit the `if`. `on: push` in a separate workflow — it cannot
wait for CI.

## R2 — Serialization and stale commits

**Decision:** `concurrency: { group: deploy-dev, cancel-in-progress: false }` on the deploy
workflow. Before touching anything, the deploy compares its commit to
`git ls-remote origin refs/heads/main`. When they differ and the operator did not name the
commit explicitly, the deploy prints a notice and exits 0 (outcome `skipped`).

**Why:** GitHub keeps at most one pending run per group and cancels the older pending one, so
a burst of merges collapses to the newest. The `ls-remote` check covers the rest: CI for an
older commit that finishes late. `actions/checkout` persists the job token, so `ls-remote`
works on the private repo with no extra secret.

**Rejected:** sharing the group with the drift check. A pending drift run would cancel a
pending deploy. The drift check uses its own group and a grace window instead (R7).

## R3 — Compose for dev: an override file, the base file untouched

**Decision:** `deploy/dev/compose.dev.yml`, applied after the base file:

```
docker compose -p stacks-dev -f docker-compose.yml -f deploy/dev/compose.dev.yml \
  --env-file /home/stacks/dev/.env <verb>
```

The override:

- `app.image: stacks-dev-app:${STACKS_COMMIT}` — compose tags each build with its commit.
- `app.build.labels` and `migrate.build.labels`: `org.the-stacks.env: dev` — so pruning can
  select only dev's images.
- `app.ports: !override ["127.0.0.1:${APP_PORT}:${APP_PORT}"]` — loopback only (FR-015).
- `app.env_file` and `db.env_file`: `!override [${DEV_ENV_FILE}]` — the secrets file outside
  the checkout (R4). `DEV_ENV_FILE` defaults to `/home/stacks/dev/.env`.
- A `migrate` service under `profiles: [migrate]` (R5).

`--env-file` feeds interpolation (`APP_PORT`, `DB_PORT`, `STACKS_*`); `!override` replaces the
base file's relative `env_file: .env`, which would otherwise require a `.env` in the checkout.
Compose v5.1.2 supports `!override` (added in v2.24).

**Why:** doc-0002 names one compose file; the override keeps every vm-104 fact out of the
self-hoster path (CR-002). Tagging each image by commit is what makes rollback a restart,
not a rebuild (R6).

**Rejected:** symlinking `/home/stacks/dev/.env` into the checkout as `.env` — works, but it
is an untracked file that `actions/checkout`'s clean step deletes and every manual procedure
must remember to recreate.

## R4 — Secrets live in one file on vm-104; nobody but the operator reads it

**Decision:** `/home/stacks/dev/.env`, mode `0600`, owner `stacks`, in directory
`/home/stacks/dev` (mode `0700`). It is created once by
`node scripts/deploy-dev.mjs init-secrets`, which:

- refuses when the file already exists;
- copies `.env.example`, sets `APP_PORT=3000`, `DB_PORT=5432`, `STACKS_ENV=dev`, generates
  `POSTGRES_PASSWORD` with `crypto.randomBytes(24).toString('hex')`, and writes the matching
  `DATABASE_URL`;
- prints only the path it wrote, never a value.

The deploy never prints the file, and the workflow sets no `set -x`. No GitHub secret is
needed: the job uses only the default `GITHUB_TOKEN`. A later model key (`AI_PROVIDERS`,
`*_API_KEY`) is added to the same file by the operator by hand; the runbook says how.

**Why:** implementers never see a key (runbook, Operator checkpoints). A secret file on the
one host that uses it is the smallest surface; GitHub secrets would put the password in a
second place and in every job's environment.

## R5 — Migrations run in a one-off container from the `build` stage

**Decision:** the override's `migrate` service builds the Dockerfile's existing `build`
target (`image: stacks-dev-migrate:${STACKS_COMMIT}`), sets `working_dir: /app/apps/server`,
`environment: { TEST_DATABASE_URL: "" }`, `depends_on: db (service_healthy)`, and runs
`node --experimental-strip-types scripts/migrate.ts`. The deploy runs
`docker compose ... run --rm migrate`.

**Why:** the `build` stage already holds the full source (`drizzle/`, `scripts/migrate.ts`)
and the full dependency tree, and building it costs nothing extra because the app build
already produced those layers. `migrate.ts` resolves `DATABASE_URL` (`@db:5432`) inside the
compose network, exactly as the [[migrations]] note describes for container runs. The host
needs no `pnpm install` and no pinned pnpm (vm-104's corepack resolves 12.x, not 11.10.0).
`pnpm check:host-scripts` already proves `migrate.ts`'s imports load under strip-types.

**Rejected:** host-run `pnpm --filter @the-stacks/server db:migrate` — needs a host
`node_modules` per deploy and a pnpm version the host does not have. Running migrations at
app start — changes server code for a deploy concern, and a failed migration would then take
the app down instead of leaving the old one serving.

## R6 — Deploy order and rollback: build, back up, migrate, swap, verify, else restore

**Decision:** `scripts/deploy-dev.mjs deploy <sha>` runs, stopping at the first failure:

1. **Preflight.** Docker reachable; `DEV_ENV_FILE` exists; the checkout's `HEAD` equals
   `<sha>`; stale check (R2). Nothing has changed yet.
2. **Record the previous commit.** Read `org.the-stacks.commit` from the running `app`
   container (`docker compose ps -q app` → `docker inspect`). Absent on the first deploy.
3. **Build.** `docker compose build app migrate` with `STACKS_COMMIT=<sha>`. Failure → exit 1;
   `dev` untouched (FR-009).
4. **Database up.** `up -d --wait db`. A no-op when it is already running.
5. **Backup.** `pg_dump -Fc` through `exec -T db` into
   `/home/stacks/dev/backups/<utc-timestamp>-<prev-sha7>.dump`; keep the newest 10.
   Skipped on the first deploy (empty database).
6. **Migrate.** `run --rm migrate`. Failure → exit 1; the old app is still running (FR-009).
7. **Swap.** `up -d --no-build app` with `STACKS_COMMIT=<sha>`. Compose recreates only `app`.
8. **Verify.** Poll `http://127.0.0.1:3000/health` every 3 s for up to 180 s. Success needs
   `status == "ok"` **and** `commit == <sha>` (FR-006).
9. **On verify failure: roll back.** `up -d --no-build app` with `STACKS_COMMIT=<prev>`
   (image `stacks-dev-app:<prev>` is still local), verify `<prev>` the same way, print
   `dev is serving <prev>`, exit 1 (FR-010, FR-011). With no `<prev>`, print
   `first deploy failed; dev is not serving` and exit 1.
10. **Prune.** Remove `stacks-dev-app:*` and `stacks-dev-migrate:*` tags except the current
    and the two before it; then `docker image prune -f --filter label=org.the-stacks.env=dev`.

Downtime is the few seconds of step 7 (accepted in the spec). The database container and its
volume are never recreated by a deploy. No verb in the script calls `down`, and none passes
`-v`.

**Force-unhealthy (FR-012).** With `--force-unhealthy`, step 7 adds a third file,
`deploy/dev/compose.force-unhealthy.yml`, which sets
`app.environment.DATABASE_URL: postgres://unreachable@127.0.0.1:1/none`. The app starts,
`/health` reports `degraded`, verify times out, and step 9 runs **without** that file. This
proves the real rollback path with no broken commit on `main` and no app code change. The
workflow exposes it only as a `workflow_dispatch` boolean input.

**Rollback by the operator.** `workflow_dispatch` input `commit` deploys a named commit and
implies `--allow-stale` (the operator's intent overrides R2). If `stacks-dev-app:<commit>` is
still local, step 3 is a cache hit.

**Why:** the ladder — everything is the Docker CLI plus `fetch` from Node 22 stdlib, in the
same shape as `scripts/env.mjs`. Tagging by commit (R3) makes the previous version one
`up` away. Migrations are additive (spec Assumptions), so the previous app runs on a migrated
schema, and the pre-migration dump covers the case where that assumption breaks.

**Rejected:** blue/green with two app containers and a proxy swap — zero downtime is out of
scope, and it needs a proxy container (constitution IX: no container without need).
`--wait` on `up` — it proves `status == "ok"` but not the commit, so the script polls
`/health` itself; `--wait` would add nothing.

## R7 — Drift check: hourly, on the runner, with a grace window

**Decision:** `.github/workflows/drift-dev.yml`: `schedule: cron '17 * * * *'` (hourly, off the
top of the hour) plus `workflow_dispatch`, `runs-on: [self-hosted, vm-104]`, concurrency group
`drift-dev`. It checks out `main` at depth 1 and runs
`node scripts/deploy-dev.mjs drift`, which reads `main` HEAD and its committer time from the
checkout, fetches `http://127.0.0.1:3000/health`, and exits:

- 0 `ok` — `dev` reports `main` HEAD;
- 0 `pending` — they differ, but HEAD is younger than the grace window (30 min, twice the
  SC-001 deploy budget), so a deploy may be in flight;
- 1 `drift` — they differ past the grace window, or `dev` does not answer. The message names
  expected and observed commits.

**Why:** only a tailnet machine can reach `dev`, and vm-104 is that machine. The grace window
stops a merge landing at :16 from reporting drift at :17. Hourly bounds unreported drift at
about 90 minutes (interval plus grace), which suits a dev environment.

**Known ceiling:** an offline runner cannot run its own drift check. The queued job fails at
GitHub's queue timeout, which is the signal. Spec Assumptions puts a faster off-host probe
out of scope.

## R8 — Tests: pure logic in `deploy-lib.mjs`, run in `ci:check` for free

**Decision:** `scripts/deploy-lib.mjs` holds the pure functions: `deployDecision`
(deploy/skip from sha, main HEAD, allow-stale), `driftVerdict` (ok/pending/drift),
`tagsToPrune` (keep newest 3 by creation time), and `healthMatches` (status ok and commit
equal). `scripts/deploy-lib.test.mjs` tests them, and also reads both workflow files as text
to assert: `deploy-dev.yml` has no `pull_request` trigger and has the `workflow_run` guard;
`ci.yml` never names `self-hosted`. The existing `check:scripts` glob
(`scripts/*lib.test.mjs`) runs it inside `pnpm ci:check`; no `package.json` change is needed.

**Why:** the sibling `env-lib.mjs` pattern. The Docker-touching path is proven live on vm-104
(merge condition), as `check:env` is proven locally for spec 010.

## R9 — Exposure: `tailscale serve` on tailnet port 8443, app bound to loopback

**Decision:** the operator runs, once:

```
docker exec tailscale tailscale serve --bg --https=8443 http://127.0.0.1:3000
```

`dev` is then `https://vm-104.tailb3c1b6.ts.net:8443/`. The config persists in the
container's state directory. The app publishes only on `127.0.0.1:3000` (R3); the database is
already loopback-only.

**Why 8443, not 443:** Traefik holds `0.0.0.0:443` on vm-104. With `serve` on 443,
tailscaled would take tailnet traffic to port 443 away from Traefik, which could break
whatever the tailnet reaches through Traefik today. 8443 is one of the ports `tailscale
serve` supports for HTTPS and is free. Moving to 443 later is a one-line operator change,
listed as an open question.

**Why loopback:** AC #5 says "from nowhere else". The container runs on the host network, so
it reaches `127.0.0.1:3000`; the LAN does not. No firewall rule is needed.

**Prerequisite:** HTTPS certificates must be enabled for the tailnet (admin console, DNS page).
If `serve` reports they are off, the operator enables them; this is outside vm-104.

**Rejected:** `tailscale funnel` — public (FR-016). A Traefik route — public-facing proxy,
and the Cloudflare path is out of scope.
