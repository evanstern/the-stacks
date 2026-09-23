---

description: "Task list for 007-spa-shell-demo"
---

# Tasks: React SPA shell and the two-browser echo demo

**Input**: Design documents from `/specs/007-spa-shell-demo/`

**Prerequisites**: [spec.md](./spec.md), [plan.md](./plan.md). No `research.md`,
`data-model.md`, or `contracts/` — the plan explains why: this feature consumes frozen
contracts 005 and 006 and persists no new entity.

**Tests**: Server-side tests are included where they guard a contract this feature could
silently break (T008). No browser test runner is introduced — the card does not ask for one,
and the demo's verification is running it (SC-002).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US4 from spec.md
- File paths are exact.

## Path Conventions

Monorepo, per plan.md's Structure Decision: `apps/web/` (client), `apps/server/` (server),
repository-root `Dockerfile`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Turn the `apps/web` stub into a real Vite workspace.

- [ ] T001 Add client dependencies to `apps/web/package.json`: `react`, `react-dom` (19.x),
      `vite`, `@vitejs/plugin-react`, `@tanstack/react-router`, `@tanstack/react-query`, and
      the matching `@types/*`. Keep the existing `@the-stacks/shared` workspace dependency.
- [ ] T002 Replace `apps/web`'s scripts so `build` runs Vite and `typecheck` runs `tsc`.
      **Keep `build`, `typecheck`, and `test` all present** — Turborepo and the root
      `tsconfig.json` reference this workspace (plan D7). `test` may remain the existing
      no-op until a client test exists.
- [ ] T003 Add `apps/web/vite.config.ts` and `apps/web/index.html`.
- [ ] T004 Update `apps/web/tsconfig.json` for a DOM + JSX build, and make sure the repo-root
      `pnpm typecheck` still passes with `apps/web` in its references.

**Checkpoint**: `pnpm --filter @the-stacks/web build` produces static output; repo-wide
`pnpm typecheck` and `pnpm lint` still pass.

---

## Phase 2: User Story 1 — The SPA is served by the app container (Priority: P1)

**Goal**: `docker compose up` from a clean clone serves the built SPA, without shadowing any
existing route.

- [ ] T005 [US1] Add `apps/server/src/static.ts`: a middleware that serves the SPA's build
      output with `serveStatic` from `@hono/node-server/serve-static` (already a dependency —
      do not add one), and returns `index.html` for unmatched non-API paths.
- [ ] T006 [US1] Resolve the static root **against the container's actual cwd**. The
      Dockerfile sets `WORKDIR /app/apps/server` before `CMD`, and `serveStatic`'s `root` is
      relative to the process cwd (plan D1). Derive it from the module's own location rather
      than assuming the repo root.
- [ ] T007 [US1] Mount the middleware in `apps/server/src/app.ts` **last**, after `/health`,
      `/api/echo`, and `/auth` (plan D2). `/ws` is upgraded before Hono routing and is not at
      risk, but do not disturb `gateway.attach`.
- [ ] T008 [US1] Add a server test in `apps/server/test/` asserting that unknown paths under
      `/api/*` and `/auth/*` still return the **structured JSON 404** from
      `notFoundHandler` — not the SPA shell — and that an unknown non-API path returns the
      shell. **Prove this test fails** against a deliberately over-broad fallback before
      accepting it (the sweep's standing rule; if it passes against the broken version, say
      so — that is a finding).
- [ ] T009 [US1] Update the root `Dockerfile`: build the client in the build stage and copy
      its output into the runtime stage. Do **not** add client build tooling to the runtime
      image — the existing build/runtime split stands (FR-004).
- [ ] T010 [US1] Verify **in the running container**, not just on the host: `/` serves the
      shell, a hashed asset loads, a deep link serves the shell, and `/health` still returns
      its JSON.

**Checkpoint**: US1 acceptance scenarios 1–3 pass against `docker compose up`.

---

## Phase 3: User Story 2 — Sign in, and stay signed in across reload (Priority: P1)

**Goal**: A person signs in, sees their own display name, and survives a reload.

- [ ] T011 [US2] Wire `main.tsx`: mount React 19, the TanStack Router route tree, and a
      `QueryClientProvider`.
- [ ] T012 [US2] Add an identity query against `GET /auth/me` — `200` signed in, `401`
      signed out. This is the **only** source of identity truth (plan D3). Send credentials
      with the request; the cookie is `HttpOnly` and cannot be read or set by script.
