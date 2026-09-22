# Quickstart — validating session auth

Runnable checks proving the feature works. Commands run from the repository root.

## Prerequisites

- The compose stack and a migrated database (spec 004's quickstart, steps 1–2).
- `TEST_DATABASE_URL` exported for host-run tests — see spec 004's quickstart step 3. Its
  absence is silent: the integration suite skips and the run goes green having proven nothing.

## 1. Apply this feature's migration

```bash
pnpm --filter @the-stacks/server db:migrate
```

**Expected**: `users`, `auth_sessions`, and `invitations` exist. Running it again applies
nothing (FR-015 reuses spec 004's migration workflow, so the same idempotency holds).

## 2. Provision the first operator

```bash
pnpm --filter @the-stacks/server auth:create-operator
```

**Expected**: an operator account exists and the command reports the username it created.

**Then run it again.** It must **refuse** rather than create a second operator or overwrite
the first (US3 scenario 2, research D6). A re-run that silently succeeds is a defect — that
is how an install gets quietly taken over.

**Also check**: before running it the first time, no account exists at all. No default
credential ships (FR-011) — if you can sign in to a fresh install without running this, that
is the single most serious defect this feature can have.

## 3. Run the test suite

```bash
pnpm test
```

**Expected**: sign-in, wrong-credential refusal, expired-session refusal, and single-use
invitation redemption all covered (FR-017).

**Read the output.** As with spec 004, a skipped integration suite proves nothing.

## 4. Sign in by hand

```bash
curl -i -X POST http://localhost:3000/auth/sign-in \
  -H 'content-type: application/json' \
  -d '{"username":"<operator>","password":"<password>"}'
```

**Expected**: `200`, and a `Set-Cookie` whose flags include `HttpOnly` and `SameSite=Lax`
(research D4). **`HttpOnly` is the one to check** — without it a script can read the session
token, which is exactly what FR-010 forbids.

Then the same request with a **wrong password**, and again with a **username that does not
exist**:

**Expected**: both return the **identical** status and body (SC-003). A different message, a
different status, or a noticeably different response time for the two cases leaks which
accounts exist.

## 5. Confirm the session works and sign-out revokes it

```bash
curl -s --cookie "<cookie from step 4>" http://localhost:3000/auth/me
curl -i -X POST --cookie "<cookie>" http://localhost:3000/auth/sign-out
curl -s -o /dev/null -w '%{http_code}\n' --cookie "<cookie>" http://localhost:3000/auth/me
```

**Expected**: `/auth/me` returns the operator; sign-out returns `204`; the third call returns
`401`. The same cookie must stop working immediately (FR-005) — not at expiry.

## 6. Invite a player and prove the invitation is single-use

```bash
curl -s -X POST --cookie "<operator cookie>" http://localhost:3000/auth/invitations
# then redeem it:
curl -i -X POST http://localhost:3000/auth/invitations/redeem \
  -H 'content-type: application/json' \
  -d '{"token":"<token>","username":"player1","displayName":"Player One","password":"<pw>"}'
# then redeem the SAME token again:
```

**Expected**: the first redemption returns `201`; the second is refused. Two accounts from
one invitation is the defect this check exists to catch (SC-005).

## What this quickstart does not cover

Password reset, rate limiting, and lockout are out of scope for M0 — recorded in the spec's
Assumptions rather than silently omitted.
