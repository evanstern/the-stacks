---
name: hosted-dev
description: The vm-104 `dev` environment (TASK-0021, spec 016) — CD from `main` via a self-hosted runner, `scripts/deploy-dev.mjs`'s deploy/status/drift/backup/restore/init-secrets verbs, the swap-then-rollback design, hourly drift checking, and tailnet-only exposure. Load for hosted-dev, deploy, rollback, or "how does CD reach vm-104" questions.
kind: pipeline
sources:
  - scripts/deploy-dev.mjs
  - scripts/deploy-lib.mjs
  - deploy/dev/compose.dev.yml
  - deploy/dev/compose.force-unhealthy.yml
  - .github/workflows/deploy-dev.yml
  - .github/workflows/drift-dev.yml
  - docs/ops/dev-vm-104.md
verified_against: 1c0ef6edebe8b43bdc76969fd4bbe5bcae69209d
---

# Hosted dev (vm-104)

`dev` is a real, always-on Docker Compose stack on vm-104, running as user `stacks`,
continuously deployed from `main`. It reuses [[compose-stack]]'s two services (`app`, `db`)
under a vm-104-only override rather than a parallel definition.

## How it works

**Trigger.** `.github/workflows/deploy-dev.yml` runs on `[self-hosted, vm-104]`, triggered by
`workflow_run` after [[ci-pipeline]]'s `CI` workflow completes successfully on a push to
`main`, or by `workflow_dispatch` — **never** on `pull_request` (a fork PR can't reach
vm-104's runner). `workflow_run` always executes the workflow file from the default branch,
so a PR can never change what this file does. `concurrency: { group: deploy-dev,
cancel-in-progress: false }` queues overlapping runs instead of racing them.

**The CLI.** `scripts/deploy-dev.mjs` (stdlib + Docker CLI, spawnSync style of
`scripts/env.mjs`; see [[runtime-stacks]]) implements every verb; `scripts/deploy-lib.mjs` is
its dependency-free pure logic (`deployDecision`, `healthMatches`, `driftVerdict`,
`tagsToPrune`, `renderDevEnv`), unit-tested by `scripts/deploy-lib.test.mjs` under
`check:scripts` — see [[ci-pipeline]] — without Docker or vm-104. The compose invocation
layers `deploy/dev/compose.dev.yml` on top of the base `docker-compose.yml` (see
[[compose-stack]]): a fixed `env_file` at `/home/stacks/dev/.env` in place of a checkout-local
`.env`, `app`'s image tagged `stacks-dev-app:${STACKS_COMMIT}` so rollback is a restart rather
than a rebuild, `app`'s port rebound to `127.0.0.1` only, and a `migrate` profile service built
from the Dockerfile's `build` stage (already holding `drizzle/` and the full dependency tree,
so the host needs no pnpm install).

- `deploy <sha> [--allow-stale] [--force-unhealthy]`: skips a push-triggered deploy whose sha
  isn't `main` HEAD (`deployDecision`, unless `--allow-stale`, which `workflow_dispatch`'s
  `commit` input implies) — a stale push shouldn't undo a newer one still building. Otherwise:
  build `app`+`migrate`, bring up `db`, back up the database (see Backups below) if a previous
  deploy exists, run the one-off `migrate` container, then swap `app` to the new image. Poll
  `GET /health` for up to 180s (`healthMatches`: `status === "ok" && commit === sha`) — see
  [[health-check]]. `--force-unhealthy` layers `deploy/dev/compose.force-unhealthy.yml` (a
  broken `DATABASE_URL`) onto the swap step only, to prove the rollback path without a real
  broken commit.
- `status`: prints the running commit, the `/health` body, the `stacks-dev-*` image tags, and
  the newest backups.
- `drift`: no Docker — `driftVerdict` compares `main` HEAD to `/health`'s `commit`. An
  unreachable `dev` (`observed === null`) is always `"drift"`, never `"pending"`.
- `backup [--name <label>]` / `restore <file> --yes`: `pg_dump -Fc` to
  `/home/stacks/dev/backups/`, mode `0600`; `restore` requires `--yes`, stops `app`,
  `pg_restore --clean --if-exists`, restarts `app`, and re-verifies `/health`.
- `init-secrets`: renders `/home/stacks/dev/.env` (mode `0600`) from `.env.example` plus a
  generated Postgres password (`renderDevEnv`); refuses if the file already exists.

## Rollback design

A failed swap is not a blind revert: `deploy` rolls back to the previous commit's already-built
image (no rebuild) and re-verifies `/health` against it, only then exiting 1. This costs a
brief restart window, not zero downtime — restarting the previous `app` container takes a few
seconds, observed as ~3s uptime immediately after rollback (TASK-0021 T011 proof) — but never
leaves `dev` serving a commit that failed its own health check.

## Drift check

`.github/workflows/drift-dev.yml` runs `node scripts/deploy-dev.mjs drift` hourly at `:17`
(off the top of the hour, so a merge landing at `:16` doesn't false-positive before the next
deploy has run) with a 30-minute grace window inside `driftVerdict` — a commit younger than
that reports `"pending"`, not `"drift"`, so the check doesn't fire before CI+deploy for that
commit has had time to finish.

## Exposure

`dev` is tailnet-only: `tailscale serve --bg --https=8443 http://127.0.0.1:3000`, run inside
the shared `tailscale` Docker container on vm-104 (not this repo's compose stack), publishes
`https://vm-104.tailb3c1b6.ts.net:8443` to tailnet devices only. `app` itself still binds only
`127.0.0.1:3000` (see [[compose-stack]]) — the LAN and vm-104's other tailnet IPs can't reach
it even if `serve` were misconfigured. **Gotcha:** the first HTTPS request after running
`serve` waits — observed ~30s (TASK-0021 T015) — for Tailscale to issue the certificate
(`SetDNS`/ACME); a short client timeout (e.g. `curl`'s default or a 15s one) fails before
issuance finishes. Retry rather than treat that first failure as a misconfiguration.

## Secrets and backups

Secrets live only in `/home/stacks/dev/.env`, mode `0600`, never printed or committed; adding
a key means editing that file on vm-104 by hand and redeploying to pick it up. Every deploy
backs up the database before migrating; `backup` also runs on demand. Non-manual backups are
pruned to the newest 10; a `--name <label>` backup is never auto-pruned. `deploy` also prunes
`stacks-dev-app`/`stacks-dev-migrate` images down to the current plus 2 previous tags
(`tagsToPrune`) after a successful deploy — best-effort, never fails the deploy.

## Connections

Layers on [[compose-stack]] and [[container-image]] rather than redefining them. Shares
`scripts/env-lib.mjs`'s `mergeEnvFile`/`parseEnvKeys` with [[runtime-stacks]]. Its deploy
success signal is [[health-check]]'s `commit` field. Covered by [[ci-pipeline]]'s
`check:scripts` via `scripts/deploy-lib.test.mjs`. Full runbook: `docs/ops/dev-vm-104.md`
(deploy, rollback, backup, restore, inspect, secrets, exposure, destroy, failure triage).

## Operational notes

`deploy-dev.mjs` refuses to run (exit 2) if Docker is unreachable, the secrets file is
missing, or the checked-out `HEAD` doesn't match the requested sha — these are environment
errors, distinct from a failed deploy (exit 1, `dev` still serving something) or a stale
push skip (exit 0). The `destroy` runbook step (`down -v`) is the only command anywhere in
`dev`'s tooling that removes the database volume.
