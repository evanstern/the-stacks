---
name: client-identity
description: Why identity is resolved server-side, per request, through the load context — no client identity store, no polling hook. createWebLoadContext reads and memoizes the session cookie once per request; root.tsx's loader calls it and gates every route; sign-in/sign-out force a re-run via useRevalidator rather than writing a client cache.
kind: pattern
sources:
  - apps/web/app/auth.ts
  - apps/web/app/root.tsx
  - apps/server/src/web.ts
  - packages/shared/src/web.ts
verified_against: 785838b58f8b8b080d3c784da3fc9b5418c40f77
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

`apps/web/app/root.tsx`'s `loader` is `async ({ context, request }) => { const user = await
context.get(stacksContext).identity(); const ui = readUiPrefs(request.headers.get("cookie"));
return { user, ui }; }` — it runs on **every** request, including a reload, so identity is
always re-asked from the server, never assumed from client state. (`ui` is the per-browser
theme/sidebar cookie read, [[chat-ui]]'s concern, not identity's — it rides the same loader
because there is only one root loader.) The default `Root` component renders `<SignIn />`
when `loaderData.user` is falsy — for any route, not just `/`, since the gate lives on the
root route every child renders through (unchanged in effect from the SPA-era gate this
replaces) — otherwise it wraps `<Outlet />` in `<AppStoreProvider><Shell>…</Shell></AppStoreProvider>`
(keyed on `user.id`, so switching accounts remounts the store); `AppStoreProvider`'s
`onUnauthorized` is wired to the same `revalidator.revalidate()` this note describes below,
not a second mechanism.

**Sign-in and sign-out don't write to any client cache — they force the loader to re-run.**
`apps/web/app/auth.ts`'s `signIn`/`signOut` are thin `fetch` wrappers over
`/auth/sign-in`/`/auth/sign-out` (`credentials: "same-origin"`); `sign-in.tsx`'s form and the
one "Sign out" control — now pinned at the bottom of `shell/shell.tsx` for both roles, not a
per-page button (`home.tsx` is loader-only; `play.tsx` dropped its own copy) — call one of
these, then `useRevalidator().revalidate()`. Revalidation re-runs `root.tsx`'s loader (a fresh
server request, a fresh cookie read), which is what actually flips the rendered view — there
is no `setQueryData`-style direct write anywhere in this path. [[client-session-hook]]'s
reconnect preflight does the same thing on a `401`: it calls the `onSignedOut` callback it was
given, which `play.tsx` wires to the same `revalidator.revalidate`.

## Connections

Read by `apps/web/app/root.tsx`'s `Root` as the identity gate for the whole app (the React
Router framework-mode app this replaces the old SPA shell with). Passes the `onSignedOut`
callback into [[client-session-hook]]. The server side of the same seam is
[[session-auth]]'s `validateSession`, reached here through the shared `IdentityLookup`
(`apps/server/src/auth/identity.ts`) rather than a second implementation.
`StacksLoadContext` (`packages/shared/src/web.ts`) also carries `jobs()`, an
operator-gated method next to `identity()` in the same per-request context; its shape and
callers are [[chat-ui]]'s concern, not this note's.

## Operational notes

`signIn()` throws one fixed message ("Invalid username or password.") regardless of which part
was wrong — mirroring the server's own indistinguishable `401` for a nonexistent user versus a
wrong password, so there is no client-side branch that could leak the difference even by
accident. `sign-in.tsx`'s submit button stays disabled until the component has mounted (D10),
so a pre-hydration form submit can't send the password in a GET query string.
