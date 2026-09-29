# Feature Specification: Per-worktree compose stacks with orphan gates

**Feature Branch**: `task-0020-worktree-stacks`

**Created**: 2026-09-28

**Status**: Draft

**Input**: Board card TASK-0020 — "Per-worktree compose stacks with orphan gates" — implementing
`backlog/docs/doc-0002` (Runtime environments — rulings, decision-0006, ratified 2026-09-28),
sections Environments, Naming convention, Setup and teardown, and Orphan gates.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Each worktree gets its own isolated stack (Priority: P1)

An implementer (human or agent) working in `.worktrees/task-0022` runs one command and gets a
running app and database that belong to that worktree alone. At the same moment, another
implementer in `.worktrees/task-0024` does the same. Neither stack sees the other's data,
ports, containers, network, or volume. When the work is done, one command removes that
worktree's stack and all its data.

**Why this priority**: Parallel sweep lanes in M1 each need a real database. Today every stack
shares one compose project name and fixed ports, so a second stack collides with the first.
Nothing else in this feature matters until isolation holds.

**Independent Test**: From two worktrees, bring up both stacks; both report healthy on their
own ports; bring one down; the other is unaffected and no resource of the removed stack
remains.

**Acceptance Scenarios**:

1. **Given** a worktree at `.worktrees/task-0020`, **When** the implementer runs `up`,
   **Then** a stack named for that worktree starts on ports derived from the worktree, and
   the app reports healthy.
2. **Given** stacks running for two worktrees, **When** both are queried, **Then** each
   answers on its own ports, with its own database.
3. **Given** a running worktree stack, **When** the implementer runs `down`, **Then** its
   containers, network, and volume are all removed, and no other stack is touched.
4. **Given** a port the derived stack needs is already taken, **When** the implementer runs
   `up`, **Then** the command refuses before starting anything and names the port.
5. **Given** a running worktree stack, **When** anyone asks its `/health`, **Then** the
   response names the commit the stack was built from.

---

### User Story 2 - Orphaned stacks are found and cannot hide (Priority: P2)

The operator removes a worktree after its PR merges. If its stack was left running, the next
status check names it as an orphan, a check mode fails loudly, and the session end warns about
it. Cleanup removes it in one command.

**Why this priority**: A worktree removed without teardown leaves a running app and a
database volume behind indefinitely. With several lanes per sweep, orphans accumulate fast and
silently consume the Mac's resources and ports.

**Independent Test**: Bring a stack up, delete its worktree without teardown, then run the
check mode: it exits nonzero and names the stack; run prune: the stack is gone; run the check
again: it exits zero.

**Acceptance Scenarios**:

1. **Given** stacks for existing and removed worktrees, **When** anyone runs `status`,
   **Then** every project stack is listed with its environment, worktree, branch, and commit,
   and those whose worktree is gone are marked orphaned.
2. **Given** at least one orphan, **When** anyone runs `prune --check`, **Then** it exits
   nonzero and names every orphan, and changes nothing.
3. **Given** at least one orphan, **When** anyone runs `prune`, **Then** each orphan stack
   and its data are removed and stacks with live worktrees are untouched.
4. **Given** an orphan exists, **When** an agent session ends, **Then** a warning names the
   orphan, and the session end is not blocked.
5. **Given** a sweep runbook, **When** the orchestrator starts the sweep or cleans up after a
   merge, **Then** the runbook's gate list requires `prune --check` to pass.

---

### User Story 3 - The main app runs locally on demand (Priority: P3)

The operator wants to look at what `main` does right now, on their Mac, without disturbing any
worktree or the root checkout. One command builds and starts a stack from the current tip of
`origin/main`. One command stops it.

**Why this priority**: The always-on `main` app lives on vm-104 (TASK-0021). A local copy is
an occasional convenience, not a daily path.

**Independent Test**: Run `pnpm env:main`; the app reports healthy with `/health` naming the
`origin/main` tip commit; the root checkout's branch and working tree are unchanged; run
`env down main`; nothing of that stack remains.

**Acceptance Scenarios**:

1. **Given** `origin/main` has moved since the last run, **When** the operator runs
   `pnpm env:main`, **Then** the stack is built from the new tip, not a stale or dirty tree.
2. **Given** the local main stack is running, **When** the operator runs `env down main`,
   **Then** its containers, network, and volume are removed.
3. **Given** the root checkout has uncommitted changes, **When** the operator runs
   `pnpm env:main`, **Then** those changes are neither used nor touched.

### Edge Cases

- A worktree directory name that does not match `task-<n>`: the command derives a stable
  project name and ports from the name anyway, or refuses with a clear message if it cannot.
