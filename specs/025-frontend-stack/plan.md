# Implementation Plan: Frontend stack migration (React Router 8 SSR, Tailwind v4, shadcn/ui)

**Branch**: `task-0040-frontend-stack` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)
**Board task**: TASK-0040 | **Input**: `specs/025-frontend-stack/spec.md`
**Binding rulings**: `backlog/docs/doc-0003 - Frontend-stack-—-rulings.md` (decision-0008)

## Summary

Rewrite `apps/web` as a React Router 8 framework-mode app with SSR on. Its own server entry,
`apps/web/server.ts`, exports `handle(request, context)`. Hono mounts it as the last
middleware, after the reserved-path guard and the static-asset lookup, in place of the
`index.html` fallback. Identity reaches the root loader through a typed load context, whose
interface lives in `packages/shared` and whose implementation lives in `apps/server`. The play
route goes client-only. Tailwind v4 and four shadcn components land as the styling
foundation. TanStack Router and Query go. One process, one port, no topology change.

## Technical Context

**Language/Version**: TypeScript 5.9, Node 22 (ESM), React 19.3.

**Primary Dependencies**: `react-router` 8.4.0, `@react-router/dev` 8.4.0, Tailwind 4.3.3,
shadcn/ui (copied source). Full list: [New dependencies](#new-dependencies).

**Storage**: none new. The load context reads `auth_sessions` and `users` through existing
code.

**Testing**: vitest (server): the reserved-path suite. `node:test` (web): an SSR render suite
against the built server bundle. Manual: the M0 demo, twice, and the hot-reload dev check
(D7).

**Target Platform**: the runtime image (`node:22-alpine`) and the per-worktree stack.

**Project Type**: web app plus server, one process.

**Constraints**: no CDN, no webfont, no `Dialog`/`AlertDialog`, no `apps/server` import from
`apps/web`, no self-HTTP from loaders, no new service or port.

**Scale/Scope**: `apps/web` rewritten (~500 lines today), `static.ts`/`app.ts` edited, one new
shared types file, one dev-only server file (`web-dev.ts`), `Dockerfile`, `turbo.json`, `biome.json`, root `package.json`, `.gitignore`,
architecture.md, the constitution's Client row, wiki notes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Agent-operable** — every capability stays behind a documented route: sign-in,
      sign-out, and `/auth/me` under `/auth`, play under `/ws`. The pages call those same
      routes. Reserved paths never return page HTML, so an agent's client never gets an
      HTML answer from an API path (FR-007).
- [x] **II. Content contract** — N/A: no codex entity. Forms built later from Zod contracts
      are TASK-0028's and beyond (doc-0003 ruling 3).
- [x] **III. Data planes** — `apps/web` never imports `apps/server`. The load-context
      interface lives in `packages/shared` as types only. The Biome boundary rules do not
      change, and `check:boundaries` stays green (FR-005, FR-006).
- [x] **IV. Event-sourced play** — the play route's session hook is unchanged: no optimistic
      append, `afterSeq` from the highest delivered `seq`, and render on the arriving event.
- [x] **V. Citations** — N/A: no library-derived claims.
- [x] **VI. System-agnostic** — N/A: no mechanics.
- [x] **VII. Structured first** — N/A: no generated artifacts.
- [x] **VIII. Operator-owned content** — N/A: ships no content. `/library` becomes a reserved
      path, so the page handler can never serve it.
- [x] **IX. Self-hostable** — `docker compose up` is unchanged: same two containers and one
      volume. No CDN, no webfont, and a system font stack (FR-010). The image still carries
      no build tooling.

**Stack conformance** — the Architecture Constraints table's Client row ("React 19, Vite SPA,
TanStack Router and Query. Not SSR.") is superseded by doc-0003 (ratified 2026-09-29,
decision-0008). This plan implements the ratified replacement. It does not introduce the
deviation. This PR amends the constitution's Client row (PATCH 1.0.1, task T055), so the
deviation closes here.

## Design

### D1 — Layout of `apps/web`

