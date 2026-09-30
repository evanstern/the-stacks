# Tasks: Frontend stack migration (React Router 8 SSR, Tailwind v4, shadcn/ui)

**Input**: Design documents from `/specs/025-frontend-stack/`

**Prerequisites**: plan.md, spec.md, research.md, quickstart.md. The operator has cleared
plan.md's New dependencies table.

**Tests**: `apps/server/test/static.test.ts` is rewritten for the reserved-path invariant.
`apps/web/test/ssr.test.mjs` renders three routes from the built bundle. The M0 demo runs
twice, by hand.

**Standing rules for every phase**:
- Run `cd /Users/evanstern/projects/the-stacks/.worktrees/task-0040 && pwd && git branch --show-current` first. Expect `task-0040-frontend-stack`. On any other branch, STOP.
- Add only the packages in plan.md's New dependencies table, at those versions. Any other package needs the operator. STOP and report.
- Never add a shadcn `Dialog` or `AlertDialog`. Never reference a CDN or a webfont.
- Never import `apps/server` from `apps/web`. Never call the app's own HTTP API from a loader.
- Do not change the reserved set beyond adding `/library`. Any other change needs the operator.
- Never print `.env`. Never put a real password in a file or a commit.
- Never use the backlog MCP tools. Use the `backlog` CLI inside the worktree for any card change.
- Commit per phase with a `TASK-0040:` subject and the Co-Authored-By trailer. Run `git pull --no-rebase`, then push. Never rebase, amend, or force-push.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: user story from spec.md (US1–US6)

## Phase 1: Setup and dependencies

- [ ] T001 In `apps/web/package.json`, remove `@tanstack/react-router`, `@tanstack/react-query`, and `@vitejs/plugin-react`. Add the runtime and dev packages from plan.md's New dependencies table with `pnpm --filter @the-stacks/web add` and `add -D`, pinned with `^` to the listed versions.
- [ ] T002 In `apps/web/package.json`, set scripts: `build` = `react-router build`, `typegen` = `react-router typegen`, `typecheck` = `react-router typegen && tsc -b`, `test` = `node --test test/`.
- [ ] T003 [P] In root `package.json`, set `typecheck` to `pnpm --filter @the-stacks/web typegen && tsc -b` (research R7).
- [ ] T004 [P] In `turbo.json`, add `"build/**"` to `build.outputs`. Add `"@the-stacks/web#test": { "dependsOn": ["build"], "cache": false }` (research R6, R11).
- [ ] T005 [P] In `.gitignore`, add `.react-router/`.
- [ ] T006 [P] In `biome.json`, add `"css": { "parser": { "tailwindDirectives": true } }`. Leave every `overrides` entry unchanged (plan D12).
- [ ] T007 Rewrite `apps/web/tsconfig.json`: `noEmit: true`; `include` of `app`, `server.ts`, `vite.config.ts`, `react-router.config.ts`, `.react-router/types/**/*`; `rootDirs: [".", "./.react-router/types"]`; `paths: { "~/*": ["./app/*"] }`; `types: ["vite/client"]`; keep `lib` with DOM, `jsx: "react-jsx"`, and the `packages/shared` reference. Remove `outDir` and `rootDir`.
- [ ] T008 Run `pnpm install`. Confirm `pnpm-lock.yaml` has no `@tanstack/` entry.

## Phase 2: Server mount and load context (US3, US4)

