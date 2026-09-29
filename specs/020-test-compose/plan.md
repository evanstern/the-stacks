# Implementation Plan: Test compose stack

**Branch**: `task-0033-test-compose` | **Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)
**Board task**: TASK-0033 | **Input**: `specs/020-test-compose/spec.md`

## Summary

A new `docker-compose.test.yml` holds one service: a `db` that `extends` the base file's
`db`, drops its env file and named volume, keeps its image, healthcheck, and labels, and
runs on tmpfs with fixed `stacks` credentials. The image stays written once, in
`docker-compose.yml`. CI drops its `services:` container and starts the test compose file
instead, so local and CI databases come from the same file. `pnpm env:up` starts the test
stack as `stacks-<env>-test` on port `25000+n` and writes `TEST_DATABASE_URL` at it;
`pnpm env:down` removes both stacks. `status`/`prune` and the Stop hook need no change: they
already group by compose project and read labels the test container inherits. No new verb,
no worker toggle, no new dependency.

## Technical Context

**Language/Version**: Node 22 ESM scripts (`scripts/*.mjs`); Compose YAML; GitHub Actions YAML.

**Primary Dependencies**: none new. Stdlib `node:test`, `node:fs`, `node:child_process`.
Docker Compose ≥ 2.24 (`extends` + `!reset`/`!override`); probed on v5.3.0.

**Storage**: test database on tmpfs; the app stack's named volume is unchanged.

**Testing**: `scripts/env-lib.test.mjs` (pure derivation + image-pin guard; in `ci:check`
via `check:scripts`); `scripts/env.test.mjs` (Docker end-to-end, `pnpm check:env`, local);
`worker.integration.test.ts` 20× with the app stack up (AC #5).

**Target Platform**: developer hosts (macOS, Docker Desktop); GitHub `ubuntu-latest`.

**Project Type**: developer tooling.

**Performance Goals**: `env:up` adds only a pulled-image container start (seconds).

**Constraints**: a self-hoster's `docker compose up` is unchanged (constitution IX).
Loopback-only port publishing. No change to app code.

**Scale/Scope**: ~8 files touched: `docker-compose.yml` (one default), new
`docker-compose.test.yml`, `scripts/env-lib.mjs`, `scripts/env.mjs`, their tests, `ci.yml`,
`.env.example`, README, 010 contract, wiki notes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Agent-operable** — agents drive it through the same `pnpm env:*` commands and exit
      codes a human uses. No human-only path.
- [x] **II. Content contract** — N/A: no codex entity.
- [x] **III. Data planes** — N/A: no application state. Test data is disposable
      infrastructure outside all three planes.
- [x] **IV. Event sourcing** — N/A: no play state.
- [x] **V. Citations** — N/A: no library-derived claims; no retrieval change.
- [x] **VI. System-agnostic** — N/A: no mechanics.
- [x] **VII. Structured first** — N/A: no generated artifacts.
- [x] **VIII. Operator-owned content** — ships no book text. The tmpfs database holds only
      synthetic test fixtures and vanishes with its container.
- [x] **IX. Self-hostable** — a plain `docker compose up` loads only `docker-compose.yml`,
      whose one edit (`${APP_PORT:-3000}`) matches `config.ts`'s own default. The test
      file is dev/CI-only and is a second instance of the existing image, not a new
      container kind.

**Stack conformance** — within the Architecture Constraints table: Postgres, Node scripts.

## Operator checkpoints

1. **CI switches from a `services:` container to `docker compose -f docker-compose.test.yml
   up -d --wait`** (research R1). This is how the pin lives in one place; it changes
   `ci.yml`'s shape. The ruling asked for a single source of truth and a justification; this
   is the justified choice. Flag it in the PR body for review.
2. **`pnpm db:migrate` on the host now targets the test database** (research R7).
   Migrating the app stack's database from the host takes a one-command override. Flag it in
   the PR body.
3. **Worktree basenames ending in `-test` become reserved** (research R9).

None blocks implementation dispatch: each follows from the ratified conditions.

## Project Structure

### Documentation (this feature)

```text
specs/020-test-compose/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/env-cli.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
docker-compose.yml             # ${APP_PORT:-3000} default only; image line stays here
docker-compose.test.yml        # NEW — db-only, extends docker-compose.yml's db
.github/workflows/ci.yml       # services: block → one compose step (runner is ephemeral; no teardown)
.env.example                   # TEST_DB_PORT; TEST_DATABASE_URL points at the test stack
README.md                      # "Checks" reproduces CI via the test compose file
scripts/env-lib.mjs            # testDbPort, testProject, `-test` reservation
scripts/env-lib.test.mjs       # derivation cases + image-pin guard
scripts/env.mjs                # up/down cover both projects; .env keys
scripts/env.test.mjs           # e2e: both projects up, both gone after down
specs/010-worktree-stacks/contracts/env-cli.md   # fold in 020's amended rows
docs/wiki/{runtime-stacks,compose-stack,test-suite,ci-pipeline,configuration}.md
docs/wiki/CAPSULES.md          # regenerate if any description changes
```

`deploy/dev/compose.dev.yml` names no image and needs no change. `hosted-dev` is
re-verified only if its sources change (they do not).

**Structure Decision**: extend the existing env machinery in place; one new compose file.

## Complexity Tracking

No violations.
