# Implementation Plan: React SPA shell and the two-browser echo demo

**Branch**: `007-spa-shell-demo` | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-spa-shell-demo/spec.md`

## Summary

Build the client half of the walking skeleton and prove the M0 demo. The server half is
already merged and live-verified; this feature adds a React 19 + Vite SPA, serves it from the
existing app container, and demonstrates two signed-in people exchanging a message through
the event log.

**Every technology choice here is already ratified** by the constitution's Architecture
Constraints table (React 19, Vite, TanStack Router + Query, not SSR). There is no technology
selection left to make — only implementation against frozen contracts.

The approach in one line: **add a client workspace, teach the existing Hono app to serve its
build output, and connect it to two contracts that already work.**

## Technical Context

**Language/Version**: TypeScript 5.9, Node 22, `"type": "module"` throughout

**Primary Dependencies**: React 19, Vite, TanStack Router, TanStack Query (client, all new);
Hono 4 and `@hono/node-server` 2.1.1 (server, already present)

**Storage**: Postgres 17 — reached only through the existing server; the client has no
datastore access by construction (spec 006, FR-014)

**Testing**: Vitest exists for `apps/server`. The demo itself is verified by running it in
real browsers, per the milestone.

**Target Platform**: A modern browser against the compose stack; one Node process serves both
API and client

**Project Type**: Web application in an existing pnpm/Turborepo monorepo

**Performance Goals**: None specified for M0. This is a walking skeleton, not a load target.

**Constraints**: No new container (Principle IX). No client build tooling in the runtime
image. No change to the WebSocket frame shapes or auth contracts.

**Scale/Scope**: Two concurrent browsers — literally the demo's requirement.

## Constitution Check

*GATE: passed before Phase 0. Re-check after Phase 1 design.*

- [x] **I. Agent-operable** — the SPA adds **no new capability and no new interface**. It is a
      second consumer of `POST /auth/sign-in`, `GET /auth/me` and the `/ws` protocol, all of
      which an agent already drives directly. *Interface an agent uses*: those endpoints,
      unchanged. No capability becomes click-only.
- [ ] **II. Content contract** — N/A. This feature creates no codex entity.
- [x] **III. Data planes** — the client holds no state of its own beyond view state; all
      session-plane state stays in the event log, reached through the gateway seam.
- [x] **IV. Event sourcing** — unchanged and consumed, not extended. The client cannot write
      to the log except by asking the server to append (`send`), and never sets `actor`,
      `seq`, or `ts`.
- [ ] **V. Citations** — N/A. No library-derived claims.
- [ ] **VI. System-agnostic** — N/A. No mechanics; messages are opaque text.
- [x] **VII. Structured first** — the view renders recorded event data. Styling is minimal and
      deliberately deferred.
- [x] **VIII. Operator-owned content** — ships no rulebook content. Demo content is typed by
      the operator. NON-NEGOTIABLE, and untouched.
- [x] **IX. Self-hostable** — the whole point of User Story 1: the SPA ships **inside the
      existing app container**. No second container, no dev server in the demo path.

**Stack conformance** — React 19 + Vite SPA + TanStack Router/Query is exactly the Client row
of the Architecture Constraints table. No departure, so no amendment.

## Key technical decisions

These are resolved here so the implementer does not have to guess. Each was verified against
the code, not assumed.

### D1 — Static serving uses `@hono/node-server/serve-static`

`@hono/node-server@2.1.1` (already a dependency, no install needed) exports
`serveStatic({ root, rewriteRequestPath, onNotFound, … })`. **No new dependency is required
for FR-001/FR-002.**

**The trap that will bite**: `root` is documented as *relative to the current working
directory from which the app was started*. The Dockerfile sets `WORKDIR /app/apps/server`
before `CMD ["node", "dist/index.js"]`, so cwd in the container is `/app/apps/server` — not
the repo root, and not the SPA's output directory. The root must be resolved against that
reality and verified **in the container**, not only on a dev machine where cwd differs.

### D2 — Mount order, so the fallback shadows nothing (FR-003)

`apps/server/src/app.ts` composes `/health`, `/api/echo`, and `/auth` via `app.route(...)`,
with `app.notFound(notFoundHandler)` returning the structured `not_found` JSON body, and
`/ws` attached to the underlying server (not the Hono router) by `gateway.attach(server)`.

Therefore:

- `/ws` is **not** at risk from a Hono-level fallback — it is handled at upgrade, before Hono
  routing. Confirmed in `index.ts`.
- The API routes are at risk only if the static/fallback middleware is mounted ahead of them.
  **Mount it last.**
- The SPA fallback must return HTML only for paths that are not `/health`, `/api/*`, or
  `/auth/*`. Those keep returning the structured JSON 404 for unknown sub-paths — a spec 003
  contract that an over-broad fallback would silently break.

**Verified against the installed source** (`@hono/node-server` 2.1.1,
`dist/serve-static.mjs` ~lines 74-94): when no file matches, `serveStatic` calls
`onNotFound` and then `return next()` — it **falls through rather than responding**. So
`serveStatic` itself is *not* the hazard: `/api/unknown` finds no file, falls through, and
still reaches `notFoundHandler` with its structured JSON body. It also rejects paths
containing `..` or backslashes before touching the filesystem, so no extra traversal guard is
needed.

**The hazard is the SPA-shell fallback mounted after it** — the handler that returns
`index.html` so client-side deep links survive a direct load (FR-002). That one *does*
respond, and a catch-all version silently turns the API's JSON 404 into an HTML page. Scope
the shell fallback by path so it never answers for `/health`, `/api/*`, or `/auth/*`.

**This is the single highest-risk edit in the feature**, and the deliberate break to test
T008 against is a *catch-all shell fallback*, not a mis-mounted `serveStatic`.

### D3 — The client learns identity by asking (FR-007)

The session cookie is `HttpOnly` (contract 005), so the client cannot read it. On load, the
SPA calls `GET /auth/me`: `200` means signed in, `401` means show sign-in. That call **is**
AC#3's "persists across reload" — there is no client-side identity store to keep in sync.

### D4 — Resume uses the highest delivered `seq`, tracked by the client (FR-011)

`seq` may legitimately have gaps for a viewer filtered out of events (protocol, research D2).
The client stores the maximum `seq` it has actually been handed and passes it as `afterSeq`.
It must never compute "next expected" by incrementing, and must never treat a gap as loss.

### D5 — No optimistic render (FR-013)

A `send` is not acknowledged; the resulting `event` frame is the confirmation, and it reaches
every subscriber **including the sender**. So the sender's own message must render from the
arriving event. Rendering optimistically on submit and then also rendering the event produces
a visible duplicate — SC-004 exists to catch exactly that.

### D6 — The session id is supplied by the URL

No session registry exists, by design. The play route carries the session id as a route
parameter so both browsers reach the same session by opening the same URL, and so a reload
preserves it. Inventing a registry is out of scope and would exceed the card.

### D7 — The web workspace stops being a `tsc -b` stub

`apps/web` currently builds with `tsc -b` and is listed in the root `tsconfig.json`
references. Vite becomes its build, and its `typecheck` must still work under the repo-wide
`pnpm typecheck`. Keep the workspace's contract with the monorepo intact: `build`,
`typecheck`, and `test` scripts must all still exist and still pass, because Turborepo and
the root tsconfig reference them.

## Project Structure

### Documentation (this feature)

```text
specs/007-spa-shell-demo/
├── spec.md              # Phase -1 (authored)
├── plan.md              # This file
├── quickstart.md        # Phase 1 — how to run the demo (FR-017)
└── tasks.md             # Phase 2 (/speckit-tasks output)
```

**No `contracts/` directory.** This feature *consumes* contracts 005 and 006 and introduces no
new interface of its own; writing a third contract here would duplicate frozen text and
create a second source of truth. **No `data-model.md`**: no new persisted entity.

### Source Code (repository root)

```text
apps/web/                          # was a bare tsc stub; becomes the SPA
├── index.html                     # Vite entry
├── vite.config.ts
├── package.json                   # + react, react-dom, vite, tanstack router/query
├── tsconfig.json                  # DOM libs; still typechecks under the root build
└── src/
    ├── main.tsx                   # mounts React, Router, QueryClientProvider
    ├── routes/                    # TanStack Router route tree (sign-in, play/:sessionId)
    ├── auth/                      # GET /auth/me, sign-in, sign-out via TanStack Query
    └── ws/                        # subscribe, highest-seq tracking, send

apps/server/src/
├── app.ts                         # + SPA static mount, LAST (D2)
└── static.ts                      # (new) the serve-static + fallback middleware

Dockerfile                         # build the client; copy its output into runtime
```

**Structure Decision**: The existing monorepo layout stands — `apps/web` for the client,
`apps/server` for the server, `packages/shared` untouched. This feature adds no workspace and
no container; it fills in the one workspace that was scaffolded empty in TASK-0010.

## Phasing

| phase | delivers | gate before moving on |
|---|---|---|
| **P1** | SPA builds; container serves it; API routes unshadowed | US1 scenarios, incl. the JSON-404 check |
| **P2** | Router + Query wired; sign-in; `/auth/me` on load; sign-out | US2 scenarios incl. reload |
| **P3** | Subscribe, render replay + live through one path, send | US3 scenarios |
| **P4** | The two-browser demo, run for real; quickstart written | US4 / SC-002, evidence recorded |

P1 is genuinely first: nothing can be demonstrated in a browser until the container serves a
page.

## Risks

- **The fallback shadows an API route** (D2). Mitigated by mounting last and by an explicit
  test asserting `/api/*` and `/auth/*` unknown paths still return the structured JSON 404.
- **`serveStatic` root resolves differently in the container than on the host** (D1). Mitigated
  by verifying in the running container, which is where the demo has to work anyway.
- **The demo is declared done from green tests.** This sweep has already been bitten by tests
  that passed against broken implementations. SC-002 requires running it in two real browser
  contexts with separate cookie jars; two tabs in one profile share a cookie jar and prove
  nothing.
- **Duplicate rendering of the sender's own message** (D5) — easy to introduce, visible only
  when actually looking at the screen.

## Complexity Tracking

> No Constitution Check violations. Nothing to justify.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *(none)* | | |
