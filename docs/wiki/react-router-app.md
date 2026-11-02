---
name: react-router-app
description: The web app's shape after the React Router 8 migration (doc-0003 / decision-0008) - framework-mode SSR by default, server.ts as the Hono-facing request handler, routes.ts's route tree (role-aware "/" redirect, ask/books/play/settings/about, play/:sessionId, operator-only play/:sessionId/debug and play/fixtures), root.tsx as the loader-driven identity gate wrapping the app shell, the sign-in card's invitation redeem mode, and the client-only play routes. Retires spa-shell.
kind: component
sources:
  - apps/web/app/root.tsx
  - apps/web/app/routes.ts
  - apps/web/app/routes/home.tsx
  - apps/web/app/routes/play.tsx
  - apps/web/app/routes/play-fixtures.tsx
  - apps/web/app/routes/play-fixture.tsx
  - apps/web/app/routes/play-debug.tsx
  - apps/web/app/routes/about.tsx
  - apps/web/app/sign-in.tsx
  - apps/web/react-router.config.ts
  - apps/web/server.ts
  - apps/web/vite.config.ts
  - apps/web/app/context.ts
verified_against: 85f778d1365d9968af0b94e21e78f5c058aebd1e
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

**`routes.ts`** declares ten routes (TASK-0028 added four to the original two; TASK-0043 added `about`; TASK-0047 added the two fixture routes; TASK-0117 added the debug route):
`index("routes/home.tsx")`, `route("ask", "routes/ask.tsx")`,
`route("books", "routes/books.tsx")`, `route("play", "routes/table.tsx")` (the Table
landing — join-by-id, start a fresh one, or follow "Your tables"; since TASK-0175 it reads `GET /api/tables` client-side after hydration, not through a loader), `route("play/fixtures", "routes/play-fixtures.tsx")` and
`route("play/fixtures/:fixtureName", "routes/play-fixture.tsx")` (operator-only fixture previews),
`route("play/:sessionId", "routes/play.tsx")`
(the live session, rendered by `TableView`), `route("play/:sessionId/debug", "routes/play-debug.tsx")`
(the operator debug page, a client-only route; see [[debug-view]]), `route("about", "routes/about.tsx")` (the SRD 5.2.1 attribution, CC-BY-4.0, a plain route not a modal; imports only `@the-stacks/srd/attribution` so no SRD data reaches the client bundle; see [[srd-data]]), and `route("settings", "routes/settings.tsx")`. The play and fixture routes are [[play-route]]'s concern; `ask.tsx`,
`books.tsx`, `table.tsx`, and `settings.tsx` are [[chat-ui]]'s concern — this note covers
only the tree's shape and which file backs each path.

**`root.tsx`** is the identity gate, now server-side (see [[client-identity]] for the full
mechanism): its `Layout` renders the HTML shell (`Meta`/`Links` in `head`,
`Scripts`/`ScrollRestoration` in `body`, plus a `data-theme` attribute on `<html>` from the
loader's UI-cookie read, [[chat-ui]]), and its default component reads `loaderData.user` —
`<SignIn />` when falsy; otherwise `<Outlet />` wrapped in `<AppStoreProvider><Shell>…`
(TASK-0028, [[chat-ui]]), for any route. `links()` points at the SVG icon `/favicon.svg` and at `app/app.css?url` (Tailwind v4 +
shadcn's CSS variables, see [[static-serving]]'s sibling styling setup). An `ErrorBoundary`
renders a plain error message.

**`home.tsx`** (`/`) is loader-only since TASK-0028: no signed-in view of its own anymore.
Its `loader` reads identity and redirects a signed-in operator to `/ask`, a signed-in player
to `/play` (the Table landing); it returns `null` only for the transient signed-out case,
since the root gate already renders `<SignIn />` and never mounts this route's `Outlet` then.
A component is still required — React Router otherwise treats `/` as a resource route and
`build/server` answers a bare loader JSON body instead of the document — so `Home` exports a
trivial `() => null`, unreachable in practice. The "no session registry" fact this route used
to state in its own copy ([[m0-demo]]'s D6) is unchanged; there's just no page text for it
anymore now that `/` never renders for a signed-in person.

**`sign-in.tsx`** exports `SignIn` (imported by `root.tsx`, not a routed component): a
`Card`/`Label`/`Input`/`Button` form (shadcn, [[static-serving]]'s styling note) that calls
`signIn(username, password)` then revalidates on success, and shows one generic failure
message on error (see [[client-identity]]). `SignIn` renders `SignInCard`, which holds a `mode`
(`signin` or `redeem`): the "Have an invitation?" button swaps in `RedeemForm` (token, username,
display name, password; "Back to sign in" swaps back). `submitRedeem` trims the token and calls
`redeemInvitation`; a 409 reads "That username is already taken.", a 400 on `token` reads the one
invalid/expired/redeemed message, other 400s show the issue messages, anything else a generic
line. The token never enters a URL; success calls `onSignedIn` (revalidate). The submit button stays disabled until the
component has mounted (D10), so a pre-hydration submit can't leak the password into a GET
query string.

**`play.tsx` is a deliberately client-only route** (doc-0003 ruling 1: realtime and
canvas routes stay client-only). It has a `clientLoader` (returns `{ sessionId:
params.sessionId }`) and a `HydrateFallback` (`Loading…`) but no server `loader` — so React
Router never attempts to SSR this route's data; the WebSocket connection [[client-session-hook]]
opens only exists in the browser. It reads the signed-in user via
`useRouteLoaderData<typeof rootLoader>("root")` (rendering `HydrateFallback` until there is
one) and renders `play/table-view.tsx`'s `TableView` over `useLiveTable(sessionId, user)`,
which drives [[client-session-hook]]'s `useSession`; no optimistic append. The TASK-0047
fixture routes and the TASK-0117 debug route (`play-debug.tsx`, a `clientLoader` plus `HydrateFallback` that renders `DebugGate`) follow the same client-only pattern and render `OperatorOnly` for non-operators.

## Connections

Served by [[static-serving]]'s `createWebMiddleware`, which imports `server.ts`'s built
`handle` as the SSR fallback for any non-reserved, non-static path. The identity gate is
detailed in [[client-identity]]; the play route's table is
[[play-route]] and its realtime behavior is [[client-session-hook]]. The demo procedure that exercises this app end to end is
[[m0-demo]]. The four TASK-0028 routes (`ask`, `books`, `play` as the Table landing,
`settings`), the app shell they render inside, and the client store behind them are
[[chat-ui]]. Built by `pnpm --filter @the-stacks/web build` into `build/client` and
`build/server`, consumed by [[container-image]]'s Dockerfile.

## Operational notes

`apps/web/test/ssr.test.mjs` ([[test-suite]]) is a real `node:test` suite now — not the
pre-migration placeholder — asserting the signed-out form, the signed-in display name, and
`/play/<uuid>`'s `HydrateFallback` all appear in the raw SSR HTML.