- [ ] T009 [US4] Create `packages/shared/src/web.ts` with `Role`, `PublicUser`, `StacksLoadContext`, and `WebRequestHandler`, as types only (plan D3). Re-export it from `packages/shared/src/index.ts`. Set `"lib": ["ES2022", "DOM"]` in `packages/shared/tsconfig.json`.
- [ ] T010 [US4] Create `apps/server/src/auth/identity.ts`: `createIdentityLookup({ db, validateSession })` returns `(token: string | undefined) => Promise<PublicUser | null>`. Return `null` for no token, no session, or no user row. Do not catch datastore errors (plan D2).
- [ ] T011 [US4] In `apps/server/src/routes/auth.ts`, make `GET /auth/me` use the lookup from T010. Keep the 401 for `null` and the response shape `{ user }`.
- [ ] T012 [US4] Create `apps/server/src/web.ts`: `createWebLoadContext(c, lookup): StacksLoadContext`. `identity()` reads the `session` cookie with `getCookie` and memoizes its result per request.
- [ ] T013 [US3] Rewrite `apps/server/src/static.ts` as `createWebMiddleware({ clientRoot, handler, lookup })` (plan D4). Add `/library` to `RESERVED_PREFIXES`. Keep the dummy-`next` asset lookup and its comment. Replace the `index.html` fallback with the handler call. Default `clientRoot` to `../../web/build/client` and the handler to a cached dynamic `import()` of `../../web/build/server/index.js`, both from `import.meta.url`. Rewrite the header comments for the new behaviour.
- [ ] T014 [US3] In `apps/server/src/app.ts`, replace `staticRoot?` with `web?: { clientRoot?: string; handler?: () => Promise<WebRequestHandler> }`. Build the lookup once from the existing `validateSession`. Mount the web middleware last. Update the mount-order comment.
- [ ] T015 [US3] Rewrite `apps/server/test/static.test.ts` (plan D13): fake handler recording calls; zero calls for `/health`, `/api/x`, `/auth/x`, `/library/x`, `/ws`; JSON 404 for unknown sub-paths under `/api`, `/auth`, `/library`; a fixture asset served with zero calls; `/play/abc` gives one call whose `Request` URL path is `/play/abc`; `identity()` resolves `null` with no cookie.
- [ ] T016 [P] [US4] In `apps/server/test/auth.integration.test.ts`, add one case: the lookup returns the user for a live token and `null` after sign-out. Keep the file's skip shape.
- [ ] T017 Run `pnpm --filter @the-stacks/server build` and `pnpm --filter @the-stacks/server test`. Expect exit 0.

## Phase 3: Route port (US1, US2)

- [ ] T018 [US1] Create `apps/web/react-router.config.ts` with `ssr: true` and `appDirectory: "app"`.
- [ ] T019 [US1] Create `apps/web/vite.config.ts` (replace the old one): `plugins: [tailwindcss(), reactRouter()]`, `resolve.tsconfigPaths: true`, `environments.ssr.build.rollupOptions.input: "./server.ts"`.
- [ ] T020 [US4] Create `apps/web/app/context.ts`: `export const stacksContext = createContext<StacksLoadContext>()`.
- [ ] T021 [US4] Create `apps/web/server.ts` exactly as plan D5.
- [ ] T022 [US1] Create `apps/web/app/routes.ts`: `index("routes/home.tsx")` and `route("play/:sessionId", "routes/play.tsx")`.
- [ ] T023 [US1] Create `apps/web/app/root.tsx`: `Layout` (html, head with `Meta` and `Links`, body with `Scripts` and `ScrollRestoration`); `links()` for `app.css?url`; a `loader` returning `{ user }` from `context.get(stacksContext).identity()`; a default component rendering `<SignIn />` for `null` and `<Outlet />` otherwise; an `ErrorBoundary`.
- [ ] T024 [US1] Create `apps/web/app/auth.ts` from `src/auth/api.ts`: keep `signIn` and `signOut`, and their comments. Delete `fetchMe` and the local `User` type. Import `PublicUser` from `@the-stacks/shared`.
- [ ] T025 [US1] Create `apps/web/app/sign-in.tsx` from `src/routes/sign-in.tsx`: `method="post"`; `preventDefault` in `onSubmit`; call `signIn`, then `revalidate()`; show the one failure message; disable submit until mounted (plan D10).
- [ ] T026 [US1] Create `apps/web/app/routes/home.tsx` from `src/routes/home.tsx`: read the user with `useRouteLoaderData("root")`; sign-out calls `signOut`, then `revalidate()`.
- [ ] T027 [US2] Move `apps/web/src/ws/types.ts` to `apps/web/app/ws/types.ts` unchanged. Move `apps/web/src/ws/useSession.ts` to `apps/web/app/ws/useSession.ts`. Replace `useQueryClient` and `setQueryData(identityKey, null)` with an `onSignedOut` callback argument. Change nothing else, and keep every comment.
- [ ] T028 [US2] Create `apps/web/app/routes/play.tsx` from `src/routes/play.tsx`: `clientLoader({ params })` returns `{ sessionId }`; `HydrateFallback` renders `Loading…`; no server `loader`. Pass `revalidate` as `onSignedOut`. Keep the no-optimistic-append comment.
- [ ] T029 [US1] Delete `apps/web/index.html` and the whole `apps/web/src/` tree.
- [ ] T030 [US1] Run `pnpm --filter @the-stacks/web typecheck` and `pnpm --filter @the-stacks/web build`. Expect `apps/web/build/client/` and `apps/web/build/server/index.js`.
- [ ] T031 [US1] [US2] Create `apps/web/test/ssr.test.mjs` with `node:test` (plan D13): `/` signed out contains the form; `/` signed in contains the display name; `/play/<uuid>` contains `Loading…` and no `<ul>`. Run `pnpm --filter @the-stacks/web test`. Expect exit 0.
- [ ] T032 [US1] [US2] In `Dockerfile`'s runtime stage, install with `--filter "@the-stacks/server..." --filter "@the-stacks/web..."`, copy `/app/apps/web/build` to `apps/web/build`, and drop the `apps/server/public` copy (plan D6). Rewrite the stale comments.

