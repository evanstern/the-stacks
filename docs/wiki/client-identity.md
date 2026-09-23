---
name: client-identity
description: Why the SPA has no client-side identity store — the HttpOnly session cookie is unreadable by script, so GET /auth/me on load is the only source of truth, and that call itself is what makes identity persist across reload.
kind: pattern
sources:
  - apps/web/src/auth/api.ts
  - apps/web/src/auth/useAuth.ts
  - apps/web/src/routes/root.tsx
verified_against: e472b4777ed2db6debbaca8044b6b76e2af11ee3
---

# Client identity

The SPA never stores "who is signed in" anywhere on the client — not `localStorage`, not a
context default, not a decoded token. `fetchMe()` in `auth/api.ts` calls `GET /auth/me` with
`credentials: "same-origin"` and that response **is** the identity, every time it's needed.
This is a consequence of the session cookie being `HttpOnly` ([[session-auth]]): script cannot
read it, so there is nothing for a client-side store to be seeded from that would be more
trustworthy than just asking the server.

## How it works

`useIdentity()` (`auth/useAuth.ts`) is `useQuery({ queryKey: identityKey, queryFn: fetchMe,
retry: false })` — a TanStack Query wrapper with no other config. `fetchMe` treats `401`
specially: it resolves to `null` ("signed out"), not a thrown error, because a `401` here is
the **answer**, not a failure — the same request that establishes "who is this" also
establishes "is anyone." Any other non-OK status throws.

**This call *is* what makes identity persist across reload.** There is no separate
persistence mechanism to describe: a reload discards all JS state and re-mounts
[[spa-shell]]'s `RootLayout`, which calls `useIdentity()` again, which asks the server again.
If the cookie is still valid, `/auth/me` returns the same user and the UI looks like nothing
happened; if it expired, the same code path now returns `null` and `RootLayout` renders
`SignInView`. One request path serves both "am I signed in" and "did my session survive a
reload" — they are the same question asked from the same place.

`useSignIn()`/`useSignOut()` don't invalidate and refetch `identityKey` — they call
`queryClient.setQueryData(identityKey, user | null)` directly, since the sign-in/sign-out
response already carries (or implies) the new identity and a refetch would be redundant.
[[client-session-hook]] also writes to this same `identityKey` (via the exported constant) on
a `/auth/me` `401` seen during its own reconnect preflight — the one other place identity can
change outside a direct sign-in/out action.

## Connections

Read by [[spa-shell]]'s `RootLayout` as the identity gate. Shares `identityKey` with
[[client-session-hook]]. The server side of the same seam is [[session-auth]]'s
`validateSession`.

## Operational notes

`signIn()` throws one fixed message ("Invalid username or password.") regardless of which part
was wrong — mirroring the server's own indistinguishable `401` for a nonexistent user versus a
wrong password, so there is no client-side branch that could leak the difference even by
accident.
