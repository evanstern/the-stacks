# Research — 025 frontend stack migration

Decisions made against the code at `50d7fee`. doc-0003's rulings are taken as given; this
file records only how to build them. Package versions were checked with `npm view` on
2026-09-30. The lockfile already holds `react@19.3.0`, `react-dom@19.3.0`, `vite@8.3.0`; the
host runs Node `22.23.2`.

## R1 — Hono adapter: a hand-written bridge, no package

- **Decision**: no adapter package. The web app's own server entry
  (`apps/web/server.ts`) wraps React Router's core `createRequestHandler` in a function with
  the signature `(request: Request, context: StacksLoadContext) => Promise<Response>`. Hono
  calls it with `c.req.raw` and returns the `Response` as-is. The whole bridge is about
  eight lines in `server.ts` plus three in `static.ts`.
- **Why**: `createRequestHandler` from `react-router` already takes a Web `Request` and
  returns a Web `Response`. Hono on `@hono/node-server` already hands us `c.req.raw` as a Web
  `Request`. No translation layer is needed, so a package would only add surface.
- **Why the entry lives in `apps/web`**: React Router 8 turns middleware on by default, so
  loaders receive a `RouterContextProvider`, read with `context.get(key)`. The key is an
  object from `createContext()`, and lookup is by identity. If the server created the
  provider, it would need the same key instance, and so a runtime import of web code or a
  runtime `react-router` dependency in `packages/shared`. Building the provider inside the
  web bundle keeps the key, the provider, and every loader in one module graph. The server
  passes a plain object that satisfies a type from `packages/shared`.
- **Alternatives rejected**:
  - *`react-router-hono-server` (4.1.4)*: it owns the server. It builds the Hono app, the
    listen call, and its own WebSocket wiring. That collides with `index.ts`,
    `gateway.attach(server)`, and doc-0003 ruling 4's "one Node process" as this repo
    implements it. It also adds a dependency for about ten lines of code.
  - *`@hono/react-router-adapter`*: not published on npm today (`npm view` 404).
  - *`@react-router/express` behind a Hono-to-Express shim*: two frameworks in one process.
  - *Key in `packages/shared`* (`createContext` exported from shared): gives shared a
    runtime `react-router` dependency, and Vite bundles linked workspace packages into the
    SSR build by default, so the server's copy and the bundle's copy would be different key
    objects. Fixable with `ssr.external`, but fragile.

## R2 — Load context: `identity()`, lazy, typed in `packages/shared`

- **Decision**: `packages/shared/src/web.ts` exports three types and no values:

  ```ts
  export interface PublicUser { id: string; displayName: string; role: "operator" | "player" }
  export interface StacksLoadContext { identity(): Promise<PublicUser | null> }
  export type WebRequestHandler =
    (request: Request, context: StacksLoadContext) => Promise<Response>;
  ```

  `apps/server` builds one `StacksLoadContext` per request. `identity()` reads the `session`
  cookie with `getCookie`, calls the existing `validateSession`, then selects the user row,
  exactly as `GET /auth/me` does. The lookup is extracted once and shared by both callers.
- **Why lazy**: static assets and reserved paths never pay for a database query. A future
  loader that does not need identity never pays either.
