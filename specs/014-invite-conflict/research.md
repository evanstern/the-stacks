# Research: Invitation redeem conflict

## R1 — Where the shared helper lives

- **Decision**: export `isUniqueViolation(err: unknown): boolean` from
  `apps/server/src/db.ts`. Keep `POSTGRES_UNIQUE_VIOLATION = "23505"` module-private there.
- **Rationale**: `db.ts` is the only module that constructs the pg pool and the Drizzle
  client, so the driver's error shape belongs with it. `library/store.ts` already imports
  `../db.js`; `auth/invitations.ts` reaches it through `auth/session.ts` today. `db.ts` sits
  outside every plane directory, so no boundary rule applies. `check:host-scripts` already
  imports `db.ts` under raw `--experimental-strip-types`, so the new export is exercised by
  that check for free.
- **Alternatives considered**: a new `apps/server/src/db-errors.ts` (one more file for one
  function; rejected); `errors.ts` (that module holds the HTTP error contract, not driver
  details; rejected); `packages/shared` (the web app has no database; rejected).

## R2 — Detector behavior

- **Decision**: return true when `err.code === "23505"` or `err.cause.code === "23505"`;
  false for everything else, never throwing. Same logic as store.ts at 83ebc51.
- **Rationale**: drizzle-orm 0.45 wraps driver errors in `DrizzleQueryError` with the
  original on `cause`. Bare `err.code` still matters for raw `pg` calls outside drizzle.
- **Alternatives considered**: walk the whole `cause` chain (no caller needs it; marked as a
  `ponytail:` ceiling); `instanceof DrizzleQueryError` (couples to a class name and misses
  raw pg errors; rejected).

## R3 — How to prove it

- **Decision**: add one integration case to `apps/server/test/auth.integration.test.ts`,
  using its existing `createTestUser` and `createTestInvitation` helpers. Assert:
  (1) `redeemInvitation` with the taken username returns `{ ok: false, reason: "conflict" }`;
  (2) the same with the username upper-cased returns `conflict`;
  (3) `POST /auth/invitations/redeem` with the taken username answers 409 with
  `error.kind === "conflict"`;
  (4) the same invitation then redeems with a fresh username (201) — the failed attempts
  left it unspent.
  Add a unit case to `apps/server/test/db.test.ts`: bare code, wrapped code, other code,
  `null`, `undefined`, a string, `{}`, `{ cause: null }`.
- **Rationale**: the card requires a real-database proof; only a real unique index produces
  the real wrapped error. The unit case pins the helper's edge inputs cheaply.
- **Test first**: the integration case MUST fail before the fix (today it throws a
  `DrizzleQueryError`), and the implementer records that failure in the task notes.

## R4 — Runtime environment

- **Decision**: run the database suites on this worktree's own stack: `pnpm env:up`, then
  `REQUIRE_DATABASE=1` with `TEST_DATABASE_URL` from the generated `.env`, then
  `pnpm env:down` before the worktree is removed.
- **Rationale**: runbook gate "Database suites RUN, not skip"; CI sets `REQUIRE_DATABASE=1`
  too.