- [ ] T013 [US2] Add the sign-in route and form calling `POST /auth/sign-in`, then
      invalidating the identity query so the signed-in view follows.
- [ ] T014 [US2] Render a failed sign-in as **one** message that does not disclose whether
      the username exists (FR-009).
- [ ] T015 [US2] Add sign-out calling `POST /auth/sign-out` and returning to the signed-out
      view.
- [ ] T016 [US2] Verify by running: sign in, reload (still signed in), sign out, reload
      (still signed out).

**Checkpoint**: US2 acceptance scenarios 1–5 pass in a real browser.

---

## Phase 4: User Story 3 — Live and replayed events in one view (Priority: P1)

**Goal**: The play view renders the session's history and new events as they arrive.

- [ ] T017 [US3] Add the play route carrying the session id as a route parameter (plan D6),
      so both browsers reach one session by URL and a reload keeps it.
- [ ] T018 [US3] Connect to `/ws` and send `subscribe` with `afterSeq`. The cookie rides the
      upgrade automatically — do not attempt to attach a token.
- [ ] T019 [US3] Handle `event` frames through **one** path for replayed and live events —
      the protocol gives both the same shape deliberately (FR-010).
- [ ] T020 [US3] Track the **highest delivered `seq`** and use it as `afterSeq` on reconnect.
      Never increment to a "next expected" value; `seq` gaps are correct (plan D4, FR-011).
- [ ] T021 [US3] Handle `replay-complete` to distinguish "caught up" from "quiet session",
      and `error` frames **without** tearing down the connection (FR-015).
- [ ] T022 [US3] Distinguish a `401` upgrade refusal (return to sign-in) from `503` (retry).
      Treating a datastore blip as "signed out" logs people out spuriously (FR-014).
- [ ] T023 [US3] Add the message composer sending a `send` frame carrying only permitted
      fields — **never** `actor`, `seq`, or `ts` (FR-012).
- [ ] T024 [US3] Render the sender's own message **only** when its `event` frame arrives. No
      optimistic render (plan D5, FR-013) — an optimistic render plus the real event is a
      visible duplicate.

**Checkpoint**: US3 acceptance scenarios 1–5 pass; a sent message appears exactly once in the
sender's own view.

---

## Phase 5: User Story 4 — The two-browser demo (Priority: P1)

**Goal**: Two people, two browsers, one message crossing between them. **This is M0.**

- [ ] T025 [US4] Write `specs/007-spa-shell-demo/quickstart.md` (FR-017): how to start the
      stack, create the operator account, invite and redeem the second account, and how both
      browsers reach the same session id.
- [ ] T026 [US4] Run the demo for real from `docker compose up`: two browser contexts with
      **separate cookie jars**, signed in as two different accounts. Two tabs in one profile
      share one identity and prove nothing (spec Edge Cases).
- [ ] T027 [US4] Verify a message sent in one browser appears in the other, and in the
      sender's own view exactly once.
- [ ] T028 [US4] Verify reloading either browser replays the prior messages rather than
      showing an empty view.
- [ ] T029 [US4] Record the evidence — what was run, what was observed, in which two
      contexts. Passing tests are **not** evidence for this story.

**Checkpoint**: SC-001 through SC-005 satisfied, by observation.

---

## Phase 6: Gates

- [ ] T030 Run in the worktree, in order: `pnpm install && pnpm typecheck && pnpm lint &&
      pnpm test && pnpm build`. Capture literal output for the PR body — this sweep has no
      CI (TASK-0017), so that output is the standing evidence.

---

## Dependencies

- **Phase 1 blocks everything** — there is no client until the workspace is real.
- **US1 blocks US2–US4**: nothing can be demonstrated in a browser until the container serves
  a page.
- **US2 blocks US3**: the WebSocket upgrade is refused without a session.
- **US3 blocks US4**: the demo is two instances of the US3 view.
- T008 depends on T005–T007; T010 depends on T009.

## Parallel opportunities

Little within this feature — the stories form a chain by construction. T001–T004 are one
setup unit. Within US3, T017–T022 (receive path) and T023–T024 (send path) can be developed
in parallel once T018 lands.

## Out of scope

CI (TASK-0017), a session registry, presence/typing, any change to the frame shapes or auth
contracts, and PixiJS or any M1+ surface.
