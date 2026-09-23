---
name: session-auth
description: Sign-in/sign-out/me, the session cookie's flags (HttpOnly, SameSite=Lax, Path=/, Secure only over HTTPS), and the validateSession seam shared verbatim by HTTP middleware and the WebSocket upgrade — including the identical 401 and timing defence against username enumeration.
kind: component
sources:
  - apps/server/src/auth/session.ts
  - apps/server/src/auth/middleware.ts
  - apps/server/src/routes/auth.ts
verified_against: e472b4777ed2db6debbaca8044b6b76e2af11ee3
---

# Session Auth

`apps/server/src/routes/auth.ts` mounts `/sign-in`, `/sign-out`, `/me`, and the invitation
routes (see [[invitations]]). `apps/server/src/auth/session.ts` owns session creation,
ending, and validation; `apps/server/src/auth/middleware.ts` is the thin Hono adapter over
`validateSession`.

## How it works

`createSession(db, userId)` generates a bearer token (`generateToken`, see [[invitations]]
for `tokens.ts`), stores only its hash (`hashToken`) plus a 30-day absolute `expiresAt`
(`SESSION_LIFETIME_MS`), and returns the raw token to the caller — the only moment it exists
outside the client's cookie. `endSession(db, token)` deletes the row by token hash; deleting a
session that's already gone is a success, not an error — sign-out is idempotent, and there is
no soft-delete to audit in M0.

**`createValidateSession(db)`** returns a closure — `(token: string) => Promise<{userId,
role} | null>` — this is the one fixed seam both HTTP and the socket share. It's a closure
rather than a plain function so `db` is captured once at wiring time instead of threaded as a
parameter on every call, letting `createAuthMiddleware` (HTTP) and the WebSocket upgrade
handler ([[websocket-gateway]]) bind to the exact same instance. It joins `auth_sessions` to
`users` on `tokenHash`, and returns `null` — the identical `null` — for an unknown token, a
malformed one, an expired one, and a signed-out one; no case distinguishes them to the caller.
It has **no side effects**: it never touches `expiresAt`, so validating a session never
extends it (no sliding expiry). It also does **not** catch datastore errors — a connection
failure propagates rather than being reported as `null`, since "the database is down" and "no
such session" are different failures and must not look the same.

`createAuthMiddleware(validateSession)` extracts the token from the `session` cookie
(`SESSION_COOKIE_NAME`) and sets `identity` on the Hono context to the resolved identity or
`null`. **It never itself rejects a request** — a `null` identity is left for the route
handler to interpret, which is what lets the same middleware be used to *optionally* attach
identity (e.g. `/sign-in` needs no identity; `/me` requires one and throws
`UnauthorizedError` itself when absent).

**The cookie**, set by `setSessionCookie` in `routes/auth.ts` on both sign-in and invitation
redemption: `httpOnly: true`, `sameSite: "Lax"`, `path: "/"`, `maxAge` = 30 days in seconds,
and `secure` set **conditionally** — `true` only when the inbound request's own URL scheme is
`https:`. An unconditional `Secure` flag would make the cookie silently never stored on a
self-hoster's first plain `http://localhost` run, which the constitution's self-hostability
requirement rules out. (The check reads the connection's own scheme, not
`x-forwarded-proto` — correct for the compose default of the app being reached directly, not
yet for a TLS-terminating reverse proxy in front of plain HTTP.)

**Sign-in's timing defence**: `/sign-in` looks up the user by case-insensitive username, then
calls `verifyPassword` against `user?.passwordHash ?? DUMMY_PASSWORD_HASH` — a fixed,
precomputed scrypt hash that belongs to no real account. A password is verified (the
expensive scrypt call runs) whether or not a user was found, so sign-in's response time
doesn't distinguish "unknown username" from "wrong password." Both paths that fail return the
identical `UnauthorizedError("Invalid username or password.")` — same message, same status —
so a fast "no such user" response can't be used to enumerate the account list.

## Connections

Backed by [[database-schema]]'s `users`/`auth_sessions` tables via [[database-access]].
Consumed by [[websocket-gateway]] (the same `validateSession` closure, at upgrade time) and by
[[invitations]] (redemption also calls `createSession`). Errors surface through the shape in
[[error-contract]].

## Operational notes

`SESSION_COOKIE_NAME` is `"session"`. There is no session listing or revoke-all endpoint at
this commit — ending one session ends only that token.
