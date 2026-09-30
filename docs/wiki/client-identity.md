---
name: client-identity
description: Why identity is resolved server-side, per request, through the load context — no client identity store, no polling hook. createWebLoadContext reads and memoizes the session cookie once per request; root.tsx's loader calls it and gates every route; sign-in/sign-out force a re-run via useRevalidator rather than writing a client cache.
kind: pattern
sources:
  - apps/web/app/auth.ts
  - apps/web/app/root.tsx
  - apps/server/src/web.ts
  - packages/shared/src/web.ts
verified_against: 7f44333a9fde6ce389a9808d2e417a89b4fa8630
---

# Client identity

Since the React Router migration (doc-0003 / decision-0008), the web app has no client-side
identity store at all — not `localStorage`, not a TanStack Query cache, not a decoded token.
Identity is resolved **server-side, per request**, through React Router's load context, and
`root.tsx`'s loader is the one place that reads it.

## How it works

`createWebLoadContext(c, lookup)` (`apps/server/src/web.ts`) builds one `StacksLoadContext`
per request: its `identity()` method reads the `session` cookie with Hono's `getCookie` and
runs `lookup` (the same `IdentityLookup` `/auth/me` uses) at most once, memoizing the result
for the lifetime of that context — a root loader and any later loader on the same request
share one lookup rather than paying for it twice. `PublicUser`, `Role`, and
`StacksLoadContext` are declared once in `packages/shared/src/web.ts` (plan D3) so the
server's implementation and the client's typed access to `loaderData.user` can't drift.

`apps/web/app/root.tsx`'s `loader` is `async ({ context }) => ({ user: await
context.get(stacksContext).identity() })` — it runs on **every** request, including a reload,
so identity is always re-asked from the server, never assumed from client state. The default
`Root` component renders `<SignIn />` when `loaderData.user` is falsy, `<Outlet />` otherwise
— for any route, not just `/`, since the gate lives on the root route every child renders
through (unchanged in effect from the SPA-era gate this replaces).

**Sign-in and sign-out don't write to any client cache — they force the loader to re-run.**
`apps/web/app/auth.ts`'s `signIn`/`signOut` are thin `fetch` wrappers over
`/auth/sign-in`/`/auth/sign-out` (`credentials: "same-origin"`); `sign-in.tsx` and the
sign-out buttons in `home.tsx`/`play.tsx` call one of these, then `useRevalidator().revalidate()`.
Revalidation re-runs `root.tsx`'s loader (a fresh server request, a fresh cookie read), which
is what actually flips the rendered view — there is no `setQueryData`-style direct write
anywhere in this path. [[client-session-hook]]'s reconnect preflight does the same thing on a
`401`: it calls the `onSignedOut` callback it was given, which `play.tsx` wires to the same
`revalidator.revalidate`.

## Connections

Read by `apps/web/app/root.tsx`'s `Root` as the identity gate for the whole app (the React
Router framework-mode app this replaces the old SPA shell with). Passes the `onSignedOut`
callback into [[client-session-hook]]. The server side of the same seam is
[[session-auth]]'s `validateSession`, reached here through the shared `IdentityLookup`
(`apps/server/src/auth/identity.ts`) rather than a second implementation.

## Operational notes

`signIn()` throws one fixed message ("Invalid username or password.") regardless of which part
was wrong — mirroring the server's own indistinguishable `401` for a nonexistent user versus a
wrong password, so there is no client-side branch that could leak the difference even by
accident. `sign-in.tsx`'s submit button stays disabled until the component has mounted (D10),
so a pre-hydration form submit can't send the password in a GET query string.
