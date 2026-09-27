# Implementation Plan: CI pipeline with boundary check

**Branch**: `task-0017-ci-pipeline` | **Date**: 2026-09-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-ci-pipeline/spec.md`

## Summary

Add one GitHub Actions workflow that runs a single root script, `pnpm ci:check`, against
a `pgvector/pgvector:pg17` service container. That script is the whole check set and the
local reproduction command at once (FR-008, SC-004). The boundary check is Biome's
`noRestrictedImports`, scoped per zone with `overrides`, so it runs inside the existing
lint step with no new dependency. A small stdlib script proves the rules fire against a
committed fixture. `apps/server/test/` gets its own typecheck project.

## Technical Context

**Language/Version**: TypeScript 5.9 on Node 22; YAML for the workflow

**Primary Dependencies**: existing only — pnpm 11.10.0, Turborepo 2.11, Biome 2.5.14,
Vitest 5, `actions/checkout`, `pnpm/action-setup`, `actions/setup-node`

**Storage**: Postgres 17 + pgvector, as a CI service container (same image as compose)

**Testing**: Vitest (server), `node:test` (hook, after TASK-0018 merges), and the
boundary proof script

**Target Platform**: GitHub-hosted `ubuntu-latest` runner; macOS/Linux dev machines

**Project Type**: monorepo CI configuration

**Performance Goals**: clean run under 10 minutes (SC-006)

**Constraints**: no new npm dependency (FR-005); Biome excludes `.claude/`, `docs/`,
`specs/`, `backlog/`, `.specify/` and that stays so

**Scale/Scope**: 1 workflow, 1 root script entry, 1 Biome config change, 1 fixture
directory, 1 proof script, 1 tsconfig for tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Agent-operable** — `pnpm ci:check` is one command, verdict by exit code; the
      same command a human and CI run.
- [x] **II. Content contract** — no codex entity. Not applicable.
- [x] **III. Data planes** — this feature *implements* the principle's "CI failure"
      clause; it adds no application state.
- [x] **IV. Event sourcing** — no play state. The integration suites that prove the event
      log now run in CI instead of skipping.
- [x] **V. Citations** — no library claim. The extension point is where M1's retrieval
      eval fixtures will plug in (the principle's "ship fixture-based evals").
- [x] **VI. System-agnostic** — no mechanics. Extension point is where M3's conformance
      suite plugs in.
- [x] **VII. Structured first** — no generated artifact. Not applicable.
- [x] **VIII. Operator-owned content** — ships none.
- [x] **IX. Self-hostable** — no runtime container added; CI's database is the same
      image `docker compose up` uses.

**Stack conformance** — within the Architecture Constraints table. GitHub Actions is CI
infrastructure, not a runtime component.

**Post-design re-check (after Phase 1)**: unchanged — all nine pass.

## Project Structure

### Documentation (this feature)

```text
specs/009-ci-pipeline/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── ci-check-command.md
│   └── boundary-rules.md
└── tasks.md
```

### Source Code (repository root)

```text
.github/workflows/ci.yml              # NEW — triggers, concurrency, db service, one step: pnpm ci:check
package.json                          # EDIT — add "ci:check" and "check:boundaries" scripts
biome.json                            # EDIT — noRestrictedImports overrides per zone
scripts/check-boundaries.mjs          # NEW — stdlib proof the rules fire on the fixture
fixtures/boundary-violations/         # NEW — deliberately violating files, one per rule
apps/server/test/tsconfig.json        # NEW — typecheck project for tests
tsconfig.json                         # EDIT — reference apps/server/test
README.md                             # EDIT — "Checks" section: the one command + how to add a suite
```

**Structure Decision**: the check set lives in `package.json` (one script), not in YAML.
CI YAML only provisions the environment and calls it. That is what makes local and CI
agree, and it makes the extension point one line in one file.

## Complexity Tracking

No violations.