```text
apps/web/
├── app/
│   ├── root.tsx              # Layout (html/head/body, Meta, Links, Scripts), loader, identity gate, ErrorBoundary
│   ├── routes.ts             # index("routes/home.tsx"), route("play/:sessionId", "routes/play.tsx")
│   ├── routes/home.tsx       # HomeView port
│   ├── routes/play.tsx       # clientLoader + HydrateFallback + PlayView port
│   ├── sign-in.tsx           # rendered by root when user is null (not a route)
│   ├── auth.ts               # signIn()/signOut() fetch wrappers (from src/auth/api.ts); fetchMe() deleted
│   ├── context.ts            # stacksContext = createContext<StacksLoadContext>()
│   ├── ws/types.ts           # moved unchanged
│   ├── ws/useSession.ts      # moved; the 401 branch calls onSignedOut() instead of setQueryData
│   ├── lib/utils.ts          # cn()
│   ├── components/ui/        # button.tsx, input.tsx, label.tsx, card.tsx (shadcn)
│   └── app.css               # @import "tailwindcss"; @theme; light/dark variables
├── server.ts                 # the SSR entry: export const handle: WebRequestHandler
├── react-router.config.ts    # { ssr: true, appDirectory: "app" }
├── vite.config.ts            # tailwindcss(), reactRouter(), environments.ssr input server.ts
├── components.json           # shadcn config
├── test/ssr.test.mjs         # node:test against build/server/index.js
├── tsconfig.json             # noEmit, rootDirs, paths ~/* → app/*
└── package.json
```

Deleted: `index.html`, `src/` (whole tree: `main.tsx`, `router.tsx`, `auth/useAuth.ts`, the
old route files).

`app/root.tsx` and the default `entry.client`/`entry.server` from React Router are used
as-is. Reveal an entry only if a later need arises.

### D2 — Identity: cookie → load context → root loader

```text
browser ── Cookie: session=… ──▶ Hono static.ts middleware
                                   │ reserved? → next()
                                   │ asset?    → file
                                   ▼
                        loadContext = { identity: () => lookupIdentity(getCookie(c,"session")) }
                                   ▼
                        handle(c.req.raw, loadContext)          (apps/web/server.ts)
                                   │ new RouterContextProvider(); set(stacksContext, loadContext)
                                   ▼
                        root loader: { user: await context.get(stacksContext).identity() }
```

- `apps/server/src/auth/identity.ts` (new) exports
  `createIdentityLookup({ db, validateSession })`, returning
  `(token: string | undefined) => Promise<PublicUser | null>`. It runs `validateSession`,
  then selects the user row, and returns `null` for no token, no session, or no user. It
  does not catch a datastore error.
- `GET /auth/me` switches to the same lookup, so the two paths cannot drift.
- `apps/server/src/web.ts` (new) exports
  `createWebLoadContext(c, lookup): StacksLoadContext`, with `identity()` memoized per
  request. The `validateSession` built once in `createApp` is threaded in, not rebuilt.
- The root component renders `<SignIn />` when `user` is `null`, and `<Outlet />`
  otherwise. This matches today's gate: sign-in renders in place of any route.
- Sign-in, sign-out, and the session hook's 401 call `useRevalidator().revalidate()`. The
  root loader re-runs, and the new cookie decides. No client-side identity copy exists.
- **Cookies in loaders**: every loader receives the raw `request`, so
  `request.headers.get("cookie")` is readable. TASK-0028's sidebar and theme cookies need
  nothing more from this task.
- **Role**: the root loader returns `role` inside `user`. TASK-0028's role-aware sidebar
  reads it from `useRouteLoaderData("root")`.

### D3 — The load-context interface (`packages/shared`)

`packages/shared/src/web.ts`, re-exported from `index.ts`, holds types only:

```ts
export type Role = "operator" | "player";
export interface PublicUser { id: string; displayName: string; role: Role }
/** Per-request server data offered to React Router loaders (doc-0003 ruling 5). */
export interface StacksLoadContext { identity(): Promise<PublicUser | null> }
/** The web server bundle's entry; Hono calls it with c.req.raw. */
export type WebRequestHandler =
  (request: Request, context: StacksLoadContext) => Promise<Response>;
```

