# Feature Specification: Frontend stack migration (React Router 8 SSR, Tailwind v4, shadcn/ui)

**Feature Branch**: `task-0040-frontend-stack`

**Created**: 2026-09-30

**Status**: Draft

**Board task**: TASK-0040

**Input**: Implement the doc-0003 rulings (ratified 2026-09-29, decision-0008). Port the
existing routes (sign-in, home, play) off TASK-0016's TanStack SPA shell onto React Router 8
in framework mode with SSR on by default, Tailwind v4, and shadcn/ui. Mount React Router's
request handler inside the Hono app as the last middleware. This task pre-empts TASK-0028,
which rebases onto its merge and builds the chat UI on the new foundation.

**Scope**: a port. No new product surface. Sign-in, home, and play behave as they do today.
The M0 two-browser echo demo passes. Nothing from TASK-0028's chat UI is built here. Two
additions, approved 2026-09-30 (plan.md checkpoints 5 and 6): a hot-reload dev mode, and the
constitution's Client row amendment.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The signed-in app works as before, now server-rendered (Priority: P1)

A person opens the app. The server answers with rendered HTML: the sign-in form when there is
no live session, or the home view with their display name when there is. They sign in, see
home, and sign out, exactly as today. No TanStack package remains in the client.

**Maps to**: card AC #1, AC #6.

**Why this priority**: this is the migration itself. Every later UI task builds on it.

**Independent Test**: request `/` with `curl`, once without a cookie and once with a valid
session cookie. The raw HTML contains the sign-in form in the first case and the display name
in the second. Then sign in and out in a browser.

**Acceptance Scenarios**:

1. **Given** no session cookie, **When** the browser requests `/`, **Then** the response is
   200 HTML that already contains the sign-in form before any script runs.
2. **Given** a valid session cookie, **When** the browser requests `/`, **Then** the HTML
   already contains "Signed in as" and the person's display name.
3. **Given** the sign-in form, **When** the person submits correct credentials, **Then** the
   home view renders with their display name, without a full page reload.
4. **Given** the sign-in form, **When** the person submits wrong credentials, **Then** the
   form shows "Invalid username or password." and nothing else distinguishes the cases.
5. **Given** the home view, **When** the person signs out, **Then** the sign-in form renders.
6. **Given** a session that expired, **When** the person reloads any route, **Then** the
   sign-in form renders in place of that route.
7. **Given** the built client, **When** its `package.json` and lockfile entry are read,
   **Then** neither `@tanstack/react-router` nor `@tanstack/react-query` is present.

### User Story 2 - The play session still works, client-only (Priority: P1)

Two people open the same `/play/<uuid>` in two browsers with separate cookie jars. The play
route renders a loading fallback on the server and runs its WebSocket session only after
hydration. A message from one browser appears in the other. A reload replays history.

**Maps to**: card AC #2, AC #7.

**Why this priority**: the M0 milestone must not regress. The play route is the template
for every later realtime and canvas route (doc-0003 ruling 1).

**Independent Test**: the M0 demo (quickstart.md §4), run twice: on the per-worktree stack
and on the built container image.

**Acceptance Scenarios**:

1. **Given** a signed-in person, **When** the server renders `/play/<uuid>`, **Then** the HTML
   holds the fallback ("Loading…") and no event list.
2. **Given** that page hydrates, **When** the client loader runs, **Then** the session hook
   opens `/ws` and subscribes with the session id from the URL.
3. **Given** two browsers on one session, **When** one sends a message, **Then** it appears
   once in each browser.
4. **Given** that exchange, **When** either browser reloads, **Then** the prior messages
   replay from the event log.
5. **Given** the play view, **When** the session's `/auth/me` preflight answers 401, **Then**
   the app renders the sign-in form.

### User Story 3 - The API surface never reaches the page handler (Priority: P1)

An agent or a script calls the HTTP API. Requests under the reserved paths reach their own
handlers or the structured JSON 404. They never receive rendered HTML.

**Maps to**: card AC #3.

**Why this priority**: constitution I. Agents drive the app through these routes, and an HTML
answer from an API path breaks every client silently.

**Independent Test**: the reserved-path test in `apps/server/test/static.test.ts`.

**Acceptance Scenarios**:

1. **Given** the app, **When** a request hits `/health`, `/api/…`, `/auth/…`, `/ws`, or
   `/library/…`, **Then** the React Router handler is never called.
2. **Given** an unknown sub-path under a reserved prefix, **When** it is requested, **Then**
   the response is the structured JSON 404.
3. **Given** a non-reserved path, **When** it matches a built client asset, **Then** the asset
   is served and the handler is not called.
4. **Given** any other non-reserved path, **When** it is requested, **Then** the handler
   receives the original Web `Request` and a load context.

### User Story 4 - Loaders reach server data through a typed seam (Priority: P2)

A web developer writes a loader. It reads server data from a typed load context whose
interface lives in `packages/shared`. It never imports `apps/server` and never calls the
app's own HTTP API.

