---
name: static-serving
description: createWebMiddleware's reserved-path guard, its module-relative (not cwd) default roots, and the key fact that serveStatic falls through on a miss so a full SSR render — via server.ts's handler, not a static shell — is what could shadow the API if mount order were wrong. Load for web-routing or "why did /api return HTML" questions.
kind: component
sources:
  - apps/server/src/static.ts
  - apps/server/src/app.ts
verified_against: a82067ceb8794332fc5106885fadc185f1c34c7b
---

# Static serving

`apps/server/src/static.ts` exports `createWebMiddleware({ clientRoot?, handler?, lookup,
listJobs })` (plan D4, `listJobs` added TASK-0028 plan D2), a Hono `MiddlewareHandler` that serves the built web app's static assets and, for
everything else, hands the request to React Router's own SSR handler — this replaced the
older `createStaticMiddleware`'s flat `index.html`-shell fallback when the app migrated off
the Vite SPA (doc-0003 / decision-0008; see [[react-router-app]]).

## How it works

Two default paths, both resolved from **this module's own compiled location**
(`dirname(fileURLToPath(import.meta.url))`), not `process.cwd()`: `DEFAULT_CLIENT_ROOT` is
`apps/web/build/client` and `DEFAULT_SERVER_ENTRY` is `apps/web/build/server/index.js`. The
comment explains why the relative path works out: `apps/server/dist/static.js` and
`apps/web/build/...` sit in the same relative position in a worktree and in the image
(`/app/apps/…`), so the Dockerfile's `WORKDIR` doesn't matter. `createWebMiddlewareOptions`
lets tests override both `clientRoot` and `handler`.

Before touching the filesystem, the middleware checks `isReservedPath(c.req.path)` against
`RESERVED_PREFIXES = ["/health", "/api", "/auth", "/ws", "/library"]` (exact match or
`${prefix}/...`) — `isReservedPath` is exported so dev mode's Vite middleware wrapper
([[server-entrypoint-and-app]]) can reuse the identical check. A reserved path calls `next()`
immediately and never reaches static or SSR logic. `/ws` is listed even though it never
reaches Hono routing at all (it's intercepted at the HTTP upgrade, before Hono sees it) — the
comment says listing it "costs nothing and documents the intent."

For everything else, it calls Hono's `serveStatic({ root: clientRoot })` with a **dummy
`next`** that resolves to `undefined`: `const asset = await serve(c, async () => undefined)`.
**The key fact this note exists to record:** `serveStatic` itself, on a miss, calls the
`next` it was given and returns whatever that resolves to — here, `undefined` — rather than
throwing or returning a 404 Response. So `serveStatic` never shadows anything; it always
either returns the matched file's `Response` or falls through cleanly. If `asset` is
truthy, that Response is returned as-is (a real static file, e.g. hashed JS/CSS). If not,
and the path is `/favicon.ico`, it answers 204 (the real icon is `apps/web/public/favicon.svg`, linked from the root route); otherwise
the middleware loads the SSR handler (a cached dynamic `import()` of `DEFAULT_SERVER_ENTRY`,
or the injected `handler` override) and calls it with `(c.req.raw, createWebLoadContext(c, {
lookup, listJobs }))` — React Router itself now renders the matching route, or its own 404, for any
non-reserved path with no matching static file (plan D4: an unknown path is no longer a
blanket 200 shell). **This SSR fallback, not `serveStatic`, is the thing that could shadow
the API**: if this middleware were ever mounted before a real route (instead of after, per
[[server-entrypoint-and-app]]'s route order), that route would never be reached — a request
would get a rendered page instead of the API's JSON.

The comment on the dummy-`next` trick also notes it avoids relying on `c.finalized`, which
only reflects the *outer* dispatch's assignment to `c.res`, not a Response returned by a
middleware invoked directly like this.

## Connections

Mounted last in [[server-entrypoint-and-app]]'s `app.ts`, after `/health`, `/api/echo`,
`/auth`, and `/library` ([[ingestion]], TASK-0024) — that ordering, not anything inside this
file, is what actually prevents API shadowing. Its default roots are populated by
[[container-image]]'s Dockerfile. Serves [[react-router-app]]'s build output, and imports its
`server.ts`-built `handle` as the SSR entry. `createWebLoadContext` (`apps/server/src/web.ts`)
is the load-context builder [[client-identity]] documents in full.

## Operational notes

A request to an unregistered path under `/health`, `/api`, `/auth`, `/library`, or `/ws`
still reaches the global JSON 404 from [[error-contract]] (via `next()` → no matching route →
`notFoundHandler`), never a rendered page. Every other unmatched path is handed to React
Router, which renders its own not-found route — there is no separate blanket-200 shell state
for the web side anymore.