`packages/shared` gains no dependency. Its tsconfig inherits `lib: ["ES2022"]`, which lacks
the `Request` and `Response` types. Add `"lib": ["ES2022", "DOM"]` to
`packages/shared/tsconfig.json`. A later loader need adds one method here, in the task that
needs it.

### D4 — The Hono mount

`apps/server/src/static.ts` becomes the web middleware. It keeps its file name, so the wiki
pin and the test file keep their names.

```ts
const RESERVED_PREFIXES = ["/health", "/api", "/auth", "/ws", "/library"];

export function createWebMiddleware({ clientRoot, handler, lookup }): MiddlewareHandler {
  const serve = serveStatic({ root: clientRoot });
  return async (c, next) => {
    if (isReservedPath(c.req.path)) return next();
    const asset = await serve(c, async () => undefined);
    if (asset) return asset;
    return (await handler())(c.req.raw, createWebLoadContext(c, lookup));
  };
}
```

- `handler` is `() => Promise<WebRequestHandler>`. The default loads
  `../../web/build/server/index.js` once, through a cached dynamic `import()`, resolved from
  `import.meta.url`. `clientRoot` defaults to `../../web/build/client` the same way.
- `createApp` swaps `staticRoot?: string` for `web?: { clientRoot?: string; handler?: () =>
  Promise<WebRequestHandler> }`, and mounts the middleware last, as today.
- Export `isReservedPath`. Dev mode's request wrapper uses it (D7).
- `/ws` stays in the list. The upgrade never reaches Hono, and the entry documents intent.
- Asset caching headers are out of scope. `serveStatic` behaves as today.

### D5 — The web server entry

```ts
// apps/web/server.ts
import { createRequestHandler, RouterContextProvider } from "react-router";
import type { WebRequestHandler } from "@the-stacks/shared";
import * as build from "virtual:react-router/server-build";
import { stacksContext } from "~/context";

const requestHandler = createRequestHandler(build, process.env.NODE_ENV);

export const handle: WebRequestHandler = (request, loadContext) => {
  const context = new RouterContextProvider();
  context.set(stacksContext, loadContext);
  return requestHandler(request, context);
};
```

The context key, the provider, and every loader live in one bundle, so key identity holds
(research R1). The server passes a plain object that satisfies the shared type.

### D6 — Build output and the Dockerfile

- `react-router build` writes `apps/web/build/client/**` and `apps/web/build/server/index.js`.
- `apps/web/package.json`: `build` is `react-router build`; `typegen` is
  `react-router typegen`; `typecheck` is `react-router typegen && tsc -b`; `test` is
  `node --test test/`.
- Root `package.json`: `typecheck` becomes `pnpm --filter @the-stacks/web typegen && tsc -b`.
- `turbo.json`: `build.outputs` gains `"build/**"`. Add
  `"@the-stacks/web#test": { "dependsOn": ["build"], "cache": false }`.
- `.gitignore`: add `.react-router/`. `build/` is already ignored.
- `Dockerfile`, runtime stage:
  - install with `--filter "@the-stacks/server..." --filter "@the-stacks/web..."`;
  - copy `apps/web/build` to `apps/web/build`;
  - drop the `apps/web/dist → apps/server/public` copy and its comment;
  - update the comment on the install line: the web app's production deps (React, React
    Router, shadcn runtime packages) are needed by the SSR bundle.
- `WORKDIR` and `CMD` do not change.

### D7 — Dev mode: Vite in middleware mode inside Hono

Hot reload is in scope (checkpoint 5). Vite runs inside the Hono process, so loaders get the
same load context as production.

- `apps/server/src/web-dev.ts` (new, dev-only) exports
  `createWebDev({ webRoot, hmrPort }): Promise<{ handler, middlewares }>`:
  - `const { createServer } = await import("vite")`;
  - `createServer({ root: webRoot, appType: "custom", server: { middlewareMode: true, hmr:
    { port: hmrPort } } })`, which loads `apps/web/vite.config.ts`;
  - `handler` is `async () => (await vite.ssrLoadModule("/server.ts")).handle`. It re-imports
    per request, so an edit takes effect on the next request;
  - `middlewares` is `vite.middlewares`, for `/@vite/*`, module requests, and CSS.
