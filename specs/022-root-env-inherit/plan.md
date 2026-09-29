# Implementation Plan: Root .env inheritance

**Branch**: `task-0034-root-env-inherit` | **Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)
**Board task**: TASK-0034 | **Input**: `specs/022-root-env-inherit/spec.md`

## Summary

`mergeEnvFile` gains a fourth argument, `sharedText`: the root checkout's `.env`. Per key,
derived beats shared, shared beats the worktree's existing value, and that beats the
`.env.example` default. The shared layer never supplies the five derived keys.
`writeEnvFile` reads `<rootToplevel>/.env` when it exists and passes it in, so `env:up` and
`env:main` both inherit. `env:up` prints inherited key names, never values. No new verb,
no new file, no new dependency.

## Technical Context

**Language/Version**: Node 22 ESM (`scripts/*.mjs`).

**Primary Dependencies**: none new. Stdlib `node:fs`, `node:test`.

**Storage**: none. The root `.env` is read, never written.

**Testing**: `scripts/env-lib.test.mjs` (pure merge cases, synthetic fixtures; in
`ci:check` via `check:scripts`); `scripts/env.test.mjs` (Docker e2e, `pnpm check:env`,
local; self-skips when another labeled stack is up).

**Target Platform**: developer hosts.

**Project Type**: developer tooling.

**Constraints**: no secret value in any output; a missing root `.env` changes nothing.

**Scale/Scope**: `scripts/env-lib.mjs`, `scripts/env.mjs`, both tests, `.env.example`, the
010 contract, wiki `runtime-stacks` and `configuration`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Agent-operable** — agents get the shared keys through the same `pnpm env:up` a
      human runs. It removes a human-only step (the hand copy).
- [x] **II. Content contract** — N/A: no codex entity.
- [x] **III. Data planes** — N/A: no application state.
- [x] **IV. Event sourcing** — N/A: no play state.
- [x] **V. Citations** — N/A: no retrieval change.
- [x] **VI. System-agnostic** — N/A: no mechanics.
- [x] **VII. Structured first** — N/A: no generated artifacts.
- [x] **VIII. Operator-owned content** — no book text. The operator's secrets stay in
      git-ignored files and are never printed.
- [x] **IX. Self-hostable** — a self-hoster's `docker compose up` reads its own `.env`,
      untouched. Inheritance runs only in `env.mjs`, which refuses the root checkout.

**Stack conformance** — within the Architecture Constraints table: Node scripts only.

## Operator checkpoints

1. **`env:main` inherits the shared layer** (research R4). AC #3 says `env:main` "behaves
   as before"; this plan reads that as identity, ports, and stack shape, and gives
   env-main the AI keys. Flag it in the PR body. If the operator wants env-main excluded,
   `writeEnvFile` passes an empty shared layer for `mainIdentity()`: a one-line change.
2. **Root wins over a worktree's own value for a shared key** (research R1/R2). Operator
   direction; recorded, with the `.env.local` upgrade path unbuilt.

Neither blocks implementation dispatch.

## Project Structure

### Documentation (this feature)

```text
specs/022-root-env-inherit/
├── spec.md
├── plan.md
├── research.md
├── quickstart.md
├── contracts/env-cli.md
└── tasks.md
```

### Source Code (repository root)

```text
scripts/env-lib.mjs        # DERIVED_KEYS; mergeEnvFile(example, existing, derived, sharedText)
scripts/env-lib.test.mjs   # precedence, derived exclusion, empty shared, JSON value, append order
scripts/env.mjs            # writeEnvFile reads <root>/.env; up prints inherited key names
scripts/env.test.mjs       # stop dumping .env text on assertion failure
.env.example               # header: shared keys and secrets live in the root .env
specs/010-worktree-stacks/contracts/env-cli.md   # fold in 022's section
docs/wiki/{runtime-stacks,configuration}.md
docs/wiki/CAPSULES.md      # regenerate if any description changes
```

**Structure Decision**: extend `mergeEnvFile` in place; no new module.

## Complexity Tracking

No violations.
