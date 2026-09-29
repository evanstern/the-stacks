---
name: static-serving
description: createStaticMiddleware's reserved-path guard, its module-relative (not cwd) default root, and the key fact that serveStatic falls through on a miss so the SHELL fallback — not serveStatic — is what could shadow the API if mount order were wrong. Load for SPA-routing or "why did /api return HTML" questions.
kind: component
sources:
  - apps/server/src/static.ts
  - apps/server/src/app.ts
verified_against: c732622ca88b9055779079909e330d034bb329d6
---

# Static serving

`apps/server/src/static.ts` exports `createStaticMiddleware(clientRoot?)`, a Hono
`MiddlewareHandler` that serves the built SPA's static assets and falls back to `index.html`
for unmatched paths, so client-side routes survive a direct load or a page reload.

## How it works

The default root, `DEFAULT_CLIENT_ROOT`, is computed as
`join(dirname(fileURLToPath(import.meta.url)), "..", "public")` — resolved from **this
module's own compiled location**, not `process.cwd()`. The comment explains why this
matters: the Dockerfile sets `WORKDIR /app/apps/server` before `CMD` (see
[[container-image]]), so cwd is not the repo root at runtime, but the module's own location
(`apps/server/dist/static.js`) is fixed relative to `apps/server/public`, where the
Dockerfile copies the client build output. `createApp`'s optional `staticRoot` parameter
overrides this for tests.

Before touching the filesystem, the middleware checks `isReservedPath(c.req.path)` against
`RESERVED_PREFIXES = ["/health", "/api", "/auth", "/ws"]` (exact match or `${prefix}/...`);
a reserved path calls `next()` immediately and never reaches static logic. `/ws` is listed
even though it never reaches Hono routing at all (it's intercepted at the HTTP upgrade,
before Hono sees it) — the comment says listing it "costs nothing and documents the intent."

For everything else, it calls Hono's `serveStatic({ root: clientRoot })` with a **dummy
`next`** that resolves to `undefined`: `const asset = await serve(c, async () => undefined)`.
**The key fact this note exists to record:** `serveStatic` itself, on a miss, calls the
`next` it was given and returns whatever that resolves to — here, `undefined` — rather than
throwing or returning a 404 Response. So `serveStatic` never shadows anything; it always
either returns the matched file's `Response` or falls through cleanly. If `asset` is
truthy, that Response is returned as-is (a real static file, e.g. hashed JS/CSS). If not,
the middleware falls through to `c.html(readFileSync(join(clientRoot, "index.html"),
"utf-8"))` — the SPA shell — **unconditionally**, for any non-reserved path with no matching
file. **This shell fallback, not `serveStatic`, is the thing that could shadow the API**: it
is a catch-all that always returns a 200 HTML response, so if this middleware were ever
mounted before a real route (instead of after, per [[server-entrypoint-and-app]]'s route
order), that route would never be reached — a request would get the SPA shell instead of the
API's JSON.

The comment on the dummy-`next` trick also notes it avoids relying on `c.finalized`, which
only reflects the *outer* dispatch's assignment to `c.res`, not a Response returned by a
middleware invoked directly like this.

## Connections

Mounted last in [[server-entrypoint-and-app]]'s `app.ts`, after `/health`, `/api/echo`,
`/auth`, and `/library` ([[ingestion]], TASK-0024) — that ordering, not anything inside this
file, is what actually prevents API shadowing. Its default root is populated by
[[container-image]]'s Dockerfile. Serves [[spa-shell]]'s build output.

## Operational notes

A request to an unregistered path under `/health`, `/api`, `/auth`, or `/ws` still reaches
the global JSON 404 from [[error-contract]] (via `next()` → no matching route → `notFoundHandler`),
never the HTML shell. Every other unmatched path gets `index.html` with a 200, even a typo'd
URL — there is no distinct "not found" state for the SPA side.
