---
title: Worktree Environments
status: active
owner: docs
created: 2026-07-10
updated: 2026-07-10
tags:
  - wiki
  - v3
  - operating-model
  - environments
---

# Worktree Environments

The per-worktree environment protocol (spec 009): how every checkout in the bare +
sibling-worktree layout gets an isolated, deterministic, collision-free stack. This
page is the durable operating-model record; the normative contract is
[specs/009-library-surface-env/contracts/environment.md](../../specs/009-library-surface-env/contracts/environment.md)
(supersedes 007's environment contract).

## The rule

A worktree's compose identity and port block derive from its **directory name alone**:

| Value | `main/` (fixed point) | `NNN-slug` worktree |
|---|---|---|
| `COMPOSE_PROJECT_NAME` | `the-stacks-v3` | `the-stacks-<dirname>` |
| web / api / ml / postgres | 4400 / 4401 / 4402 / 5442 | each `+ 10×NNN` |

Feature numbers are unique by spec-kit construction, so derived blocks cannot collide
— **determinism replaces registration**. Worktree `009-library-surface-env` ⇒
4490/4491/4492/5532, project `the-stacks-009-library-surface-env`.

## The tool

```bash
node scripts/mint-worktree-env.mjs --secrets-from ../main/.env   # mint a worktree .env
node scripts/mint-worktree-env.mjs --check                       # drift report (exit 2 on drift)
```

Self-enforcing by construction: refuses to overwrite an existing `.env` without
`--force`, refuses sibling port collisions **by name at mint time**, copies secrets
verbatim (never invents them), and derives the port-coupled values —
`API_INTERNAL_URL` moves with the api port (the api container binds `V3_API_PORT`
*inside* the container), while `EMBEDDING_ENDPOINT` and `DATABASE_URL` stay
container-internal and never move. The derivation math lives in
`scripts/worktree-env-lib.mjs`, unit-tested in `pnpm verify`.

Deliberate overrides are legitimate: recorded in that worktree's `.env`, reproducible
from documentation, kept out of derived blocks (manual ports ≥ 10000 — the historical
web-on-4500 instance sits exactly on feature 010's derived web port, which is why the
rule exists).

## Lifecycle

Compose project identity is the isolation boundary — lifecycle commands act only on
the project named in the current worktree's `.env`:

- `docker compose up -d --build --wait` / `down` — this worktree only; `down` keeps
  volumes (data survives).
- `docker compose down --volumes` — full teardown, **required before**
  `git worktree remove` at retirement; zero residue is an acceptance criterion.

Proven live in the 009 cycle: `main/` and `009-*` stacks ran concurrently with fully
disjoint container/port/volume sets, and tearing one down (volumes included) left the
other serving.
