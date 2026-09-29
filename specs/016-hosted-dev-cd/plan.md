# Implementation Plan: Hosted dev environment on vm-104 with CD from main

**Branch**: `task-0021-hosted-dev-cd` | **Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/016-hosted-dev-cd/spec.md`

## Summary

Two new workflows and one stdlib Node script put `main` on vm-104. `deploy-dev.yml` runs on
the self-hosted runner `vm-104` only after CI succeeds for a push to `main`
(`workflow_run`), serialized, skipping stale commits. `scripts/deploy-dev.mjs` builds a
commit-tagged image, backs up the database, runs migrations in a one-off container, swaps
the app, and verifies `/health` reports `ok` and the new commit; otherwise it restarts the
previous commit's image and fails the job. A compose override keeps every vm-104 fact out of
the self-hoster path and binds the app to loopback. `drift-dev.yml` checks hourly.
`tailscale serve` on tailnet port 8443 is the only way in. A runbook covers deploy,
rollback, backup, and restore. Details: [research.md](research.md) R1–R9.

## Technical Context

**Language/Version**: Node 22 (`.nvmrc`; vm-104 host has v22.22.2), plain ESM scripts; YAML
for workflows and the compose override.

**Primary Dependencies**: none new. Node stdlib (`node:child_process`, `node:fs`,
`node:crypto`, global `fetch`), the Docker CLI with Compose v5.1.2, `git`,
`actions/checkout@v4` (already used by `ci.yml`).

**Storage**: Docker named volume `stacks-dev_db-data`; `pg_dump` files under
`/home/stacks/dev/backups/`; secrets file `/home/stacks/dev/.env`.

**Testing**: Node `--test` for `scripts/deploy-lib.mjs` and workflow-file invariants, picked up
by the existing `check:scripts` glob in `pnpm ci:check`. The Docker path is proven live on
vm-104 by the merge condition (one real deploy, one forced-unhealthy deploy).

**Target Platform**: vm-104 (Ubuntu, kernel 6.8, Docker 29.4.0), runner user `stacks`.

**Project Type**: deployment tooling. No application code changes.

**Performance Goals**: a deploy finishes within 15 minutes of CI finishing (SC-001); the swap
interrupts `dev` for seconds only.

**Constraints**: nothing outside project `stacks-dev` is touched on vm-104; no `down -v`;
no secret in the repo, a log, or an implementer's context; deploy code never runs from a pull
request; `docker compose up` from a clean clone is unchanged.

**Scale/Scope**: one environment, one runner, one operator plus tailnet players.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Agent-operable** — every operation is a `workflow_dispatch` (drivable with
      `gh workflow run`) or a non-interactive `deploy-dev.mjs` verb with documented exit
      codes. The only human-only steps are the one-time operator checkpoints below.
- [x] **II. Content contract** — no codex entity. Not applicable.
- [x] **III. Data planes** — adds no application state. Backups copy the whole database
      as-is; no plane is crossed in code.
- [x] **IV. Event sourcing** — no play state change. Backups and restores move the event log
      whole; restore is an operator action on a dev environment, documented as such.
- [x] **V. Citations** — no library claim. Not applicable.
- [x] **VI. System-agnostic** — no mechanics. Not applicable.
- [x] **VII. Structured first** — no generated artifact. Not applicable.
- [x] **VIII. Operator-owned content** — ships none. `dev`'s volume and backups stay on
      vm-104; backups are never uploaded as workflow artifacts (CR-003).
- [x] **IX. Self-hostable** — `docker-compose.yml` and `Dockerfile` are unchanged; the
      override and scripts are opt-in files a self-hoster never runs; no new container in the
      app topology (the `migrate` one-off is profile-gated and dev-only); no new dependency.

**Stack conformance** — within the Architecture Constraints table. The script is tooling
beside `scripts/env.mjs`; the workflows sit beside `ci.yml`.

**Post-design re-check (after Phase 1)**: unchanged — all nine pass.

## Design decisions (where each concern is settled)

- **Rollback keeps the previous version serving** (R6). Build and migrate run while the old
  app serves. Only then does compose recreate `app` from `stacks-dev-app:<sha>`. If `/health`
  does not report `ok` and `<sha>` within 180 s, the script recreates `app` from
  `stacks-dev-app:<prev>`, which is still a local image, verifies it, and fails the job.
  Build or migration failure never touches the running app.
- **Secrets on the runner** (R4). One file, `/home/stacks/dev/.env`, `0600`, created by the
  operator with `init-secrets`, which generates the password and prints only the path. The
  workflows use no GitHub secret. Implementers never read, print, or commit it; no task in
  `tasks.md` opens it.
- **Dev data persists** (R3, R6). Named volume `stacks-dev_db-data`. No verb runs
  `compose down` or passes `-v`; the deploy recreates only `app`. A `pg_dump` precedes every
  migration.
- **Drift schedule** (R7). Hourly at minute 17 (`17 * * * *`), plus on demand; 30-minute
  grace window.
- **Ops runbook** (AC #6): `docs/ops/dev-vm-104.md`.
- **Exposure** (R9): `https://vm-104.tailb3c1b6.ts.net:8443/`, app on `127.0.0.1:3000`.

