# 001 — Tasks

**Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md) · **Board:** TASK-0010

Phases are dispatch boundaries: one fresh implementer per phase, re-grounded
from this spec directory and the branch's commits.

## Phase 1 — Workspace root

- [x] Root `package.json`: private, `packageManager` pinned (pnpm), `engines.node` set to 22
- [x] `pnpm-workspace.yaml` declaring `apps/*` and `packages/*`
- [x] `.nvmrc` pinning Node 22
- [x] `.gitignore` covers `node_modules/`, build output, and the Turborepo cache
- [x] `pnpm install` succeeds at the root

## Phase 2 — TypeScript baseline

- [x] `tsconfig.base.json` with `strict: true` and shared compiler options
- [x] Project-references wiring so `apps/*` can consume `packages/shared` in build order
- [x] Root `typecheck` script defined
- [x] `pnpm typecheck` passes

## Phase 3 — The three packages

- [x] `packages/shared`: `package.json`, `tsconfig.json` extending the base, one minimal real export
- [x] `apps/server`: `package.json`, `tsconfig.json`, placeholder importing the shared export
- [x] `apps/web`: `package.json`, `tsconfig.json`, placeholder importing the shared export
- [x] All three packages typecheck; the shared import resolves through project references
- [x] No server, database, or client implementation added (that is TASK-0013 / 0012 / 0016)

## Phase 4 — Pipeline and lint baseline

- [ ] `turbo.json` declaring `build`, `lint`, `typecheck`, `test` with `^build` ordering
- [ ] Root lint configuration covering every workspace from one invocation
- [ ] Root format configuration, shared not duplicated
- [ ] Root scripts fan out: `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`
- [ ] `test` task exits 0 on a tree with no tests yet
- [ ] Full run green: `pnpm install && pnpm typecheck && pnpm lint && pnpm build`
- [ ] Terminal output of that run captured for the PR body (stands in for CI until TASK-0017)