## Phase 4: Styling foundation (US5)

- [ ] T033 [US5] Create `apps/web/app/app.css`: `@import "tailwindcss";`, `@custom-variant dark (&:is(.dark *));`, shadcn's neutral `:root` and `.dark` variables, their `@theme inline` mapping, and `--font-sans: system-ui, sans-serif;` in `@theme`. Import no font.
- [ ] T034 [P] [US5] Create `apps/web/components.json` as plan D9. Create `apps/web/app/lib/utils.ts` with `cn()`.
- [ ] T035 [US5] From `apps/web`, run `pnpm dlx shadcn@4.21.0 add button input label card`. Decline any extra package. Confirm the files land in `apps/web/app/components/ui/`.
- [ ] T036 [US5] Use `Card`, `Label`, `Input`, and `Button` in `app/sign-in.tsx`. Use `Button` for sign-out in `home.tsx` and `play.tsx`, and for send in `play.tsx`. Keep every label, text, and `autoComplete` value.
- [ ] T037 [US5] Run `pnpm lint` and `pnpm --filter @the-stacks/web build`. Expect exit 0.

## Phase 5: Verification, evidence, re-grounding

- [ ] T038 Run `pnpm env:up`. Then export `TEST_DATABASE_URL` from `.env` without printing it, and run `REQUIRE_DATABASE=1 pnpm ci:check`. Expect exit 0 and zero skipped database suites. Record the tail in `specs/025-frontend-stack/ci-evidence.txt`.
- [ ] T039 [US5] Run `grep -rnE 'fonts\.googleapis|fonts\.gstatic|cdn\.|unpkg|jsdelivr' apps/web --exclude-dir=node_modules`. Expect zero hits. Record it in `ci-evidence.txt`.
- [ ] T040 [US5] Run `grep -rniE 'dialog' apps/web/app apps/web/components.json`, then `ls apps/web/app/components/ui`. Expect zero dialog hits and exactly `button.tsx card.tsx input.tsx label.tsx`. Record both in `ci-evidence.txt`.
- [ ] T041 [US1] [US3] Run quickstart.md §3. Record the SSR `curl` and the `/library/nope` result in `ci-evidence.txt`.
- [ ] T042 [US2] Run the M0 demo on the per-worktree stack (quickstart.md §4) in Brave. Record each step's result for the PR body.
- [ ] T043 [US2] Run the M0 demo against the standalone image (quickstart.md §5). Record the image id, the commit, the tooling check, and each step's result for the PR body.
- [ ] T044 [P] [US6] In `docs/design/architecture.md` A1's table, set the Client row to `React 19, React Router 8 framework mode (SSR by default; realtime and canvas routes client-only), Tailwind v4, shadcn/ui` with the note `Supersedes "SPA, not SSR": doc-0003 / decision-0008 (2026-09-29)`. Change nothing else in A1 unless plan.md checkpoint 6 says so.
- [ ] T045 [US6] Re-pin the wiki with `/grounding-wiki:wiki-update`. Re-ground `static-serving`, `spa-shell` (retire or rename it through the loop; it becomes the React Router app note), `container-image`, and `server-entrypoint-and-app`. Review `client-identity`, `client-session-hook`, `m0-demo`, `monorepo-and-toolchain`, `session-auth`, `ci-pipeline`, `test-suite`, and `overview`. Re-pin whatever else the freshness gate flags. Regenerate `docs/wiki/CAPSULES.md` if any `description:` changed.
- [ ] T046 Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.65.3/gates/cli.mjs freshness . docs/wiki`. Expect `OK`.
- [ ] T047 Run `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.65.3/gates/cli.mjs check .`. Expect exit 0.
- [ ] T048 Run quickstart.md §7: `pnpm env:down`, then `pnpm env:prune --check`. Expect exit 0 from both.

## Dependencies

- Phase 1 blocks every other phase.
- Phase 2 and Phase 3 share only T009's types. T009 blocks T012, T013, T020, and T021.
- T013 and T014 block T015. T030 blocks T031 and Phase 4.
- Phase 4 blocks Phase 5. T038–T043 block T045. T045 blocks T046.
