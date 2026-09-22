---

description: "Task list for session auth"
---

# Tasks: Session auth for operator and invited players

**Input**: Design documents from `/specs/005-session-auth/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED. FR-017 mandates tests for successful sign-in, wrong-credential refusal,
expired-session refusal, and single-use invitation redemption; board AC#7 says the same.
Integration tests run against a real Postgres via `TEST_DATABASE_URL`, reusing spec 004's
loud-skip harness — a silent skip and a fake pass are both green.

**Organization**: Grouped by user story. US1 and US2 are both P1 and share the session
machinery; US2's seam is what TASK-0015 waits on.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US4 from spec.md
- Exact file paths in every task

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new dependencies (research D1) — this phase is schema only.

- [x] T001 Define `users`, `auth_sessions`, and `invitations` in `apps/server/src/schema/auth.ts` per data-model.md. **Name the table `auth_sessions`, never `sessions`** — `events.session_id` is a *play* session and the collision is a real trap
- [x] T002 Add the unique functional index on `lower(username)` to the schema in `apps/server/src/schema/auth.ts`, so `Alice` and `alice` cannot both exist
- [x] T003 Add the unique index on `auth_sessions.token_hash` and the index on `auth_sessions.user_id` per data-model.md
- [x] T004 Generate the migration with `pnpm --filter @the-stacks/server db:generate` and **commit the generated SQL**; verify it applies to a fresh database and that a second run is a no-op

**Checkpoint**: three tables exist; `pnpm --filter @the-stacks/server db:migrate` twice is idempotent.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Password hashing and token handling. Every user story needs both.

⚠️ No user story can start until this phase completes.

- [x] T005 Implement `hashPassword` and `verifyPassword` in `apps/server/src/auth/password.ts` using `node:crypto` `scrypt` at N=2^15, r=8, p=1, 64-byte key, 16-byte random salt. **Pass an explicit `maxmem` of 64 MiB — the default is 32 MiB and N=2^15 THROWS SYNCHRONOUSLY without it** (research D1, measured). Store salt and parameters with the hash
- [x] T006 Compare hashes with `timingSafeEqual` in `apps/server/src/auth/password.ts`, never `===`
- [x] T007 Enforce the maximum accepted password length in `apps/server/src/auth/password.ts` — over the bound is a **refusal**, never a silent truncation (FR-016)
- [x] T008 [P] Implement token generation and hashing in `apps/server/src/auth/tokens.ts`: 32 random bytes base64url for the token, **SHA-256 for what is stored** (research D2). Note in a comment why this is SHA-256 and not scrypt — the token is already high-entropy, so a memory-hard hash on every request buys nothing
- [x] T009 [P] Write `apps/server/test/auth.password.test.ts` (no database): hash→verify round-trip, wrong password fails, the same password hashes differently twice (salt is random), an over-length password is refused not truncated

**Checkpoint**: passwords hash and verify; tokens generate and hash. T009 passes.

---

## Phase 3: User Story 1 — Sign in and stay signed in (Priority: P1) 🎯 MVP

**Goal**: Exchange correct credentials for a session; refuse wrong ones indistinguishably.

**Independent test**: Create an account, sign in, be recognized on a later request; sign in
wrong and be refused.

### Tests for User Story 1

- [x] T010 [US1] Create `apps/server/test/auth.integration.test.ts` with spec 004's loud-skip harness (`TEST_DATABASE_URL` first, then `DATABASE_URL`; a printed notice on skip). Fresh usernames per test — the database is shared and not reset
- [x] T011 [US1] Test successful sign-in: correct credentials return 200 with a user body and set a cookie
- [x] T012 [US1] Test wrong password and unknown username return **byte-identical** status and body (FR-004, SC-003)
- [x] T013 [US1] Test that a session cookie authenticates a later request to `/auth/me`
- [x] T014 [US1] Test sign-out: the cookie stops working **immediately**, not at expiry (FR-005), and a second sign-out is also a success (idempotent)

### Implementation for User Story 1

- [x] T015 [US1] Implement `createSession` and `endSession` in `apps/server/src/auth/session.ts`: create stores only the token hash and a 30-day `expires_at`; end deletes the row
- [x] T016 [US1] Implement the sign-in, sign-out, and `me` routes in `apps/server/src/routes/auth.ts` per contracts/http-auth.md, with Zod-validated bodies
- [x] T017 [US1] **Verify a hash even when no user is found**, so response time does not distinguish unknown-username from wrong-password (contracts/http-auth.md). A fast "no such user" leaks the account list as surely as a different message
- [x] T018 [US1] Set the session cookie with `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age` matching the lifetime, and **`Secure` only when serving over HTTPS** — unconditional `Secure` silently breaks localhost (research D4)
- [x] T019 [US1] Mount the auth routes in `apps/server/src/app.ts`

**Checkpoint**: a person can sign in, be recognized, and sign out. US1 tests pass.

---

## Phase 4: User Story 2 — One identity, recognized on every channel (Priority: P1)

**Goal**: The `validateSession` seam TASK-0015 consumes.

**Independent test**: Sign in; call `validateSession` with the token directly (no HTTP
context) and get the identity; sign out and get `null`.

**This phase unblocks TASK-0015.** Its contract is fixed in
[contracts/validate-session.md](./contracts/validate-session.md) and changing it is an
operator checkpoint, not an implementer decision.

### Tests for User Story 2

- [x] T020 [US2] Test `validateSession` returns `{userId, role}` for a live session, called **without any HTTP request object** — that callability is the contract
- [x] T021 [US2] Test it returns `null` for unknown, malformed, signed-out, and expired tokens — **the same `null` for all four** (contracts/validate-session.md), since distinguishing them is an oracle for probing real tokens
- [x] T022 [US2] Test it does **not** extend a session's lifetime: validate repeatedly, confirm `expires_at` is unchanged (FR-008, SC-007). Without this a polling WebSocket keeps a session alive forever
- [x] T023 [P] [US2] Test that HTTP middleware and a direct `validateSession` call resolve the same session to the same identity (SC-002)

### Implementation for User Story 2

- [x] T024 [US2] Implement `validateSession(token)` in `apps/server/src/auth/session.ts` exactly per contract: hashes the presented token, looks up by hash, checks expiry, returns `{userId, role}` or `null`. **Takes a token string only — no `Request`, no socket, no cookie header** (the WS upgrade handler has no Hono context)
- [x] T025 [US2] **Throw, do not return `null`, when the datastore is unreachable** (FR-009). A database blip reported as "not signed in" signs out every user at once
- [x] T026 [US2] Implement HTTP middleware in `apps/server/src/auth/middleware.ts` that extracts the cookie and calls `validateSession` — extraction is the caller's job, validation is the seam's

**Checkpoint**: one validation path serves both transports. TASK-0015 can be dispatched.

---

## Phase 5: User Story 3 — The operator gets in on a fresh install (Priority: P2)

**Goal**: A documented path to the first account, with no shipped credential.

**Independent test**: Against a database with no accounts, run the command, then sign in.

### Tests for User Story 3

- [ ] T027 [US3] Test that provisioning creates an operator that can sign in
- [ ] T028 [US3] Test that a second run **refuses** rather than creating a second operator or overwriting the first (US3 scenario 2) — a silent re-run is how an install gets taken over

### Implementation for User Story 3

- [ ] T029 [US3] Implement `apps/server/scripts/create-operator.ts` per research D6: reads a password from the environment or a prompt, creates the operator, refuses when one exists. Loads `.env` like `db:migrate` does
- [ ] T030 [US3] Add the `auth:create-operator` script to `apps/server/package.json`
- [ ] T031 [US3] Document provisioning in `apps/server/README.md`, including that re-running refuses and that **no default credential ships** (FR-011)

**Checkpoint**: a fresh install reaches a working operator account by one documented command.

---

## Phase 6: User Story 4 — The operator invites a player (Priority: P2)

**Goal**: An operator-only, single-use invitation.

**Independent test**: Issue an invitation, redeem it, sign in as the new player; redeem the
same invitation again and be refused.

### Tests for User Story 4

- [ ] T032 [US4] Test that an operator can issue an invitation and a **player cannot** (FR-012, 403)
- [ ] T033 [US4] Test redemption creates a player account that can sign in with the password they chose
- [ ] T034 [US4] Test that redeeming an already-redeemed invitation is refused, and an expired one too
- [ ] T035 [US4] **Test the race**: fire simultaneous redemptions of one invitation and assert **exactly one** account is created (SC-005). This is the test that catches a read-then-write implementation, which passes every non-concurrent test
- [ ] T036 [US4] **Prove T035 has teeth**: temporarily replace the conditional UPDATE with read-then-write, watch T035 fail, restore. Record the observed failure. A test that passes either way is worse than none

### Implementation for User Story 4

- [ ] T037 [US4] Implement `issueInvitation` in `apps/server/src/auth/invitations.ts`: operator-only, stores only the token hash, returns the token **once**
- [ ] T038 [US4] Implement `redeemInvitation` in `apps/server/src/auth/invitations.ts` using a **conditional UPDATE** (`... WHERE id = $1 AND redeemed_at IS NULL`) and creating the account only when it reports a row changed (research D5) — never read-then-write
- [ ] T039 [US4] Add the invitation routes to `apps/server/src/routes/auth.ts` per contracts/http-auth.md, signing the new player in on successful redemption

**Checkpoint**: all four user stories complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T040 Run `pnpm install && pnpm typecheck && pnpm lint && pnpm test && pnpm build` and paste literal output into the PR body — the evidence standing in for the CI TASK-0017 has not built
- [ ] T041 Run `quickstart.md` end to end, including the manual `curl` checks for cookie flags and indistinguishable refusals
- [ ] T042 [P] Confirm `apps/server/README.md` documents both the migration and the provisioning command

### Constitution Compliance (the-stacks)

- [ ] T043 Agent-facing interface exercised by a test, not only a human path (Principle I) — every endpoint is JSON in/JSON out and tests drive them directly
- [ ] T044 Cross-plane boundary respected (Principle III) — this feature reads and writes only session-plane tables
- [ ] T045 No default credential ships anywhere (Principle VIII, FR-011) — verify by checking a fresh install has no signable account before provisioning
- [ ] T046 `docker compose up` still works from a clean clone (Principle IX)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)** → no dependencies
- **Phase 2 (Foundational)** → depends on Phase 1. **Blocks every user story.**
- **Phase 3 (US1)** → depends on Phase 2
- **Phase 4 (US2)** → depends on Phase 3 (extends the session machinery US1 creates)
- **Phase 5 (US3)** → depends on Phase 2; independent of US1/US2 in principle
- **Phase 6 (US4)** → depends on Phase 3 (a redeemed player must be able to sign in) and Phase 5 (an operator must exist to invite)
- **Phase 7 (Polish)** → depends on all

### Cross-task dependency

**TASK-0015 waits on Phase 4, not on this whole task.** Once `validateSession` exists and
matches its contract, 0015 can be dispatched in parallel with Phases 5–7. 0014 still merges
first, per the runbook.

### Parallel Opportunities

- T008 and T009 are independent of T005–T007's implementation order.
- T023, T042 are independent.
- **T015/T024 do not parallelize**: same file, and T024 builds on T015's storage shape.
- **Phases 5 and 6 do not parallelize with each other**: US4 needs the operator US3 creates.

## Implementation Strategy

### MVP scope

**Phases 1 + 2 + 3 (US1)** delivers a usable single-account login. **Phase 4 (US2)** is what
unblocks the sibling task and should follow immediately.

### Incremental delivery

Each phase leaves the feature working and testable. A failing checkpoint stops that phase
rather than accumulating into the next.

## Notes

- **The `auth_sessions` name is load-bearing.** Two different "sessions" now exist in this
  system; an unqualified `sessions` table invites the wrong join.
- **T036 is not optional.** The invitation race is the same class of bug spec 004 solved
  with an advisory lock, and the same rule applies: a regression test that passes with and
  without its fix manufactures confidence.
- **The scrypt `maxmem` trap (T005) has been measured, not guessed** — N=2^15 throws
  synchronously on the default limit. See research D1's table.
