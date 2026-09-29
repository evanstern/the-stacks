# Feature Specification: Root .env inheritance

**Feature Branch**: `task-0034-root-env-inherit`

**Created**: 2026-09-29

**Status**: Draft

**Board task**: TASK-0034

**Input**: Operator request 2026-09-29. One `.env` lives in the root checkout. It holds
secrets (for example `NINEROUTER_API_KEY`) and shared config (`AI_PROVIDERS`,
`AI_PURPOSES`). Every worktree reuses it. A symlink or a copy cannot work: `env:up`
rewrites each worktree's `.env` with that worktree's derived ports, and a copy goes stale.
So `env:up` layers the root `.env` in for every key it does not derive, and root's value
wins. Derived keys stay per worktree.

## Background

Today a new worktree's `.env` is built from `.env.example`, the worktree's own previous
`.env`, and the derived keys (`mergeEnvFile`, spec 010 R5). A fresh worktree therefore has
no AI keys, and the operator copies them by hand into each one. A hand copy drifts the
moment the root value changes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A fresh worktree has the shared keys (Priority: P1)

The operator keeps secrets and shared config in the root checkout's `.env`. An agent cuts a
worktree and runs `pnpm env:up`. The worktree's app container starts with the same AI
gateway config as root, with no hand copy.

**Why this priority**: this is the request.

**Independent Test**: put `SHARED_X=1` in a root `.env` fixture; merge; see `SHARED_X=1`
in the worktree `.env`.

**Acceptance Scenarios**:

1. **Given** the root `.env` holds `AI_PROVIDERS` and a worktree `.env` does not, **When**
   `env:up` runs in the worktree, **Then** the worktree `.env` holds root's `AI_PROVIDERS`.
2. **Given** a worktree `.env` holds an older `AI_PURPOSES`, **When** `env:up` runs,
   **Then** the worktree `.env` holds root's `AI_PURPOSES` (root wins).
3. **Given** the root `.env` changes, **When** `env:up` runs again in a worktree, **Then**
   the worktree picks the new value up.

---

### User Story 2 - Derived keys stay per worktree (Priority: P1)

A root `.env` may hold `APP_PORT`, `DB_PORT`, `STACKS_ENV`, `TEST_DB_PORT`, or
`TEST_DATABASE_URL` (for example from a plain `docker compose up` in root). None of them
reaches a worktree.

**Why this priority**: an inherited port collides stacks; an inherited
`TEST_DATABASE_URL` points one worktree's tests at another's database.

**Independent Test**: a root fixture with `APP_PORT=3000` and `TEST_DATABASE_URL=x`; the
merged file carries the worktree's derived values and no `x`.

**Acceptance Scenarios**:

1. **Given** the root `.env` sets any of the five derived keys, **When** `env:up` runs,
   **Then** the worktree `.env` holds the worktree's value for that key, never root's.
2. **Given** `env:main` derives no `TEST_*` keys, **When** it runs, **Then** it still takes
   no `TEST_*` key from root.

---

### User Story 3 - Nothing else changes, and nothing leaks (Priority: P2)

With no root `.env`, `env:up` behaves exactly as before. `env:up` in the root checkout still
refuses. No secret value is printed by any command or test.

**Independent Test**: merge with an empty shared layer and compare to today's output.

**Acceptance Scenarios**:

1. **Given** no root `.env`, **When** `env:up` runs, **Then** the worktree `.env` is
   byte-identical to what spec 020's `env:up` writes, and the command exits as before.
2. **Given** `env:up` run in the root checkout, **When** it runs, **Then** it refuses as
   before, and root's `.env` is never written.
3. **Given** a root `.env` with a secret, **When** `env:up`, `env:status`, or
   `pnpm check:env` runs, **Then** output names inherited keys at most, never a value.

---

### User Story 4 - The home of shared keys is documented (Priority: P3)

A developer reading `.env.example` or the `runtime-stacks` wiki note learns that secrets
and shared config live in the root `.env`, and that `env:up` copies them in.

**Independent Test**: read both; each names the root `.env` and the root-wins rule.

### Edge Cases

- A value holds `=`, braces, colons, or quotes (JSON in `AI_PROVIDERS`): copied verbatim.
- A multi-line value: unsupported. Only its first line is a `KEY=` line; the rest are
  dropped. Root's current `.env` has none (checked by key-name listing only).
- Root's `.env` changes `POSTGRES_PASSWORD` after a worktree volume exists: Postgres keeps
  the password the volume was created with. Remedy: `env:down` then `env:up` (see
  quickstart).
- A worktree that wants its own value for a shared key: not supported; root wins (see
  research R2 for the upgrade path).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `env:up` in a worktree MUST read the root checkout's `.env`, when present,
  as a shared layer.
- **FR-002**: Precedence per key MUST be: derived > root `.env` > existing worktree `.env`
  > `.env.example` default.
- **FR-003**: The shared layer MUST NOT supply any of `APP_PORT`, `DB_PORT`, `STACKS_ENV`,
  `TEST_DB_PORT`, `TEST_DATABASE_URL`, whether or not the current verb derives it.
- **FR-004**: A missing root `.env` MUST NOT be an error.
- **FR-005**: `env:up` MUST NOT write the root checkout's `.env`.
- **FR-006**: `env:main` MUST inherit the shared layer like any worktree (research R4).
- **FR-007**: Commands and tests MUST NOT print a value from the shared layer; `env:up` MAY
  print inherited key names.
- **FR-008**: Values MUST be copied verbatim (no unquoting, no re-escaping).
- **FR-009**: The merge MUST stay a pure function in `scripts/env-lib.mjs`, unit-tested in
  `pnpm check:scripts`.
- **FR-010**: No new dependency.

## Success Criteria *(mandatory)*

- **SC-001**: A fresh worktree's app container reads the root's AI config after one
  `pnpm env:up`, with no hand copy.
- **SC-002**: `pnpm ci:check` covers the precedence, the derived-key exclusion, and the
  empty-root case.
- **SC-003**: No test or command output contains a shared-layer value.

## Assumptions

- The root checkout is the directory above `git rev-parse --git-common-dir` (the existing
  `rootToplevel`).
- The root `.env` is operator-maintained and trusted; it is git-ignored.
