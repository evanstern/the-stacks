# Feature Specification: create-operator in the runtime image

**Feature Branch**: `task-0036-create-operator-image`

**Created**: 2026-09-29

**Status**: Draft

**Board task**: TASK-0036

**Input**: Ship create-operator in the runtime image, and document first-operator setup on
`dev`. Found 2026-09-29 while preparing TASK-0030's dev load run (T026). The runtime image
copies only `apps/server/dist`, whose tsconfig includes only `src`. So
`apps/server/scripts/create-operator.ts` is absent in the container, and running it fails
with `Cannot find module /app/apps/server/scripts/create-operator.ts`. The vm-104 checkout
has no `pnpm install` (deploys build inside containers), so the host path is closed too.
`dev`'s `users` table is empty, and nobody can create its first operator. Operator ruling
2026-09-29: TASK-0030 T026 waits for this task. The same account serves the M1 walkthrough
(TASK-0031).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create the first operator inside a running stack (Priority: P1)

An operator has a deployed stack with an empty `users` table. They run one command against
the running `app` container. They type a password at the prompt. The command creates the
operator account, and the operator can sign in.

**Why this priority**: without it, `dev` has no signable account. TASK-0030 T026 and
TASK-0031 both wait on it.

**Independent Test**: build the image, bring up a local stack, migrate it, run the in-image
command, then sign in through `POST /auth/sign-in`.

**Acceptance Scenarios**:

1. **Given** a running stack with no operator, **When** the operator runs the in-image
   command and types a password, **Then** an operator row exists and sign-in with that
   password returns 200 with `role: "operator"`.
2. **Given** a running stack with no operator, **When** an agent runs the command
   non-interactively with `OPERATOR_PASSWORD` in the container environment, **Then** the
   account is created and no prompt appears.
3. **Given** an operator already exists, **When** anyone runs the command, **Then** it exits
   1 before prompting, prints the refusal, and changes nothing.
4. **Given** `OPERATOR_USERNAME` is set, **When** the command creates the account, **Then**
   the account uses that username.

### User Story 2 - The host command keeps working (Priority: P1)

A developer on a workstation runs `pnpm --filter @the-stacks/server auth:create-operator`,
as the README documents. The behaviour is unchanged: `.env` is loaded,
`TEST_DATABASE_URL` wins over `DATABASE_URL`, and every rule in US1 holds.

**Why this priority**: the README, the M0 demo, and the session-auth quickstart all use this
command.

**Independent Test**: run the pnpm command against a migrated local database, twice.

**Acceptance Scenarios**:

1. **Given** a migrated database with no operator, **When** the developer runs the pnpm
   command with `OPERATOR_PASSWORD` set, **Then** the account is created.
2. **Given** an operator exists, **When** the developer runs the pnpm command again,
   **Then** it refuses before prompting and exits 1.

### User Story 3 - The dev runbook names the exact command (Priority: P2)

The operator opens `docs/ops/dev-vm-104.md` and finds a "Create the first operator" section.
It gives one exact command. The password is typed at the prompt, never on a command line.

**Why this priority**: the real `dev` run is an operator step (vm-104 command consent). The
runbook is how the operator performs it without re-deriving anything.

**Independent Test**: read the section. Confirm the command matches the one proven locally,
and no password appears in it.

**Acceptance Scenarios**:

1. **Given** the runbook, **When** the operator follows the section, **Then** the command
   they run holds no secret, and it matches the command shape proven in quickstart.md.

### Edge Cases

- A non-interactive run with an existing operator and no `OPERATOR_PASSWORD`: it refuses and
  exits 1. It never hangs on a prompt.
- A non-interactive run with no operator and no `OPERATOR_PASSWORD`: stdin is closed, the
  password is empty, and the command throws "a non-empty password is required". Nothing is
  created.
- A run against an unmigrated database: the query fails, the command prints
  `Provisioning failed:` and exits 1.
- Two concurrent first runs: out of scope. This is a one-time, human-run command (see
  `provisioning.ts`'s comment).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The runtime image MUST contain a compiled create-operator entry point under
  `apps/server/dist`, runnable with `node` and no TypeScript tooling.
- **FR-002**: The entry point MUST check for an existing operator before it reads or prompts
  for a password. It MUST refuse with exit code 1 and make no change when one exists.
- **FR-003**: The entry point MUST read the password from `OPERATOR_PASSWORD` when set, and
  prompt interactively otherwise. It MUST read the username from `OPERATOR_USERNAME`, with
  default `operator`.
- **FR-004**: The entry point MUST prefer `TEST_DATABASE_URL` over `DATABASE_URL`, as today.
  Inside a compose container `TEST_DATABASE_URL` is blank, so `DATABASE_URL` governs.
- **FR-005**: `pnpm --filter @the-stacks/server auth:create-operator` MUST keep its name,
  its `.env` loading, and its behaviour on the host.
- **FR-006**: `docs/ops/dev-vm-104.md` MUST gain a "Create the first operator" section with
  the exact `dev` command. The command MUST NOT carry the password.
- **FR-007**: The image MUST NOT gain source files, devDependencies, or build tooling. The
  entry point ships only as compiled output.
- **FR-008**: The change MUST add no dependency.

### Key Entities

- **Operator account**: a `users` row with `role = 'operator'`. At most one per install.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a locally built image, the in-image command creates an operator, and
  sign-in with that password returns 200.
- **SC-002**: A second in-image run exits 1 in under 5 seconds with no input supplied.
- **SC-003**: `pnpm ci:check` exits 0.
- **SC-004**: The runbook section's command matches the proven command shape, and holds no
  secret.

## Assumptions

- The real `dev` run is an operator step after merge and deploy. This spec's proof is a
  local stack (card AC #3).
- TASK-0030 T026 runs after merge, as an operator step. Its results file lands under
  TASK-0030 (card AC #4), not in this PR.
- The prompt echoes typed characters, as it does today. Masking input is out of scope.
- The vm-104 checkout is where the runbook's other commands run. The new command runs there
  too.