- **Why `identity()` and nothing else**: the three ported routes need only identity. Each
  later loader need (TASK-0028's jobs and books reads) adds one method to this interface in
  the task that needs it (YAGNI).
- **Error rule**: `identity()` does not catch. `validateSession` throws when the datastore is
  unreachable, and the root error boundary renders a 500. It never renders "signed out".
- **Alternatives rejected**: an eager `identity` value (a query on every asset-free request,
  even when unused); a loader calling `GET /auth/me` (forbidden by ruling 5).

## R3 — Identity reaches the client through the root loader

- **Decision**: `app/root.tsx` has a server `loader` returning `{ user }` from
  `context.get(stacksContext).identity()`. The default component renders `<SignIn />` when
  `user` is `null`, and `<Outlet />` otherwise. Child routes read the user with
  `useRouteLoaderData("root")`.
- **After a mutation**: sign-in and sign-out keep their `fetch` calls to `/auth/sign-in` and
  `/auth/sign-out`. On success they call `useRevalidator().revalidate()`, which re-runs the
  root loader with the new cookie. The session hook's `/auth/me` 401 path does the same.
- **Why**: it replaces TanStack Query's `identityKey` cache with the router's own data. The
  server stays the only source of identity truth (the `client-identity` wiki note's rule),
  and the `/auth/*` routes stay the documented agent path (constitution I).
- **Alternative rejected**: sign-in as a React Router `action`. It would need a sign-in
  method on the load context that sets a cookie, duplicating `/auth/sign-in`. Nothing in
  scope needs it.

## R4 — The play route: `clientLoader` + `HydrateFallback`

- **Decision**: `app/routes/play.tsx` exports `clientLoader({ params })` returning
  `{ sessionId: params.sessionId }`, a `HydrateFallback` rendering `Loading…`, and the view.
  It exports no server `loader`. `useSession` moves unchanged except its 401 branch
  (R3).
- **Why**: with a `clientLoader` and no `loader`, React Router renders the `HydrateFallback`
  during SSR and runs the route only in the browser. `WebSocket` and `window` are never
  touched on the server. This is doc-0003 ruling 1's pattern for every realtime and canvas
  route.

## R5 — Serving: assets first, then the handler, reserved paths never

- **Decision**: `apps/server/src/static.ts` keeps its reserved-path guard and its
  `serveStatic` dummy-`next` trick. It changes in three ways:
  1. `RESERVED_PREFIXES` gains `/library`: `["/health", "/api", "/auth", "/ws", "/library"]`.
  2. The static root becomes the web client build, `apps/web/build/client`, resolved
     module-relatively: `join(dirname(fileURLToPath(import.meta.url)), "../../web/build/client")`.
  3. The `index.html` fallback is replaced by `handler(c.req.raw, loadContext)`.
- The handler is loaded lazily on the first non-asset request by a dynamic `import()` of
  `apps/web/build/server/index.js`, resolved the same module-relative way. `createApp`
  accepts `web: { clientRoot?, handler? }` so tests inject both.
- **Why `/library` joins the list**: card AC #3 and the runbook name it as reserved; the
  code omits it. Today `/library/unknown` falls through to the SPA shell with a 200. Adding
  it aligns the code with the stated contract. See plan.md, operator checkpoint 2.
- **Why module-relative**: `apps/server/dist/static.js` and `apps/web/build/` sit in the
  same relative position in a worktree and in the image (`/app/apps/…`). The Dockerfile's
  `WORKDIR` does not matter, as today.
- **Why lazy**: the server test suite and a server-only build must boot without a web build.
- **Behaviour change**: an unknown non-reserved path now gets React Router's 404, not a 200
  shell.

## R6 — Build output and the container image

- **Decision**: `react-router build` writes `apps/web/build/client` (hashed assets) and
  `apps/web/build/server/index.js` (the SSR entry, input `server.ts` via Vite's
  `environments.ssr.build.rollupOptions.input`). The runtime stage:
  - installs production deps for both apps:
    `pnpm install --frozen-lockfile --prod --filter "@the-stacks/server..." --filter "@the-stacks/web..."`;
  - copies `apps/web/build` to `apps/web/build`;
  - drops the `apps/web/dist → apps/server/public` copy.
- **Why keep dependencies external**: the SSR bundle imports `react`, `react-dom`,
  `react-router`, and the shadcn runtime packages from `apps/web/node_modules`. This is the
  React Router default and the boring path. The runtime stage still gets no source, no
  devDependencies, and no build tooling (`tailwindcss`, `@react-router/dev`, and `vite` are
  devDependencies).
- **Alternative rejected**: `ssr.noExternal: true` to bundle every dependency into
  `index.js`. It avoids the second `--filter`, but React's CommonJS entry points are known to
  bundle poorly, and it diverges from every React Router template.
- **Turbo**: `turbo.json`'s `build.outputs` gains `build/**`, or a cached build restores no
  web output.

## R7 — TypeScript and typegen

- **Decision**: `apps/web/tsconfig.json` sets `noEmit: true` (precedent:
  `apps/server/test/tsconfig.json`), includes `app`, `server.ts`, the two config files, and
  `.react-router/types/**/*`, sets `rootDirs: [".", "./.react-router/types"]`, and maps
  `~/*` to `./app/*`. Vite resolves the alias through `resolve.tsconfigPaths: true`.
- `react-router typegen` must run before `tsc -b`. The web package gets
  `"typegen": "react-router typegen"`. Root `typecheck` becomes
  `pnpm --filter @the-stacks/web typegen && tsc -b`, because `ci:check` runs `typecheck`
  before `build`.
- `.react-router/` is added to `.gitignore`.
- **Why `noEmit`**: today `tsc -b` and `vite build` both write `apps/web/dist`. Nothing
  consumes web declarations, so emitting them is waste.

## R8 — Dev mode: no hot-reload server in this task

- **Decision**: add no `dev` script. The loop is `pnpm build`, then run the server, either
  on the per-worktree stack (`pnpm env:up`) or on the host against the stack's database
  (quickstart.md §2).
- **Why**: `apps/web` has no dev script today, so this is parity. A standalone
  `react-router dev` cannot serve loaders here: the load context comes from the Hono process,
  and ruling 5 forbids both importing `apps/server` and self-HTTP calls. Hot reload
  therefore means running Vite in middleware mode inside the Hono process: a dev-only
  dynamic `import("vite")`, a Node request bridge, and `ssrLoadModule` of the server build.
  That is roughly thirty lines with its own failure modes.
- **Seam left**: `createApp`'s `web.handler` option is exactly where a Vite-backed dev
  handler plugs in later.
- **Flag**: TASK-0028 is UI-heavy and may want hot reload. See plan.md, operator
  checkpoint 5.

## R9 — Tailwind v4 and shadcn/ui

- **Tailwind**: `@tailwindcss/vite` in `vite.config.ts` before `reactRouter()`.
  `app/app.css` starts with `@import "tailwindcss";`. Tailwind v4's default `--font-sans`
  is already a system stack (`ui-sans-serif, system-ui, sans-serif, …`). `app.css` pins it
  anyway with `--font-sans: system-ui, sans-serif;` inside `@theme`, so constitution IX
  stays visible in the source. No `@import url(...)` of any font.
- **shadcn**: hand-write `apps/web/components.json` (style `new-york`, `rsc: false`,
  `tsx: true`, `tailwind.css: "app/app.css"`, `tailwind.baseColor: "neutral"`,
  `cssVariables: true`, aliases `components: "~/components"`, `ui: "~/components/ui"`,
  `utils: "~/lib/utils"`, `lib: "~/lib"`, `hooks: "~/hooks"`). Hand-write `app/lib/utils.ts`
  (`cn()` from `clsx` + `tailwind-merge`) and the neutral light and dark CSS variables in
  `app.css`. Then run `pnpm dlx shadcn@4.21.0 add button input label card` from
  `apps/web`. The CLI is run with `dlx`; it is not a dependency.
- **Why hand-write instead of `shadcn init`**: `init` also installs an icon library and an
  animation CSS package that none of the four components uses. Each arrives with the first
  component that needs it (TASK-0028's `Sheet`).
- **Components now**: `Button`, `Input`, `Label`, `Card`, used by the sign-in form. No
  `Dialog` or `AlertDialog`, now or later (no-modals rule).
- **Dark mode**: shadcn's `.dark` class variables are written, with
  `@custom-variant dark (&:is(.dark *));`. Nothing toggles the class yet. TASK-0028 sets it
  from a cookie in the root loader.
- **Biome**: Biome's CSS parser rejects `@theme`, `@custom-variant`, and `@apply` unless
  `css.parser.tailwindDirectives` is `true`. `biome.json` gains that setting.

## R10 — TanStack

- **Decision**: remove both `@tanstack/react-router` and `@tanstack/react-query`.
- **Router**: replaced by React Router (ruling 6).
- **Query**: its only use is the identity cache (`useIdentity`, `useSignIn`, `useSignOut`,
  and `useSession`'s `setQueryData`). The root loader plus `revalidate()` replaces all of it
  (R3). No surface in scope needs a client cache. TASK-0028's conversation store is a
  layout-level decision for that task (its open question 3).
- `@vitejs/plugin-react` is also removed. `@react-router/dev`'s Vite plugin carries React
  Fast Refresh and JSX handling itself.

## R11 — Tests

- **Reserved paths** (`apps/server/test/static.test.ts`, rewritten): inject a fake handler
  that records calls, and a fixture client root with one hashed asset. Assert:
  - each of `/health`, `/api/x`, `/auth/x`, `/library/x`, `/ws` gives zero handler calls;
  - unknown sub-paths under `/api`, `/auth`, `/library` return the JSON 404;
  - the asset is served with zero handler calls;
  - `/play/abc` calls the handler once with a `Request` for that path;
  - with no cookie, that call's `context.identity()` resolves `null`, with no database.
- **SSR render** (`apps/web/test/ssr.test.mjs`, `node:test`, no new dependency): import the
  built `build/server/index.js` and call `handle` with a stub context. Assert:
  - `/` with `identity: async () => null` gives 200 HTML containing the sign-in form;
  - `/` with a stub user gives HTML containing the display name;
  - `/play/<uuid>` with a stub user gives HTML containing the fallback, and no event list.
- `apps/web`'s `test` script becomes `node --test test/`. `turbo.json` gains
  `"@the-stacks/web#test": { "dependsOn": ["build"], "cache": false }`, so the bundle exists.

## R12 — `check:host-scripts`

- **Decision**: no change. It imports `config.ts` and `db.ts` under strip-types for
  `scripts/migrate.ts`. This task touches neither file. Phase 5 re-runs it inside `ci:check`.

## R13 — Engines

- React Router 8.4.0 declares `node >=22.22.0`. The host runs 22.23.2. `.nvmrc` says `22`,
  and the image uses `node:22-alpine`, both floating to the latest 22.x. No change needed.
  The Phase 5 image run proves the image's Node version.

## New dependencies

All go into `apps/web/package.json`. `apps/server` and `packages/shared` gain none.

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

**Removed**: `@tanstack/react-router`, `@tanstack/react-query`, `@vitejs/plugin-react`.

**Not added now**: an icon library (`lucide-react`) and `tw-animate-css`. Each arrives with
the first component that needs it. `shadcn` runs through `pnpm dlx` and is never installed.
