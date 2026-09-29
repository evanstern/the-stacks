---
id: doc-0002
title: Runtime environments — proposal
type: specification
created_date: '2026-09-29 02:35'
tags:
  - infra
  - decisions
  - m-1
---
# Runtime environments — proposal

Status: **proposed 2026-09-28**, awaiting operator ruling (backs decision-0006).
Gate: TASK-0020 and TASK-0021 start only after this is ratified.

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
| `main` (local) | operator Mac | `main` | `stacks-main` | 3000 / 5432 |
| worktree | operator Mac | its task branch | `stacks-task-<n>` | 3000+n / 15000+n |

`dev` is the hosted environment. It is not local dev mode.

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

One script, `scripts/env.mjs`, with four verbs:

- `up` — derive project name and ports from the worktree, write the worktree's `.env` from
  `.env.example`, refuse if a port is taken, then `docker compose -p <project> up -d --build`.
- `down` — `docker compose -p <project> down -v`. Worktree data is disposable.
- `status` — list every `org.the-stacks.*` stack with its worktree, branch, and commit.
- `prune` — stop stacks whose worktree no longer exists. `prune --check` only reports and
  exits nonzero on any orphan.

Worktree removal runs `env down` first. The sweep's merge-cleanup step gains that call.

## Orphan gates

- `env prune --check` runs in the sweep precondition gate and in the post-merge cleanup.
- A Claude Code Stop hook warns when an orphan exists.
- A test asserts `up` then `down` leaves no container, network, or volume behind.

## CD to `dev` (vm-104)

**Proposal: a GitHub Actions self-hosted runner on vm-104.** On push to `main`, after CI
passes, a deploy job on that runner checks out the commit, runs `compose up --build`, runs
migrations, and waits for `/health` to report the new commit. A failed health check leaves
the previous containers running and fails the job.

Why: the repo is private, the runner connects outbound only, and vm-104 needs no inbound
port. Alternatives considered:

- A timer on vm-104 that polls `origin/main`. Simpler, but deploys are invisible to GitHub
  and a failure alerts nobody.
- A GitHub-hosted runner joining the tailnet and SSHing in. Needs a tailnet auth key in
  GitHub secrets and an SSH key on vm-104.

A scheduled drift check compares `dev`'s `/health` commit to `main` HEAD and fails when they
differ.

## Exposure

- **Now:** tailnet only, via `tailscale serve` for HTTPS on the tailnet hostname.
- **Later:** a Cloudflare tunnel to `the-stacks.infinitynode.media` when a player outside
  the tailnet needs access. That step needs its own decision (auth hardening, invite flow,
  rate limits) and is not part of this proposal.

## Open questions for the operator

1. CD mechanism: self-hosted runner (proposed), polling timer, or tailnet SSH?
2. Is a local `main` stack on the Mac still wanted once `dev` exists on vm-104?
3. vm-104 did not answer SSH from this Mac on 2026-09-28 (timeout on the tailnet name). Is it
   up, and does it already run Docker?