- `apps/server/src/index.ts`: when `STACKS_WEB_DEV=1`, `await import("./web-dev.js")`. Pass
  `web: { handler }` to `createApp`. Pass `serve()` a `createServer` option that wraps the
  Hono listener: a non-reserved request goes through `middlewares` first, then Hono; a
  reserved request goes straight to Hono. `static.ts` exports `isReservedPath` for this.
- HMR uses its own WebSocket port (`WEB_HMR_PORT`, default 24678). The `/ws` gateway destroys
  every other upgrade on the app port, so HMR cannot share it.
- `/ws` and the reserved paths stay Hono's: the gateway still attaches to the same server,
  and reserved requests skip Vite.
- Scripts: `apps/server` gains `"dev": "tsc -b && STACKS_WEB_DEV=1 node
  --env-file-if-exists=../../.env dist/index.js"`. Root gains
  `"dev": "pnpm --filter @the-stacks/server dev"`.
- Production never imports vite. `index.ts` has no static import of `vite` or `web-dev.js`,
  and the image has no `vite` package. `vite` joins `apps/server` devDependencies only, for
  the dynamic import and its types.
- ponytail: one HMR port per host by default. Two worktrees running `pnpm dev` at once set
  `WEB_HMR_PORT` by hand. Derive it from `APP_PORT` when that collision recurs.

### D8 — Styling foundation

- `vite.config.ts`: `plugins: [tailwindcss(), reactRouter()]`, `resolve.tsconfigPaths: true`,
  `environments.ssr.build.rollupOptions.input: "./server.ts"`.
- `app/app.css`:
  - `@import "tailwindcss";`
  - `@custom-variant dark (&:is(.dark *));`
  - shadcn's neutral `:root` and `.dark` variables, mapped in `@theme inline`;
  - `--font-sans: system-ui, sans-serif;` in `@theme`.
- No `@import url(...)`, no `<link>` to any font host, no `fonts.*` anywhere.
- `root.tsx` imports `./app.css?url` and emits it through `links()`.
- `biome.json`: set `css.parser.tailwindDirectives: true`, so Biome parses `@theme`,
  `@custom-variant`, and `@apply`.

### D9 — shadcn/ui

- `apps/web/components.json`: style `new-york`, `rsc: false`, `tsx: true`, `tailwind.config:
  ""`, `tailwind.css: "app/app.css"`, `tailwind.baseColor: "neutral"`, `cssVariables: true`,
  aliases `components: "~/components"`, `ui: "~/components/ui"`, `utils: "~/lib/utils"`,
  `lib: "~/lib"`, `hooks: "~/hooks"`.
- Hand-write `app/lib/utils.ts` (`cn`). Then run `pnpm dlx shadcn@4.21.0 add button input
  label card` from `apps/web`. Reject any prompt that would install an icon or animation
  package.
- Components now: `Button`, `Input`, `Label`, `Card`, used by `sign-in.tsx`. Home and play
  use `Button` for sign-out and send.
- **Never** `Dialog` or `AlertDialog` (no-modals rule). TASK-0028 adds `Sheet`.
- The pages stay plain. This task adds no visual design beyond the components' defaults.

### D10 — Sign-in before hydration

The form uses `method="post"`, `onSubmit` with `preventDefault()`, and a submit `Button`
disabled until `useHydrated()`-style state flips on mount. A pre-hydration submit therefore
cannot send the password in a GET query string (FR-014). A progressively enhanced sign-in
action is out of scope (research R3).

### D11 — TanStack

Remove `@tanstack/react-router` and `@tanstack/react-query` (research R10). The identity cache
was Query's only job; the root loader and `revalidate()` replace it. **Verdict: Query is
removed; no surface in scope needs a client cache.**

### D12 — Boundary rules

`biome.json`'s `noRestrictedImports` overrides do not change. `apps/web` imports only
`@the-stacks/shared` (types) and its own `~/*`. `fixtures/boundary-violations/` does not
change. `check:boundaries` runs in `ci:check`.

### D13 — Tests

