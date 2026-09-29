# Implementation Plan: Per-worktree compose stacks with orphan gates

**Branch**: `task-0020-worktree-stacks` | **Date**: 2026-09-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/010-worktree-stacks/spec.md`

## Summary

One stdlib Node script, `scripts/env.mjs`, turns the single existing compose file into one
isolated stack per worktree. The compose project name (`stacks-<env>`) isolates containers,
network, and volume; ports derive from the worktree name; three labels tie every container
to its worktree and commit. `status` and `prune` find stacks whose worktree is gone. A Stop
hook warns about orphans without blocking, and CLAUDE.md plus the sweep runbook make
`prune --check` a gate. `/health` gains a `commit` field fed by a Docker build arg.
`pnpm env:main` builds current `origin/main` in a dedicated detached worktree so the root
checkout is never touched. Details: [research.md](research.md) R1–R9.

## Technical Context

**Language/Version**: Node 22 (`.nvmrc`), plain ESM for the script; TypeScript for the one
server change.

**Primary Dependencies**: none new. Node stdlib, the `docker` CLI (Compose v2), and `git`.

**Storage**: Docker volumes, one per stack, removed by `down`.

**Testing**: Node `--test` for the script (pure-function unit tests in `ci:check`; a Docker
end-to-end test as `pnpm check:env`, run locally); Vitest for the `/health` change.

**Target Platform**: operator's Mac with Docker Desktop; the script must also run on Linux
(vm-104, TASK-0021).

**Project Type**: developer tooling plus one additive server field.

**Performance Goals**: `status` and `prune --check` finish in under 2 seconds, so the Stop
hook does not slow session ends.

**Constraints**: root checkout untouched by every verb; root-guard entries in
`.claude/settings.json` unchanged; plain `docker compose up` from a clean clone still works.

**Scale/Scope**: up to ~6 concurrent stacks on one Mac.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Agent-operable** — every verb is non-interactive with documented exit codes
      (`prune --check`: 0/1/2); agents and humans run the same `pnpm env:*` commands.
- [x] **II. Content contract** — no codex entity. Not applicable.
- [x] **III. Data planes** — adds no application state. `/health`'s `commit` is process
      metadata, not plane data.
- [x] **IV. Event sourcing** — no play state. Not applicable.
- [x] **V. Citations** — no library claim. Not applicable.
- [x] **VI. System-agnostic** — no mechanics. Not applicable.
- [x] **VII. Structured first** — no generated artifact. Not applicable.
- [x] **VIII. Operator-owned content** — ships none; each stack's data stays in its own
      volume, and `down`/`prune` touch only their own project's volume.
- [x] **IX. Self-hostable** — plain `docker compose up` still works (labels and build arg
      default); no new container; no new runtime dependency.

**Stack conformance** — within the Architecture Constraints table. The script is developer
tooling beside the existing `scripts/check-boundaries.mjs`.

**Post-design re-check (after Phase 1)**: unchanged — all nine pass.

## Operator rulings this plan carries

- **(a) AC #6:** sweep gate lands as a CLAUDE.md section outside the `pdlc:grounding`
  markers plus runbook gate lines; the Stop hook warns, never blocks; the praxisflux plugin
  change is filed upstream separately (R7).
- **(b)** `.claude/settings.json` root-guard `PreToolUse` entries stay byte-identical; a test
  asserts it (R7).
- **(c)** Ports: `task-<n>` → 3000+n / 15000+n; other names → hashed into a disjoint range;
  `main` → 3000 / 5432; `up` probes and refuses on a bound port (R3).
- **(d)** `pnpm env:main` uses a detached worktree at `.worktrees/env-main`, refreshed to
  `origin/main` inside that worktree only (R8).
- **(e)** No new dependency (R1).

## Project Structure

### Documentation (this feature)

```text
specs/010-worktree-stacks/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── env-cli.md
│   └── health.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
scripts/
├── env.mjs                  # new — the CLI: up, down, status, prune, main
├── env-lib.mjs              # new — pure functions: names, ports, .env merge, orphan classify
├── env-lib.test.mjs         # new — unit tests, no Docker (runs in ci:check)
└── env.test.mjs             # new — Docker end-to-end (pnpm check:env, local)
.claude/
├── hooks/env-orphan-hook.mjs        # new — Stop hook, warn-only
├── hooks/env-orphan-hook.test.mjs   # new — warn-only + settings.json root-guard unchanged
└── settings.json                    # + Stop entry
docker-compose.yml           # + labels on both services, + build arg on app
Dockerfile                   # + ARG/ENV GIT_COMMIT in runtime stage
.env.example                 # + STACKS_ENV, documented derived keys
package.json                 # + env:up/down/status/prune/main, check:env, test wiring
apps/server/src/config.ts    # + commit (GIT_COMMIT, default "unknown")
apps/server/src/routes/health.ts     # + commit field
apps/server/src/app.ts / index.ts    # pass commit through
apps/server/test/health.test.ts      # + commit assertions
CLAUDE.md                    # + "Runtime stacks" section, outside pdlc markers
docs/design/m1-wave1-sweep-runbook.md  # + two gate lines
```

**Structure Decision**: tooling sits in root `scripts/` beside `check-boundaries.mjs`; the
hook sits in `.claude/hooks/` beside the root-guard; the only app change is the additive
`/health` field.

## Complexity Tracking

No violations.