- Two worktree names that hash or map to the same port pair: `up` detects the taken port and
  refuses rather than colliding.
- Docker is not running: every verb fails fast with one clear message, and `prune --check`
  exits with a distinct environment-error code rather than claiming "no orphans".
- `down` for a stack that is not running: succeeds quietly (idempotent).
- A stack started by hand with plain `docker compose up` in the root: it carries no project
  labels, so `status` does not claim it. The spec does not require detecting unlabeled stacks.
- The worktree `.env` already exists: `up` preserves operator edits and only fills missing
  derived keys.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** (AC #1): One entry point MUST provide the verbs `up`, `down`, `status`, and
  `prune`, plus `main` for the ad hoc local main stack.
- **FR-002** (AC #1): `prune --check` MUST exit nonzero when any orphan exists, exit zero
  when none exist, change nothing, and name each orphan found.
- **FR-003** (AC #2): The stack's project name MUST be `stacks-<env>`, where `<env>` is the
  worktree directory name for worktree stacks and `main` for the local main stack.
- **FR-004** (AC #2): App and database host ports MUST derive deterministically from the
  worktree, so the same worktree always gets the same ports and two worktrees plus the main
  stack can run at once.
- **FR-005** (AC #2): `up` MUST refuse, before starting anything, when a derived port is
  already bound, and name the port.
- **FR-006** (AC #3): Every container a stack starts MUST carry the labels
  `org.the-stacks.env`, `org.the-stacks.worktree` (absolute path), and
  `org.the-stacks.commit` (full SHA).
- **FR-007** (AC #4): `/health` MUST report the commit the running build came from, and
  MUST keep its existing fields and always-200 behavior unchanged.
- **FR-008** (AC #5): An automated test MUST prove that `up` followed by `down` leaves no
  container, network, or volume carrying that stack's project name.
- **FR-009** (AC #6): A session-end hook MUST warn, without blocking, when any orphan exists.
- **FR-010** (AC #6): The project's sweep runbook gates MUST require `prune --check` at sweep
  start and in post-merge cleanup, and the project's CLAUDE.md MUST state the same rule.
- **FR-011** (AC #7): `pnpm env:main` MUST build and start the local main stack from the
  current `origin/main` tip, fetched fresh, without changing the root checkout's branch,
  index, or working tree.
- **FR-012** (AC #7): `env down main` MUST remove the local main stack's containers, network,
  and volume.
- **FR-013**: `up` MUST write the worktree's `.env` from `.env.example` with derived values,
  preserving any keys the operator already set.
- **FR-014**: Worktree data MUST be disposable: `down` removes the stack's volume.
- **FR-015**: When Docker is unreachable, every verb MUST fail with one clear message, and
  `prune --check` MUST NOT report success.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): An agent MUST be able to drive every verb
  non-interactively through the same command a human uses, with machine-checkable exit codes.
- **CR-005** (VIII. Operator-owned content): Stack data MUST stay in local volumes owned by
  that stack; `down` and `prune` MUST never touch a volume belonging to another stack.

CR-002, CR-003, CR-004 do not apply: this feature creates no codex entity, makes no library
claim, and touches no game mechanics.

### Key Entities

- **Stack**: one running environment — a compose project named `stacks-<env>`, its
  containers, network, and volume. Attributes: env name, worktree path, commit, app port,
  database port.
- **Orphan**: a labeled stack whose `org.the-stacks.worktree` path no longer exists as a
  worktree (the local main stack is never an orphan by this rule).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Three stacks (two worktrees and the local main stack) run at the same time with
  zero port or name collisions.
- **SC-002**: After `down`, zero resources carrying that stack's name remain, every time.
- **SC-003**: An orphan is reported by the check mode 100% of the time it exists, and the check
  mode reports success only when zero orphans exist.
- **SC-004**: Any running stack can state its exact source commit in one request.
- **SC-005**: A local copy of current `main` is running within one command, with no change to
  the root checkout.

## Assumptions

- Worktrees follow the `.worktrees/<name>` convention; `task-<n>` names are the common case.
- Docker Desktop (or an equivalent) runs on the operator's Mac.
- The existing compose file stays the single definition for every environment; per-stack
  differences come from the project name, env values, and labels, not from forked files.
- The hosted `dev` environment on vm-104 is TASK-0021's scope. This feature only reserves the
  `dev` name and labels.
- Changes to the praxisflux sweep skill itself are out of scope; the rule lands in this repo's
  runbook and CLAUDE.md, and the plugin change is filed upstream separately.
- `.claude/settings.json` gains a Stop hook entry; its existing root-guard entries stay
  unchanged.
