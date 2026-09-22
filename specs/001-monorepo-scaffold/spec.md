# 001 — Monorepo scaffold and toolchain baseline

**Board task:** TASK-0010 · **Milestone:** M0 · **Sweep:** Lane 1
**Binding sources:** `docs/design/architecture.md` A1 (stack table),
`.specify/memory/constitution.md` v1.0.0 (Architecture Constraints)

## Problem

This repository has no code. It holds design documents, a board, Spec Kit
scaffolding, and Claude configuration — nothing executable. Every other M0 task
writes inside a workspace that does not exist yet.

That makes this task unusual in the sweep: it fixes conventions rather than
implementing behavior. Package layout, TypeScript configuration, and the lint
baseline established here are inherited by every subsequent task and are
expensive to change once six other tasks have built on them.

The scope is deliberately the skeleton only. No server, no database, no client
code. Those are TASK-0013, TASK-0012, and TASK-0016 respectively. A reviewer
should be able to read this PR and see only structure.

## Requirements

Requirements map 1:1 to the board card's acceptance criteria.

### R1 — pnpm workspaces + Turborepo with a working pipeline (AC#1)

The repository root MUST declare a pnpm workspace and a Turborepo pipeline.

- `pnpm-workspace.yaml` declares the package globs.
- `turbo.json` declares, at minimum, the tasks `build`, `lint`, `typecheck`,
  and `test`, with dependency ordering (`^build`) where it applies.
- Running a pipeline task from the root fans out to every workspace package
  that defines it, and succeeds on a clean tree.

"A working task pipeline" means the fan-out is real: a task defined in two
packages runs in both from one root invocation.

### R2 — Workspace packages for server, web, and at least one shared (AC#2)

Three packages MUST exist:

- `apps/server` — the Node application. Placeholder only in this task; its
  entrypoint arrives in TASK-0013.
- `apps/web` — the React SPA. Placeholder only; its shell arrives in TASK-0016.
- `packages/shared` — code shared across both. This package is what makes the
  Zod-schemas-as-single-source rule (constitution II) mechanically possible, so
  it is not optional scaffolding.

Each package has its own `package.json` with a workspace-scoped name, and its
own `tsconfig.json` participating in the project-references graph.

The placeholders MUST be real enough to typecheck, lint, and build — an empty
directory does not prove the pipeline works. A single exported constant or type
per package is sufficient and preferred over inventing structure that later
tasks would have to undo.

### R3 — TypeScript strict mode across every package (AC#3)

- A root `tsconfig.base.json` (or equivalent) sets `strict: true`, and every
  package's `tsconfig.json` extends it.
- TypeScript project references wire the packages so `apps/server` and
  `apps/web` can consume `packages/shared` with correct build ordering.
- `pnpm typecheck` from the root passes across all three packages.

Strict mode is not negotiable and is not to be relaxed per-package. A package
that cannot satisfy it is a design problem to raise, not a flag to disable.

### R4 — Lint and format from the root, passing clean (AC#4)

- A linter and a formatter are configured at the root and apply to every
  package.
- `pnpm lint` and the format check both pass on the tree this task produces.
- The configuration is shared, not duplicated per package.

Tool choice is the implementer's, with one constraint: it must run from the
root over all workspaces in one invocation, and it must not require a
per-package copy of the config.

### R5 — Node 22 pinned (AC#5)

- The Node version is pinned so every contributor and every container agrees:
  an `engines` field in the root `package.json`, plus a version file
  (`.nvmrc` or equivalent).
- The pinned major version is 22, per architecture A1 and the constitution's
  Architecture Constraints table.

This matters beyond tidiness: TASK-0011 builds a container image against this
pin, and a drift between local and container Node is the kind of bug that
costs a day to find.

## Out of scope

- Any server, database, or client implementation.
- CI configuration — that is TASK-0017, deliberately out of this sweep.
- Docker and compose — that is TASK-0011.
- The cross-plane boundary check (constitution III). M0 creates only the
  Session plane; the check lands with CI.

## Acceptance evidence

Because no CI exists yet (see the runbook's gate section), the PR body MUST
carry the actual terminal output of:

```
pnpm install
pnpm typecheck
pnpm lint
pnpm build
```

Asserting these pass is not evidence. The output is.

## Constitution alignment

- **IX (Self-hostable by default)** — the Node pin here is what makes the
  container in TASK-0011 reproducible.
- **Architecture Constraints** — pnpm workspaces, Turborepo, Node 22, and
  TypeScript end-to-end are all ratified rows in that table. This task
  implements them; it does not choose them.
- **II (Content is a contract)** — `packages/shared` exists so schemas can be
  single-source later. Nothing in M0 uses it yet; the seam is what matters.