**Maps to**: card AC #4.

**Why this priority**: constitution III, and the seam TASK-0028's role-aware shell needs.

**Independent Test**: the root loader reads identity through the load context. `pnpm
check:boundaries` and `pnpm lint` stay green.

**Acceptance Scenarios**:

1. **Given** the root loader, **When** it runs on the server, **Then** it reads identity
   (id, display name, role) from the load context.
2. **Given** `apps/web`, **When** Biome lints it, **Then** no import of `apps/server` exists.
3. **Given** `packages/shared`, **When** its dependencies are read, **Then** it has gained no
   runtime dependency.

### User Story 5 - The UI foundation is in place (Priority: P2)

A web developer starting TASK-0028 finds Tailwind v4 wired through Vite, shadcn/ui
initialized with a few base components, light and dark tokens, and a system font stack. No
CDN, webfont, `Dialog`, or `AlertDialog` exists.

**Maps to**: card AC #5.

**Why this priority**: TASK-0028 builds on it. Constitution IX forbids a CDN or webfont.

**Independent Test**: the no-CDN and no-dialog greps in tasks.md Phase 6.

**Acceptance Scenarios**:

1. **Given** the built client, **When** it is searched for `fonts.googleapis`, `cdn.`,
   `unpkg`, and `jsdelivr`, **Then** there are zero hits.
2. **Given** `apps/web`, **When** it is searched for a dialog component, **Then** there are
   zero hits.
3. **Given** the sign-in form, **When** it renders, **Then** it uses the shadcn `Button`,
   `Input`, `Label`, and `Card` components.

### User Story 6 - Docs and wiki describe the new stack (Priority: P3)

A reader opens `docs/design/architecture.md` or the wiki. They find the new client stack,
citing doc-0003, and notes re-grounded against the new code.

**Maps to**: card AC #8, AC #9, and plan.md checkpoint 6.

**Why this priority**: grounding freshness is a merge gate.

**Independent Test**: read A1's Client row. Run the wiki freshness gate.

**Acceptance Scenarios**:

1. **Given** architecture A1, **When** the Client row is read, **Then** it names React
   Router 8 framework mode with SSR, Tailwind v4, and shadcn/ui, and cites doc-0003.
2. **Given** the wiki, **When** the freshness gate runs, **Then** it prints `OK`, and
   `static-serving`, `spa-shell` (or its successor), `container-image`, and
   `server-entrypoint-and-app` are pinned to this task's code.
3. **Given** the constitution, **When** its Client row is read, **Then** it matches A1 and
   cites doc-0003 / decision-0008, at version 1.0.1.

### User Story 7 - A web developer gets hot reload against real server data (Priority: P2)

A web developer runs `pnpm dev` in a worktree. The app serves on the stack's port against the
stack's database. They edit a route file, and the browser updates without a rebuild or a
restart. Loaders read the same load context as production. `/ws` and the reserved paths
behave as in production.

**Maps to**: plan.md checkpoint 5 (approved 2026-09-30).

**Why this priority**: TASK-0028 is UI-heavy. A rebuild-and-restart loop slows every edit.

**Independent Test**: the dev-mode check in quickstart.md §2, recorded in
`ci-evidence.txt`.

**Acceptance Scenarios**:

1. **Given** `pnpm dev` is running, **When** a route file's text changes, **Then** the open
   browser shows the new text without a reload or a restart.
2. **Given** `pnpm dev` and a valid session cookie, **When** `/` is requested with `curl`,
   **Then** the HTML contains the display name.
3. **Given** `pnpm dev`, **When** `/health`, `/auth/me`, or `/library/nope` is requested,
   **Then** Hono answers with JSON, never page HTML.
4. **Given** `pnpm dev` and two browsers on one session, **When** one sends a message,
   **Then** it appears once in each, over `/ws`.

### Edge Cases

- **Datastore unreachable during the root loader.** `identity()` throws. The root error
  boundary renders an error page with a 500. It never renders "signed out", matching the
  WebSocket preflight's rule that a datastore blip must not sign anyone out.
- **Sign-in form before hydration.** A native submit would send the password as a GET query
  string. The form uses `method="post"`, and its submit button stays disabled until
  hydration.
- **Unknown non-reserved path** (a typo'd URL). React Router answers 404 with its error
  boundary. Today the SPA shell answers 200. This is the one visible behaviour change.
- **Session cookie present, user row deleted.** `identity()` returns `null`, as `/auth/me`
  does today.
- **Play route with a non-UUID id.** Unchanged: the server refuses the subscribe, as today.
- **Web build absent** (server tests, a server-only build). The server still boots. The page
  handler loads on first use. Tests inject a fake handler.
- **Two worktrees run `pnpm dev` at once.** The second HMR port collides. Set
  `WEB_HMR_PORT` by hand for the second.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `apps/web` MUST run React Router 8 in framework mode with `ssr: true`.
- **FR-002**: The routes MUST be `/` (home) and `/play/:sessionId` (play). Sign-in MUST
  render in place of any route when there is no identity, as today.
- **FR-003**: The play route MUST export a `clientLoader` and a `HydrateFallback`, and MUST
  NOT export a server `loader`.
- **FR-004**: The root route's server `loader` MUST return the signed-in identity (id,
  display name, role) or `null`, read from the load context.
