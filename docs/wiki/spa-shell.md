---
name: spa-shell
description: The Vite-built React SPA's shape — a code-based TanStack Router route tree, main.tsx mounting Router plus QueryClientProvider, and the root route acting as the app's identity gate for every path.
kind: component
sources:
  - apps/web/src/main.tsx
  - apps/web/src/router.tsx
  - apps/web/src/routes/root.tsx
  - apps/web/src/routes/home.tsx
  - apps/web/src/routes/sign-in.tsx
  - apps/web/vite.config.ts
  - apps/web/index.html
  - apps/web/package.json
verified_against: e472b4777ed2db6debbaca8044b6b76e2af11ee3
---

# SPA shell

`apps/web` is a plain Vite + React SPA — not SSR, per the architecture's fixed constraints.
`index.html` loads `src/main.tsx` as a module; there is no server-rendered HTML beyond that
static shell. It is built with `vite build` and served by the app container as static files
(see [[static-serving]]), not by a dev server in production.

## How it works

`vite.config.ts` is minimal — just `@vitejs/plugin-react`, no proxy or SSR config. `main.tsx`
mounts the app once: `createRoot(...).render(<StrictMode><QueryClientProvider
client={queryClient}><RouterProvider router={router} /></QueryClientProvider></StrictMode>)`.
`QueryClient` is TanStack Query's cache, used throughout for server state (identity, later
mutations) rather than any separate client-side store.

The route tree in `router.tsx` is **code-based**, not file-based: `createRootRoute({ component:
RootLayout })` as the root, with two children built via `createRoute` —
`indexRoute` (`"/"` → `HomeView`) and `playRoute` (`"/play/$sessionId"` → `PlayView`). The
session id rides the URL param directly; there is no session registry to resolve it through
(see [[m0-demo]]'s D6) — two browsers reach the same session only by opening the identical
link.

`RootLayout` (in `routes/root.tsx`) is the **identity gate**: it calls `useIdentity()` (see
[[client-identity]]) on every mount. Because a page reload re-mounts the whole app, this always
re-asks the server. While pending it renders a loading paragraph; once resolved, `!identity
.data` renders `SignInView` in place of `<Outlet />` — for **any** route, not just `/`, since
the gate lives on the root route every child renders through. There is no route-level
`beforeLoad`/loader guard; the gate is a plain component check.

`HomeView` (`/`) shows the signed-in person's display name and a sign-out button, plus a note
that there is no session list — reaching `/play/<uuid>` requires already knowing the id.
`SignInView` is a plain controlled form (username/password) that calls `useSignIn()` and shows
one generic failure message on error (see [[client-identity]]).

## Connections

Feeds off [[client-identity]] for the gate and [[client-session-hook]] for the play route.
Served by the server side of [[static-serving]]. The demo procedure that exercises this shell
end to end is [[m0-demo]].

## Operational notes

`package.json`'s `test` script is a placeholder (`echo "no tests yet" && exit 0`) — there is no
client-side test suite at this commit; see [[test-suite]] for what *is* covered (server-only).