- **Reserved paths** (`apps/server/test/static.test.ts`, rewritten; research R11): a fake
  handler records calls. Each reserved prefix gives zero calls. Unknown sub-paths under
  `/api`, `/auth`, `/library` return the JSON 404. A fixture asset is served with zero
  calls. `/play/abc` gives one call with a `Request` for that URL. `identity()` without a
  cookie resolves `null` with an unused database.
- **Identity lookup**: `auth.integration.test.ts` gains one case: the lookup returns the
  user for a live token and `null` for a signed-out one. The existing `/auth/me` cases keep
  covering the refactor.
- **SSR render** (`apps/web/test/ssr.test.mjs`): import `build/server/index.js`, call
  `handle` with stub contexts. It asserts three things: `/` signed out shows the form, `/`
  signed in shows the display name, and `/play/<uuid>` shows the fallback.
- **Manual**: the M0 demo on the stack and on the image (quickstart.md §4, §5).
- **Dev mode** (recorded manual check, quickstart.md §2): a route edit hot-reloads; `curl`
  with a cookie shows the display name; `/health`, `/auth/me`, and `/library/nope` answer
  JSON; the M0 echo works over `/ws`. A grep proves `dist/index.js` has no static vite
  import.

### D14 — `check:host-scripts`

No change (research R12). `config.ts` and `db.ts` are untouched. It re-runs inside
`ci:check`.

## Operator checkpoints — resolved 2026-09-30

The operator approved all six as recommended.

1. **New dependencies**: approved as listed. `vite` for `apps/server` was added after the
   checkpoint; it follows from approved checkpoint 5.
2. **Reserved paths**: approved. Adding `/library` aligns the code with the stated contract.
3. **Unknown-path behaviour**: approved. A non-reserved unknown path returns React Router's
   404.
4. **Hono adapter**: the hand-written bridge is approved (research R1).
5. **Dev mode**: hot reload is in scope. Vite runs in middleware mode inside Hono (D7,
   research R8).
6. **Constitution Client row**: amended in this PR as a PATCH bump citing doc-0003 /
   decision-0008 (T055).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| ~~Client row of the constitution's Architecture Constraints table (SPA, TanStack)~~ Resolved in this PR: T055 amends the row (constitution 1.0.1) | doc-0003 / decision-0008, ratified 2026-09-29 | Keeping the SPA contradicts a ratified operator ruling |

## New dependencies

All go into `apps/web/package.json`, except `vite` for `apps/server`. `packages/shared` gains
none.

| Package | Version | Why | Runtime or dev |
|---|---|---|---|
| `react-router` | 8.4.0 | Framework mode: routes, loaders, `createRequestHandler`, `RouterContextProvider` (ruling 1) | runtime |
| `@react-router/node` | 8.4.0 | Node stream helpers the default `entry.server` imports. Drop it if `react-router reveal` shows the default entry does not import it | runtime |
| `isbot` | 5.2.2 | Bot check in the default `entry.server`. Same drop rule as above | runtime |
| `radix-ui` | 1.6.7 | `Slot` (Button) and `Label` primitives for shadcn components | runtime |
| `class-variance-authority` | 0.7.1 | shadcn `Button` variants | runtime |
| `clsx` | 2.1.1 | `cn()` helper for shadcn | runtime |
| `tailwind-merge` | 3.7.0 | `cn()` helper for shadcn | runtime |
| `@react-router/dev` | 8.4.0 | Vite plugin, `react-router build`, `typegen` | dev |
| `tailwindcss` | 4.3.3 | Tailwind v4 (ruling 2) | dev |
| `@tailwindcss/vite` | 4.3.3 | Tailwind's Vite plugin (ruling 2) | dev |
| `vite` (in `apps/server`) | ^8.3.0, already in the lockfile via `apps/web` | Dev-only `import("vite")` for hot reload (D7). Added after checkpoint; follows from approved checkpoint 5 | dev |

**Removed**: `@tanstack/react-router`, `@tanstack/react-query`, `@vitejs/plugin-react`.

**Not added now**: `lucide-react` and `tw-animate-css`, until a component needs them.
`shadcn` runs through `pnpm dlx` and is never installed.