- **FR-005**: `packages/shared` MUST export the load-context interface and the page-handler
  signature as types only. It MUST gain no runtime dependency.
- **FR-006**: `apps/server` MUST implement the load context. Identity MUST be resolved from
  the session cookie through the existing `validateSession` seam, with no HTTP call.
- **FR-007**: Hono MUST mount the page handler as the last middleware. Requests under
  `/health`, `/api`, `/auth`, `/ws`, and `/library` MUST NOT reach it.
- **FR-008**: Built client assets MUST be served before the page handler is consulted.
- **FR-009**: The app MUST stay one Node process on one port. The compose topology MUST NOT
  change.
- **FR-010**: Tailwind v4 MUST be wired through `@tailwindcss/vite`. The font stack MUST be a
  system stack. No CDN and no webfont MAY be referenced.
- **FR-011**: shadcn/ui MUST be initialized in `apps/web` with `Button`, `Input`, `Label`,
  and `Card` only. `Dialog` and `AlertDialog` MUST NOT be added.
- **FR-012**: `@tanstack/react-router` and `@tanstack/react-query` MUST be removed.
- **FR-013**: Sign-in, sign-out, and the session hook MUST keep calling the documented
  `/auth/*` and `/ws` routes. After each, the app MUST re-run the root loader instead of
  keeping a client-side identity copy.
- **FR-014**: The sign-in form MUST NOT send credentials in a URL, before or after
  hydration.
- **FR-015**: The container image MUST ship the web server build and its production
  dependencies, and no build tooling.
- **FR-016**: `docs/design/architecture.md` A1's Client row MUST cite doc-0003.
- **FR-017**: `REQUIRE_DATABASE=1 pnpm ci:check` MUST exit 0, including `check:boundaries`
  and `check:host-scripts`.
- **FR-018**: `pnpm dev` MUST run Vite in middleware mode inside the Hono process, loaded by
  a dev-only dynamic `import("vite")` and plugged in through `createApp`'s `web.handler`
  option. It MUST run against the per-worktree stack's database.
- **FR-019**: In dev mode, a route edit MUST hot-reload. Loaders MUST receive the same load
  context as production. `/ws` and every reserved path MUST still be served by Hono.
- **FR-020**: Production code and the container image MUST NOT import or contain `vite`.
- **FR-021**: `.specify/memory/constitution.md` MUST be amended as a PATCH bump. Its Client
  row MUST cite doc-0003 / decision-0008.

### Key Entities

- **Load context** (`StacksLoadContext`): the server's per-request offer to loaders. Today it
  carries one lazy operation, `identity()`.
- **Public user** (`PublicUser`): `{ id, displayName, role }`, the shape `/auth/me` already
  returns.
- **Page handler** (`WebRequestHandler`): `(request: Request, context: StacksLoadContext) =>
  Promise<Response>`, exported by the web server build and called by Hono.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `curl` of `/` returns HTML containing the sign-in form with no cookie, and the
  display name with a valid cookie.
- **SC-002**: The M0 two-browser demo passes on the per-worktree stack and on the container
  image. Both runs are recorded in the PR body.
- **SC-003**: The reserved-path test proves zero handler calls for each reserved prefix.
- **SC-004**: The SSR test renders `/` signed out, `/` signed in, and `/play/<uuid>` from the
  built server bundle.
- **SC-005**: The no-CDN grep and the no-dialog grep both return zero hits.
- **SC-006**: `REQUIRE_DATABASE=1 pnpm ci:check` exits 0 with zero skipped database suites.
- **SC-007**: The wiki freshness gate prints `OK`. The spec-bridge check exits 0.
- **SC-008**: The dev-mode check passes and is recorded in `ci-evidence.txt`: a route edit
  hot-reloads, the cookie `curl` shows the display name, the reserved paths answer JSON, and
  the echo works over `/ws`. `apps/server/dist/index.js` has no static `vite` import.
- **SC-009**: The constitution reads version 1.0.1, and its Client row cites doc-0003.

## Assumptions

- doc-0003's rulings bind. This spec does not revisit the stack choice.
- There is no dev script today. This task adds one, with hot reload (research R8).
- The operator approved plan.md's six checkpoints on 2026-09-30, all as recommended.
- The Daylight palette, the sidebar, the `Sheet` component, and cookie-read UI state are
  TASK-0028's. This task leaves the seams only: the root loader returns identity with role,
  and loaders receive the raw `Request`, so cookies are readable there.
- Browser automation uses Brave:
  `/Applications/Brave Browser.app/Contents/MacOS/Brave Browser`.
