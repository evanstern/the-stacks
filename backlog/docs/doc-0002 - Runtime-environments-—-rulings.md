---
id: doc-0002
title: Runtime environments — rulings
type: specification
created_date: '2026-09-29 02:35'
updated_date: '2026-09-29 02:43'
tags:
  - infra
  - decisions
  - m-1
---
# Runtime environments — rulings

Status: **ratified 2026-09-28** — operator accepted the proposal with the amendments below
(backs decision-0006). Cards: TASK-0020 (per-worktree stacks), TASK-0021 (hosted dev + CD).

## Problem

Today one compose stack exists, with fixed names and ports (`APP_PORT=3000`, `DB_PORT=5432`,
volume `db-data`). Two worktrees running `docker compose up` collide on ports and share a
compose project named after the directory. Parallel sweep lanes in M1 each need a database.
Nothing tracks which containers belong to which worktree, so a removed worktree leaves its
stack running.

## Environments

| Name | Where | Pinned to | Compose project | Ports (app / db) |
|---|---|---|---|---|
| `dev` | vm-104 | `main`, deployed by CD | `stacks-dev` | 3000 / loopback 5432 |
| `main` (ad hoc) | operator Mac, on demand | `origin/main` | `stacks-main` | 3000 / 5432 |
| worktree | operator Mac | its task branch | `stacks-task-<n>` | 3000+n / 15000+n |

`dev` is the hosted environment and the always-on `main` app. It is not local dev mode.
**Amendment (operator):** no always-on `main` stack runs on the Mac. One command starts a
local `main` stack ad hoc (`pnpm env:main`), built from a fresh `origin/main` checkout so it
never runs a stale or dirty tree. `env down main` stops it.

## Branching

- `main` is the only long-lived branch. `dev` always runs `main` HEAD after green CI.
- Task branches live in `.worktrees/task-<n>` (unchanged).
- No release branch before V1. V1 adds tags; `dev` keeps tracking `main`.

## Naming convention

- Compose project name: `stacks-<env>`, where `<env>` is `dev`, `main`, or the worktree
  directory name (`task-0020`). Compose prefixes every container, network, and volume with it.
- Every container carries labels `org.the-stacks.env=<env>`, `org.the-stacks.worktree=<abs
  path>`, and `org.the-stacks.commit=<sha>`.
- The app reports its commit at `/health` so any environment can prove what it runs.

## Setup and teardown

One script, `scripts/env.mjs`, exposed through `pnpm env:*`:

- `up` — derive project name and ports from the worktree, write the worktree's `.env` from
  `.env.example`, refuse if a port is taken, then `docker compose -p <project> up -d --build`.
- `main` — ad hoc local `main` stack from a fresh `origin/main` checkout (see Environments).
- `down` — `docker compose -p <project> down -v`. Worktree data is disposable.
- `status` — list every `org.the-stacks.*` stack with its worktree, branch, and commit.
- `prune` — stop stacks whose worktree no longer exists. `prune --check` only reports and
  exits nonzero on any orphan.

Worktree removal runs `env down` first. The sweep's merge-cleanup step gains that call.

## Orphan gates

- `env prune --check` runs in the sweep precondition gate and in the post-merge cleanup.
- A Claude Code Stop hook warns when an orphan exists.
- A test asserts `up` then `down` leaves no container, network, or volume behind.

## CD to `dev` (vm-104) — ACCEPTED: self-hosted runner

A GitHub Actions self-hosted runner on vm-104, registered to `evanstern/the-stacks`. On push
to `main`, after CI passes, a deploy job on that runner checks out the commit, runs
`compose up --build`, runs migrations, and waits for `/health` to report the new commit. A
failed health check leaves the previous containers running and fails the job.

A scheduled drift check compares `dev`'s `/health` commit to `main` HEAD and fails when they
differ.

## vm-104 survey (2026-09-28, read-only, as `evan` over `vm-104.local.infinity-node.win`)

- Host `infinity-node-openclaw`: Ubuntu, kernel 6.8, 8 vCPU, 20 GiB RAM.
- Docker 29.4.0 and Compose v5.1.2 installed.
- **Disk: 95% used (11 GiB free of 195 GiB).** Too tight for image builds plus a Postgres
  volume plus benchmark runs. Must be resolved before deploy.
- **`evan` is not in the `docker` group** (members: `openclaw`, `coda`); sudo needs a password.
- **A runner exists, but for another repo:** `actions.runner.evanstern-fabrique.fabrique-host`.
  Repo-scoped runners on a personal account do not serve other repos, so the-stacks needs its
  own registration. The fabrique runner's install is the template.
- **Tailscale is broken on the VM:** `tailscaled` is running but its socket
  `/var/run/tailscale/tailscaled.sock` is missing, so the CLI cannot reach it. This is the
  likely reason SSH over the tailnet name times out. LAN SSH works.

## Operator prerequisites (need sudo on vm-104)

1. Free disk to at least 40 GiB available, or grow the volume.
2. Create a dedicated `stacks` service user in the `docker` group to own the runner and stack.
3. Register a runner for `evanstern/the-stacks` under that user, labeled `vm-104`.
4. Repair `tailscaled` (restart the service; check its socket path) and confirm tailnet SSH.

## Exposure

- **Now:** tailnet only, via `tailscale serve` for HTTPS on the tailnet hostname. Blocked on
  prerequisite 4. LAN access at `vm-104.local.infinity-node.win` works meanwhile.
- **Later:** a Cloudflare tunnel to `the-stacks.infinitynode.media` when a player outside
  the tailnet needs access. That step needs its own decision (auth hardening, invite flow,
  rate limits).
