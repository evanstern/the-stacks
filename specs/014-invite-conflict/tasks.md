# Tasks: Invitation redeem conflict

**Input**: Design documents from `/specs/014-invite-conflict/`

**Prerequisites**: plan.md, spec.md, research.md, contracts/unique-violation.md, quickstart.md

**Tests**: required. Card AC #1 demands a real-database integration test. Write it first and
watch it fail.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: user story (US1, US2)

## Phase 1: Failing tests first

**Purpose**: prove the bug on a real database before any source change.

- [x] T001 Run `pnpm env:up` in `.worktrees/task-0032`. Read `TEST_DATABASE_URL` from the
  generated `.env`. Build `packages/shared` if imports do not resolve (see
  `docs/wiki/test-suite.md`, Operational notes).
- [x] T002 [US1] In `apps/server/test/auth.integration.test.ts`, add one case (e.g.
  `"TASK-0032: redeeming with a taken username is a conflict, not a 500"`) inside the existing
  `describe.skipIf(!reachable)` block. Use the file's `createTestUser` and
  `createTestInvitation` helpers. Assert, in order:
  (1) `redeemInvitation(db, …)` with the existing username returns
  `{ ok: false, reason: "conflict" }`;
  (2) the same with the username upper-cased returns `conflict`;
  (3) `POST /auth/invitations/redeem` with the existing username answers 409 and
  `body.error.kind === "conflict"`;
  (4) the same invitation then redeems with a fresh `randomUUID()` username and answers 201.
- [x] T003 [P] [US2] In `apps/server/test/db.test.ts`, add a `describe("isUniqueViolation")`
  with the table in `contracts/unique-violation.md`: true for `{ code: "23505" }` and
  `{ cause: { code: "23505" } }`; false for other codes, `null`, `undefined`, `"23505"`, `42`,
  `{}`, `{ cause: null }`. Import `isUniqueViolation` from `../src/db.js` (it fails to import
  until T004; that failure is expected).
- [x] T004 Run `REQUIRE_DATABASE=1 TEST_DATABASE_URL=<url> pnpm --filter @the-stacks/server exec vitest run test/auth.integration.test.ts`.
  Confirm the T002 case fails because `redeemInvitation` throws a `DrizzleQueryError`.
  Paste the failing assertion line into the commit message.

**Checkpoint**: the new integration case fails for the documented reason, with 0 skipped.

## Phase 2: One shared helper and the fix (US1 + US2)

**Goal**: one exported `isUniqueViolation`; both callers use it; the T002 case passes.

- [x] T005 [US2] In `apps/server/src/db.ts`, add module-private
  `const POSTGRES_UNIQUE_VIOLATION = "23505";` and export
  `isUniqueViolation(err: unknown): boolean` with the logic now in
  `apps/server/src/library/store.ts` (check `err.code`, then `err.cause.code`; never throw).
  Keep the comment explaining the `DrizzleQueryError` wrap. Add a `ponytail:` comment: one
  level of `cause` only; walk the chain when a caller wraps errors twice.
- [x] T006 [US1] In `apps/server/src/auth/invitations.ts`, delete the private
  `POSTGRES_UNIQUE_VIOLATION` and `isUniqueViolation`. Import `isUniqueViolation` from
  `../db.js`. Leave `redeemInvitation`'s catch block logic unchanged.
- [x] T007 [US2] In `apps/server/src/library/store.ts`, delete the private
  `POSTGRES_UNIQUE_VIOLATION`, `isUniqueViolation`, and their comment. Add
  `isUniqueViolation` to the existing `../db.js` import. Both call sites
  (`storeParsedBook`, `attachEmbeddings`) stay unchanged.
- [x] T008 Verify the single-copy rule: `grep -rn "23505" apps/server/src` prints exactly one
  line, in `db.ts`; `grep -rn "function isUniqueViolation" apps/server/src` prints exactly one
  line.
- [x] T009 Run with the database required:
  `REQUIRE_DATABASE=1 TEST_DATABASE_URL=<url> pnpm --filter @the-stacks/server exec vitest run test/auth.integration.test.ts test/db.test.ts test/library/store.integration.test.ts`.
  All pass, 0 skipped.

**Checkpoint**: card AC #1 and AC #2 both hold.

## Phase 3: Gates and grounding

- [x] T010 Run `REQUIRE_DATABASE=1 TEST_DATABASE_URL=<url> pnpm ci:check` in the worktree
  (lint, typecheck, build, test, boundaries, hooks, scripts, check:host-scripts). Save the
  summary, including DB suite skip counts (must be 0), to
  `specs/014-invite-conflict/ci-evidence.txt`.
- [x] T011 Wiki: review `docs/wiki/invitations.md` against this branch's diff. Amend the
  unique-violation paragraph: detection now uses the shared `isUniqueViolation` from
  `db.ts`, which checks `err.cause.code` because drizzle wraps pg errors. Re-pin
  `verified_against` to the branch HEAD only after the text is true.
- [x] T012 [P] Wiki: review `docs/wiki/library-schema.md`. Amend the `attachEmbeddings`
  bullet to say the detector is the shared one in `db.ts`. Re-pin honestly.
- [x] T013 [P] Wiki: review `docs/wiki/database-access.md` (its source `db.ts` changed) and
  `docs/wiki/test-suite.md` (its sources `db.test.ts` and `auth.integration.test.ts` changed;
  fix any test counts it states, or re-pin with a note that counts were re-verified). Add a
  link to [[database-access]] from `invitations` and `library-schema` if it helps routing.
  If any `description:` changes, regenerate `docs/wiki/CAPSULES.md`.
- [x] T014 Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.65.3/gates/cli.mjs freshness . docs/wiki`.
  It MUST print `OK`. Never use `gates/freshness.mjs`.
- [x] T015 Run `pnpm env:down` in the worktree. Run `pnpm env:prune --check`; it MUST exit 0.
- [x] T016 After merge: tick this file and run `spec-bridge:sync`.

## Dependencies & Execution Order

- Phase 1 blocks Phase 2 (the failure must be seen first). T003 is parallel to T002.
- Phase 2: T005 blocks T006 and T007; T006 and T007 touch different files and can run in
  parallel after T005. T008–T009 follow both.
- Phase 3 after Phase 2. T011–T013 can run in parallel; T014 after all three.

## Implementation Strategy

MVP = Phases 1–2 (the bug fixed and proven). Phase 3 is the per-PR gate set from
`docs/design/m1-wave2-sweep-runbook.md`. One implementer per phase, re-grounded from this
spec dir and the branch's commits.
