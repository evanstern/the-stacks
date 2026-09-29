# Implementation Plan: create-operator in the runtime image

**Branch**: `task-0036-create-operator-image` | **Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)
**Board task**: TASK-0036 | **Input**: `specs/023-create-operator-image/spec.md`

## Summary

Move `apps/server/scripts/create-operator.ts` to `apps/server/src/cli/create-operator.ts`.
tsc then compiles it into `dist/cli/create-operator.js`, which the Dockerfile already ships.
The Dockerfile does not change. The CLI keeps refuse-before-prompt, `OPERATOR_PASSWORD`,
`OPERATOR_USERNAME`, and the URL precedence. It now reuses `auth/provisioning.ts` through a
new `hasOperator(db)` export. The host `pnpm auth:create-operator` becomes
`tsc -b && node … dist/cli/create-operator.js`, like `bench:retrieval`. `dev` runs
`docker compose -p stacks-dev … exec app node dist/cli/create-operator.js`, documented in
`docs/ops/dev-vm-104.md`.

## Technical Context

**Language/Version**: TypeScript 5.9 on Node 22 (ESM).

**Primary Dependencies**: none new. `drizzle-orm`, `pg`, `node:readline/promises`.

**Storage**: the existing `users` table. No migration.

**Testing**: `auth.integration.test.ts` already covers `createOperator` (T028). This task
adds a `hasOperator` assertion there. The in-image command is proven on a local stack
(quickstart.md).

**Target Platform**: the runtime image (`node:22-alpine`); developer hosts.

**Project Type**: web service, server package only.

**Constraints**: no source, devDependencies, or tooling in the runtime stage. No password on
any command line. No vm-104 command in this task.

**Scale/Scope**: ~7 files: the moved CLI, `provisioning.ts`, `apps/server/package.json`,
root `package.json` (`check:host-scripts`), `config.ts` (comment), `apps/server/README.md`,
`docs/ops/dev-vm-104.md`, plus wiki notes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Agent-operable** — an agent runs the same command with
      `exec -T -e OPERATOR_PASSWORD`. No human-only path.
- [x] **II. Content contract** — N/A: no codex entity.
- [x] **III. Data planes** — auth rows only, through the existing `auth/` module. No
      cross-plane import.
- [x] **IV. Event sourcing** — N/A: no play state.
- [x] **V. Citations** — N/A: no library-derived claims.
- [x] **VI. System-agnostic** — N/A: no mechanics.
- [x] **VII. Structured first** — N/A: no generated artifacts.
- [x] **VIII. Operator-owned content** — N/A: ships no content. No default credential ships
      either (FR-011 of spec 005 holds).
- [x] **IX. Self-hostable** — improves it: a self-hoster can now create the first operator
      with `docker compose exec app …` and no host toolchain. `docker compose up` is
      unchanged.

**Stack conformance** — within the Architecture Constraints table: Node, Postgres, Drizzle.

## Operator checkpoints

1. **`check:host-scripts` drops `auth/password.ts` and `schema/auth.ts`** (research R4).
   Nothing loads them under strip-types after the move. Flag it in the PR body.
2. **The real `dev` run is the operator's**, after merge and deploy (research R6). The
   operator follows the new runbook section on vm-104.
3. **TASK-0030 T026 runs after that**, as an operator step. Its results file lands under
   TASK-0030 (card AC #4).

None blocks implementation dispatch.

## Project Structure

### Documentation (this feature)

```text
specs/023-create-operator-image/
├── spec.md
├── plan.md
├── research.md
├── quickstart.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/server/src/cli/create-operator.ts   # MOVED from apps/server/scripts/; .js imports
apps/server/scripts/create-operator.ts   # DELETED
apps/server/src/auth/provisioning.ts     # + export hasOperator(db); createOperator uses it
apps/server/test/auth.integration.test.ts # + hasOperator assertion beside T028
apps/server/package.json                 # auth:create-operator → tsc -b && node dist/cli/…
apps/server/src/config.ts                # header comment: only migrate.ts runs on strip-types
apps/server/README.md                    # + the in-container command
package.json                             # check:host-scripts → config.ts, db.ts only
docs/ops/dev-vm-104.md                   # + "Create the first operator"
docs/wiki/{operator-provisioning,container-image,hosted-dev,configuration,database-access,ci-pipeline}.md
docs/wiki/CAPSULES.md                    # regenerate if any description changes
```

`Dockerfile` and `deploy/dev/compose.dev.yml` do not change.

**Structure Decision**: one moved file; everything else is edits in place.

## Complexity Tracking

No violations.
