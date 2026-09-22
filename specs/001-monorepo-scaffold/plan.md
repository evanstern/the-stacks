# 001 — Implementation plan

**Spec:** [spec.md](spec.md) · **Board task:** TASK-0010

## Constitution Check (gate — run before Phase 0)

Checked against `.specify/memory/constitution.md` **v1.0.0 (ratified
2026-09-22)**. The constitution is present and ratified, so this gate is real.

| Principle | Bearing on this task | Verdict |
|---|---|---|
| I — Agent-operable by construction | No feature surface here. The pipeline is CLI-driven, which is agent-drivable by nature. | Pass (n/a) |
| II — Content is a contract | No entities yet. `packages/shared` is created as the seam where single-source Zod schemas will live. | Pass |
| III — Three data planes | No state. Nothing to place in a plane. | Pass (n/a) |
| IV — Event-sourced play | No events yet (TASK-0012). | Pass (n/a) |
| V — Grounded claims | No retrieval. | Pass (n/a) |
| VI — System-agnostic core | No mechanics. Package layout must not presume a system module; `packages/shared` stays generic. | Pass |
| VII — Structured before styled | No generated artifacts. | Pass (n/a) |
| VIII — Operator-owned content | No content shipped. Confirm no rulebook fixtures land in any package. | Pass |
| IX — Self-hostable by default | The Node 22 pin is a direct input to the container in TASK-0011. | Pass |

**Architecture Constraints table:** this task implements ratified rows (pnpm
workspaces + Turborepo, Node 22, TypeScript end-to-end). It introduces no
language, service, or datastore.

**Complexity Tracking:** empty. No violation to justify.

**Post-design re-check:** the design below adds no dependency beyond the
toolchain the table already binds, so the gate holds after Phase 1.

## Approach

The governing constraint is that six later tasks build inside whatever this
produces. That argues for the smallest correct structure, not the most
featureful one — every convention invented here is one a later task may have
to work around.

Three decisions worth stating, because they are the ones a later task would
pay for:

1. **Placeholders are minimal but real.** Each package exports one trivial
   symbol so the pipeline demonstrably runs over it. Inventing directory trees
   (`src/routes/`, `src/db/`) ahead of the tasks that own them would be
   guessing at their shape; TASK-0013 and TASK-0016 create their own.
2. **`packages/shared` is created now, empty of meaning.** It costs almost
   nothing here and is awkward to retrofit once two apps exist. Constitution II
   requires schemas be single-source across API, agent tool definitions, and
   client forms — that requires a shared package to exist first.
3. **Config is rooted, not per-package.** One lint config, one formatter
   config, one `tsconfig.base.json`. Per-package copies drift.

## Phases

### Phase 1 — Workspace root

Root `package.json` (private, `packageManager` pinned, `engines.node` set to
22), `pnpm-workspace.yaml` with the package globs, `.nvmrc`, `.gitignore`
additions for `node_modules/`, build output, and Turborepo's cache.

Exit: `pnpm install` succeeds at root with no packages yet defined beyond the
globs.

### Phase 2 — TypeScript baseline

`tsconfig.base.json` with `strict: true` and the compiler options every package
inherits; project-references wiring so `apps/*` can consume
`packages/shared` with correct build ordering.

Exit: `pnpm typecheck` passes (trivially — no packages yet).

### Phase 3 — The three packages

`apps/server`, `apps/web`, `packages/shared`: each with `package.json`,
`tsconfig.json` extending the base, and one minimal real export. `apps/server`
and `apps/web` each import the shared symbol, which is what proves the
references graph works rather than merely existing.

Exit: all three packages typecheck and build; the shared import resolves.

### Phase 4 — Pipeline and lint baseline

`turbo.json` with `build`, `lint`, `typecheck`, `test` and `^build` ordering.
Root lint + format config covering all workspaces. Scripts in the root
`package.json` so `pnpm lint` / `pnpm typecheck` / `pnpm build` / `pnpm test`
fan out.

Exit: every root script runs green over all three packages, and the output is
captured for the PR body.

## Risks

- **Turborepo + pnpm version drift.** Pin both (`packageManager` field) so the
  container in TASK-0011 resolves the same versions.
- **Over-scaffolding.** The likeliest failure here is inventing structure later
  tasks must undo. When in doubt, omit — TASK-0013 and TASK-0016 own their own
  layout.
- **`test` with no tests.** The pipeline must define the task without failing
  a clean tree; a no-op that exits 0 is correct at this stage, and TASK-0012
  onward supply real tests.

## Verification

`pnpm install && pnpm typecheck && pnpm lint && pnpm build` from a clean clone,
with terminal output pasted into the PR body as the standing evidence for the
CI that TASK-0017 has not built yet.
