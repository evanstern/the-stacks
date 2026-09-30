---
name: react-router-app
description: The web app's shape after the React Router 8 migration (doc-0003 / decision-0008) — framework-mode SSR by default, server.ts as the Hono-facing request handler, routes.ts's two routes, root.tsx as the loader-driven identity gate, and play.tsx as the one deliberately client-only route. Retires spa-shell (the pre-migration Vite SPA note).
kind: component
sources:
  - apps/web/app/root.tsx
  - apps/web/app/routes.ts
  - apps/web/app/routes/home.tsx
  - apps/web/app/routes/play.tsx
  - apps/web/app/sign-in.tsx
  - apps/web/react-router.config.ts
  - apps/web/server.ts
  - apps/web/vite.config.ts
  - apps/web/app/context.ts
verified_against: 7f44333a9fde6ce389a9808d2e417a89b4fa8630
---

# React Router app

`apps/web` is a React Router 8 **framework-mode** app with SSR on by default
(`react-router.config.ts`: `{ ssr: true, appDirectory: "app" }`) — this replaces the
pre-migration Vite SPA (the old `spa-shell` note is retired; this note covers what took its place, per
doc-0003 ruling 1). `vite.config.ts` wires `@tailwindcss/vite` and `@react-router/dev/vite`'s
`reactRouter()` plugin, with `tsconfigPaths` for the `~/*` import alias and an explicit SSR
build entry (`environments.ssr.build.rollupOptions.input: "./server.ts"`).

## How it works

**`server.ts`** is the module the SSR build compiles to `build/server/index.js` and the one
seam [[static-serving]]'s web middleware imports: it builds a React Router
`createRequestHandler(build, process.env.NODE_ENV)` once, and its exported `handle` (typed
`WebRequestHandler`, from `packages/shared/src/web.ts`) takes `(request, loadContext)`,
constructs a `RouterContextProvider`, sets `stacksContext` (`app/context.ts`,
`createContext<StacksLoadContext>()`) on it, and calls the request handler — the context key,
its provider, and every loader that reads it live in one module graph (plan D5, research R1).

**`routes.ts`** declares exactly two routes: `index("routes/home.tsx")` and
`route("play/:sessionId", "routes/play.tsx")`.

**`root.tsx`** is the identity gate, now server-side (see [[client-identity]] for the full
mechanism): its `Layout` renders the HTML shell (`Meta`/`Links` in `head`,
`Scripts`/`ScrollRestoration` in `body`), and its default component reads `loaderData.user` —
`<SignIn />` when falsy, `<Outlet />` otherwise, for any route. `links()` points at
`app/app.css?url` (Tailwind v4 + shadcn's CSS variables, see [[static-serving]]'s sibling
styling setup). An `ErrorBoundary` renders a plain error message.

**`home.tsx`** (`/`, signed-in view) shows the display name from `useRouteLoaderData<typeof
rootLoader>("root")` and a sign-out button that calls `signOut()` then
`useRevalidator().revalidate()`; a note that there is no session list — reaching
`/play/<uuid>` requires already knowing the id (unchanged from the SPA era, [[m0-demo]]'s D6).

**`sign-in.tsx`** exports `SignIn` (imported by `root.tsx`, not a routed component): a
`Card`/`Label`/`Input`/`Button` form (shadcn, [[static-serving]]'s styling note) that calls
`signIn(username, password)` then revalidates on success, and shows one generic failure
message on error (see [[client-identity]]). The submit button stays disabled until the
component has mounted (D10), so a pre-hydration submit can't leak the password into a GET
query string.

**`play.tsx` is the one deliberately client-only route** (doc-0003 ruling 1: realtime and
canvas routes stay client-only). It has a `clientLoader` (returns `{ sessionId:
params.sessionId }`) and a `HydrateFallback` (`Loading…`) but no server `loader` — so React
Router never attempts to SSR this route's data; the WebSocket connection [[client-session-hook]]
opens only exists in the browser. It reads the signed-in user via
`useRouteLoaderData<typeof rootLoader>("root")`, drives [[client-session-hook]]'s `useSession`
passing `revalidator.revalidate` as `onSignedOut`, and renders the event list plus a send
form — no optimistic append (unchanged from the SPA era).

## Connections

Served by [[static-serving]]'s `createWebMiddleware`, which imports `server.ts`'s built
`handle` as the SSR fallback for any non-reserved, non-static path. The identity gate is
detailed in [[client-identity]]; the play route's realtime behavior is
[[client-session-hook]]. The demo procedure that exercises this app end to end is
[[m0-demo]]. Built by `pnpm --filter @the-stacks/web build` into `build/client` and
`build/server`, consumed by [[container-image]]'s Dockerfile.

## Operational notes

`apps/web/test/ssr.test.mjs` ([[test-suite]]) is a real `node:test` suite now — not the
pre-migration placeholder — asserting the signed-out form, the signed-in display name, and
`/play/<uuid>`'s `HydrateFallback` all appear in the raw SSR HTML.