## Operator checkpoints

These are the only commands in this feature that change vm-104 outside `/home/stacks`, or
that place a secret. The implementer names each one, stops, and runs it only after the
operator says yes. The implementer may instead hand the command to the operator to run.

1. **Secret placement** (inside `/home/stacks`, but it creates the secret). From a checkout
   of this branch on the operator's Mac:
   `git archive HEAD scripts/deploy-dev.mjs scripts/deploy-lib.mjs .env.example | ssh stacks@vm-104.tailb3c1b6.ts.net 'mkdir -p /home/stacks/dev/bootstrap && tar -x -C /home/stacks/dev/bootstrap && cd /home/stacks/dev/bootstrap && node scripts/deploy-dev.mjs init-secrets'`
   It prints the path only. Nobody reads the file back into a transcript. This runs before
   the first deploy, whose preflight fails without the file.
2. **`tailscale serve` config inside the shared `tailscale` container** (outside
   `/home/stacks`; the state lives in `/home/evan/config/tailscale`). Run as `stacks` (in the
   `docker` group) or `evan`:
   `ssh stacks@vm-104.tailb3c1b6.ts.net 'docker exec tailscale tailscale serve --bg --https=8443 http://127.0.0.1:3000'`
   Verify: `docker exec tailscale tailscale serve status`.
   Undo: `docker exec tailscale tailscale serve --https=8443 off`.
   If `serve` reports that HTTPS certificates are disabled, the operator enables them in the
   tailnet admin console (DNS page). That change is outside vm-104.
3. **The first real deploy to `dev` is announced to the operator before it runs.** The
   implementer states the commit and the command (`gh workflow run deploy-dev.yml` or the
   merge that triggers it) and waits for a yes. The forced-unhealthy proof run is announced
   the same way.

Nothing else in this feature runs as a user other than `stacks`, uses sudo, edits files
outside `/home/stacks`, or touches another compose project.

## Project Structure

### Documentation (this feature)

```text
specs/016-hosted-dev-cd/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── deploy-cli.md
│   └── workflows.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
.github/workflows/
├── ci.yml                         # unchanged
├── deploy-dev.yml                 # new — workflow_run on CI (main, success) + dispatch
└── drift-dev.yml                  # new — hourly + dispatch
deploy/dev/
├── compose.dev.yml                # new — image tags, loopback app port, env_file override, migrate service
└── compose.force-unhealthy.yml    # new — FR-012 proof only
scripts/
├── deploy-dev.mjs                 # new — deploy, drift, backup, restore, status, init-secrets
├── deploy-lib.mjs                 # new — pure decisions (stale, drift verdict, prune set, health match)
└── deploy-lib.test.mjs            # new — unit + workflow invariants (runs via check:scripts)
docs/ops/dev-vm-104.md             # new — the ops runbook (AC #6)
docs/wiki/hosted-dev.md            # new — wiki note for hosted dev and CD
```

**Structure Decision**: scripts sit in root `scripts/` beside `env.mjs`, whose `*lib.test.mjs`
glob already runs in `ci:check`; vm-104-only compose files sit in `deploy/dev/` so the
self-hoster path never sees them.

## Complexity Tracking

No violations.

## Open questions (for the operator; none block implementation)

- **Port 443 vs 8443.** Plan uses 8443 because Traefik owns `:443` on vm-104. Moving `dev` to
  `https://vm-104.tailb3c1b6.ts.net/` is a one-line change if tailnet `:443` is free for it.
- **Drift cadence.** Hourly is the plan's default; say if a different interval is wanted.
- **Merge-condition ordering.** `workflow_run` and `workflow_dispatch` both run only once
  `deploy-dev.yml` exists on `main`, so "one real deploy from a `main` push" cannot happen
  before this PR merges. Plan: before merge, prove both paths by running
  `scripts/deploy-dev.mjs deploy` by hand on vm-104 as `stacks` from the branch checkout
  (real deploy + `--force-unhealthy`), recorded in the PR. After merge, the merge commit's
  own push deploys `dev`; that run and a dispatched `force_unhealthy` run are the two
  recorded run URLs, and the card closes only then. The operator rules whether the
  pre-merge proof suffices to merge.
