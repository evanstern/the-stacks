# Contract — HTTP auth endpoints

**Status: internal to TASK-0014.** Unlike [validate-session.md](./validate-session.md),
these have no second consumer inside this sweep, so they are documented rather than frozen.
TASK-0016's SPA consumes them, and may request changes through the normal spec route.

All responses use the structured error shape spec 003 established. No endpoint below
discloses whether an account exists.

## `POST /auth/sign-in`

**Request**: `{ username: string, password: string }`

**Success** `200`: `{ user: { id, displayName, role } }`, plus a `Set-Cookie` carrying the
session token with the flags from research D4.

**Failure** `401`: the **same** body and status for a wrong password and an unknown
username (FR-004, SC-003). The implementation must also avoid a timing channel — verify a
hash even when no user was found, so the response time does not distinguish the two cases.
A fast "no such user" and a slow "wrong password" leaks the account list as surely as a
different message does.

## `POST /auth/sign-out`

**Request**: no body; the session cookie identifies the session.

**Success** `204`: the session row is deleted and the cookie is cleared. **Idempotent** — a
second sign-out also returns `204` (spec edge case). Signing out something already gone is
not an error.

## `GET /auth/me`

**Request**: the session cookie.

**Success** `200`: `{ user: { id, displayName, role } }` — who the caller is.

**Failure** `401`: no valid session. This is the endpoint the SPA calls on load to decide
whether to show a signed-in view, so it must be cheap and must not extend the session
(FR-008).

## `POST /auth/invitations`

**Request**: the session cookie of an **operator**; optional `{ expiresInDays?: number }`.

**Success** `201`: `{ token: string, expiresAt: string }` — the token is returned **exactly
once, here**, because only its hash is stored (research D2). The operator hands it over
themselves; nothing is emailed (spec Assumptions).

**Failure** `403`: the caller is a player, not the operator (FR-012). `401` if unauthenticated.

## `POST /auth/invitations/redeem`

**Request**: `{ token: string, username: string, displayName: string, password: string }` —
no session required; this is how a new person gets one.

**Success** `201`: the player account is created and they are signed in (cookie set), so
redeeming does not dump them at a login form to type the password they just chose.

**Failure** `400`/`409`: the invitation is unknown, expired, or already redeemed — again
without distinguishing which, and `409` when the username is taken. Under simultaneous
redemption exactly one request succeeds (FR-013, SC-005).
