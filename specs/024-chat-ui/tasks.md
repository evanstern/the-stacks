# Tasks: Chat UI — streaming answers and clickable citations

**Input**: Design documents from `/specs/024-chat-ui/`

**Prerequisites**: plan.md, spec.md, research.md, quickstart.md. plan.md's "Operator
checkpoints" MUST be resolved before T001.

**Tests**: pure-module suites under `apps/web/test/` (`node --test`, `.ts` imported directly),
the extended SSR suite, `contrast.test.mjs`, `no-dialog.test.mjs`, two server test additions,
the piloted run, and the Brave recording.

**Standing rules for every phase**:
- Run `cd /Users/evanstern/projects/the-stacks/.worktrees/task-0028 && pwd && git branch --show-current` first. Expect `task-0028-chat-ui`. On any other branch, STOP.
- Add no package. plan.md's New dependencies table is empty. Any package needs the operator. STOP and report.
- Never add a shadcn `Dialog` or `AlertDialog`. Never use `<dialog>` or `showModal`. Never reference a CDN or a webfont.
- Never import `apps/server` from `apps/web`. Never call the app's own HTTP API from a loader.
- Never change `ask-sse.md`, `http-ingest.md`, or the reserved path set. Add no HTTP route.
- Never write book text or UI state to `localStorage`, `sessionStorage`, or IndexedDB.
- Pure modules under `app/ask/`, `app/library/books.ts`, `app/ui-prefs.ts`, and `app/library/upload.ts` use `import type` only and erasable TypeScript only.
- Never print `.env`. Never put a real password in a file or a commit.
- Never use the backlog MCP tools. Use the `backlog` CLI inside the worktree for any card change.
- Commit per phase with a `TASK-0028:` subject and the Co-Authored-By trailer. Run `git pull --no-rebase`, then push. Never rebase, amend, or force-push.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[Story]**: user story from spec.md (US1–US4)

## Phase 1: Foundation — theme, cookies, load context, store, panel, shell

- [x] T001 [P] Rewrite the token blocks in `apps/web/app/app.css` per plan D6: Daylight hex values in `:root`, the `prefers-color-scheme: dark` block guarded by `:root:not([data-theme="light"])`, and `:root[data-theme="dark"]`. Add `--input`, `--mark`, `--mark-foreground`, `--destructive-surface`, `--ok`, `--ok-surface`, `--proc`, `--proc-surface`, `--queued-surface`. Map every token in `@theme inline`. Set `--font-sans` and `--font-mono`.
  - Deviation: dropped the unused `--chart-1..5` tokens (no Daylight design values exist for them and nothing renders a chart).
- [x] T002 In `apps/web/app/app.css`, replace the `dark` custom variant with plan D6's block variant. Add the `narrow` variant, `color-scheme` rules, the global `:focus-visible` outline, and the four panel keyframes with a `prefers-reduced-motion` override.
  - Deviation: the keyframes are wired to `[data-slot="sheet-content"][data-state]` directly in `app.css` rather than via Tailwind utility classes in the component, so T011/T012 need no animation classNames at all.
- [x] T003 [P] Create `apps/web/test/contrast.test.mjs` per plan D15 and research R12. Run `pnpm --filter @the-stacks/web test`. Expect it green.
- [x] T004 [P] Create `apps/web/app/ui-prefs.ts` (`readUiPrefs`, `uiCookie`) per plan D5. Create `apps/web/test/ui-prefs.test.mjs`.
- [x] T005 In `apps/web/app/root.tsx`, return `{ user, ui }` from the loader. In `Layout`, set `data-theme` on `<html>` from `useRouteLoaderData("root")` for `light` and `dark` only.
- [x] T006 [P] In `packages/shared/src/web.ts`, add `LibraryJob`, `LibraryJobResult`, and `StacksLoadContext.jobs()` per plan D2, citing `http-ingest.md`.
- [x] T007 In `apps/server/src/web.ts`, `static.ts`, and `app.ts`, implement `jobs()` per plan D2: pass `listJobs` into `createWebMiddleware`, return `null` without a query for no user or a non-operator, and `listJobs(100)` for an operator.
- [x] T008 [P] In `apps/server/test/static.test.ts`, assert the handler's context `jobs()` resolves `null` with no cookie and never calls the injected `listJobs`.
- [x] T009 [P] In `apps/server/test/library/jobs.integration.test.ts`, add one case: a load context for an operator token returns an inserted job; for a player token it returns `null`. Keep the file's skip shape.
- [x] T010 [P] Create `apps/web/app/components/icons.tsx` per plan D9, with paths from `docs/design/chat-ui/round-2/a2-daylight.html` lines 185–197.
- [x] T011 From `apps/web`, run `pnpm dlx shadcn@4.21.0 add sheet`. Replace the `lucide-react` `XIcon` import with `CloseIcon`. Replace `tw-animate-css` classes with the T002 keyframes. Revert any `package.json` change the CLI made. Confirm `git diff apps/web/package.json pnpm-lock.yaml` is empty.
  - Deviation: the CLI also added an unrelated `cn` package to `package.json`/`pnpm-lock.yaml` (not `lucide-react`/`tw-animate-css`, which were already left out of `sheet.tsx`'s own deps); reverted both files and re-ran `pnpm install` so the lockfile matches. `git diff` for both is empty.
- [x] T012 Create `apps/web/app/components/panel.tsx` per plan D7: controlled `open`/`onOpenChange`, `title`, optional `description` and `id`; right edge on desktop, bottom sheet under `narrow:`; close control labelled "Close"; dim overlay.
- [x] T013 [P] Create `apps/web/test/no-dialog.test.mjs` per plan D7: no `dialog.tsx` or `alert-dialog.tsx` in `components/ui`; zero `<dialog`, `showModal`, or `AlertDialog` in `apps/web/app`; the word `Dialog` only in `components/ui/sheet.tsx`.
- [x] T014 Create `apps/web/app/store/app-store.ts` and `store/provider.tsx` per plan D8, with state, `subscribe`, `dispose`, and `onUnauthorized`. Leave the ask, upload, and jobs actions as stubs for Phases 2–4.
  - Deviation: added `useAppStoreHandle()` alongside `useAppStore(selector)` — a stable accessor to the store instance itself, needed for Phase 2+ components to call its actions (not itself reactive).
- [x] T015 Create `apps/web/app/shell/shell.tsx` per plan D13: role-aware links, collapse toggle writing `stacks-sidebar`, `data-sidebar` from root data, bottom tab bar under `narrow:`, user name, role, and Sign out.
- [x] T016 Create `apps/web/app/shell/operator-only.tsx`, taking the message as a prop.
- [x] T017 In `apps/web/app/root.tsx`, render `<AppStoreProvider key={user.id}><Shell><Outlet/></Shell></AppStoreProvider>` for a signed-in user. Keep `<SignIn />` for `null`.
- [x] T018 In `apps/web/app/routes.ts`, declare `index`, `ask`, `books`, `play`, `play/:sessionId`, and `settings` per plan D4. Rewrite `routes/home.tsx` as a loader-only redirect: operator → `/ask`, player → `/play`.
  - Deviation: `routes.ts` naming `routes/ask.tsx`, `routes/books.tsx`, and `routes/table.tsx` (for `/play`) needs those files to exist to build; added minimal placeholder components (no loader) for each, clearly commented as placeholders for Phases 2/3/5's own "Create" tasks, which replace them fully.
  - Deviation: `routes/home.tsx`'s default export can't be omitted — React Router treats a route module with no component as a resource route and serves the loader's raw JSON instead of the document, which broke the signed-out "/" case. Added a trivial `() => null` default export, documented as unreachable (root renders `<SignIn/>` for nobody; the loader always redirects a signed-in person).
- [x] T019 [P] Create `apps/web/app/routes/settings.tsx`: a System / Light / Dark radio group writing `stacks-theme`, setting `data-theme` at once, then revalidating (plan D5, D14).
- [x] T020 In `apps/web/test/ssr.test.mjs`, give the stub context `jobs()` with a call counter. Move the display-name case to `/ask`. Add the `/` redirect cases and the three cookie cases from plan D15.
- [x] T021 Run `pnpm --filter @the-stacks/web build && pnpm --filter @the-stacks/web test` and `pnpm --filter @the-stacks/server test`. Expect exit 0. Both exit 0 (web: 23/23 tests; server: 413 passed, 5 skipped against a migrated `TEST_DATABASE_URL`).

**Checkpoint**: signed-in pages render inside the shell in Daylight, with the theme and sidebar from cookies and no flash.

## Phase 2: US1 — Upload a book and watch it ingest (P1)

- [x] T022 [P] [US1] Create `apps/web/app/library/books.ts` (`bookKey`, `deriveBooks`, `pill`, `stageIndex`, `hasActive`) per plan D12. Create `apps/web/test/books.test.mjs`.
  - Deviation: also exports `STAGES` (the stepper's 4-stage tuple) and `jobDetail(job)` (the one-line detail string), reused by `routes/books.tsx`'s per-job rows so the pill/stepper/detail logic has one source, not two.
- [x] T023 [P] [US1] Create `apps/web/app/library/upload.ts` (`sendUpload`, `classifyUploadResponse`) per plan D12. Create `apps/web/test/upload.test.mjs` for the classifier.
- [x] T024 [US1] In the store, implement `seedJobs`, `refreshJobs`, and the chained 1500 ms poll per plan D12 and research R11. Handle `401` with `onUnauthorized` and `403` with `forbidden`.
- [x] T025 [US1] In the store, implement `upload` and `cancelUpload`: one at a time, progress into state, refresh jobs on `202` and after a cancel, messages from `classifyUploadResponse`.
- [x] T026 [US1] Create `apps/web/app/routes/books.tsx`: loader returns `{ forbidden: true }` for a player without calling `jobs()`, else `{ jobs }`. Render the title, subtitle, dropzone (label-wrapped file input), Book title field with the file-name default, upload card with Cancel, Recent imports with pill and stepper, and FR-015's empty text. Seed the store from loader data.
  - Deviation: the component reads `store.jobs ?? loaderData.jobs ?? []` rather than the store alone — `useSyncExternalStore`'s server snapshot must equal the pre-hydration client snapshot (`jobs: null`, per store/provider.tsx), so the initial SSR/first-paint list has to come from loader data directly; the store take over once `seedJobs` runs in an effect. Same pattern will apply to `routes/ask.tsx` in Phase 3.
- [x] T027 [US1] Create `apps/web/app/components/sources.tsx`: the Sources button (icon, "Sources · n", rotating chevron, border, hover and pressed states, `aria-expanded`, `aria-controls="sources-panel"`) and the panel body (upload card on top, derived books with pills and "Open in Library", inline Add a book dropzone). Use `Panel` from T012.
  - Deviation: built as a self-contained component (owns its own `open` state via `useState`) since mounting it in the Ask header is T034's job (Phase 3); it is not imported anywhere yet, so it isn't exercised by a build/test until then.
- [x] T028 [US1] In `apps/web/test/ssr.test.mjs`, add: `/books` as operator with one embedded job shows "Ready" and the book; with no jobs shows FR-015's text.
- [x] T029 [US1] On the stack, run quickstart §4. Expect the pill to reach Ready or Search-only without a reload.
  - Deviation (operational, not code): rebuilding the app container (`docker compose up -d --build --wait`) recreated the db container with an unmigrated volume. `db:migrate` / `auth:create-operator` prefer `TEST_DATABASE_URL` (from `.env`) over `DATABASE_URL` when run on the host, so a bare invocation silently targeted the long-lived TEST stack's database instead of this worktree's APP database. Ran both with `TEST_DATABASE_URL=""` and an explicit host-reachable `DATABASE_URL` (`localhost:$DB_PORT`) to target the right one. Recorded in `ci-evidence.txt`.

**Checkpoint**: AC #1 holds on the stack.

## Phase 3: US2 — Ask a question and watch the answer stream (P1)

- [x] T030 [P] [US2] Create `apps/web/app/ask/types.ts`, restating `ask-sse.md`'s events and citing it.
- [x] T031 [P] [US2] Create `apps/web/app/ask/sse.ts` per plan D10 and research R9. Create `apps/web/test/sse.test.mjs`.
- [x] T032 [P] [US2] Create `apps/web/app/ask/turns.ts` per plan D10. Create `apps/web/test/turns.test.mjs`, including SC-004 (a refusal leaves zero streamed words).
- [x] T033 [US2] In the store, implement `ask`, `stop`, and `retry` per plan D10: the fetch, the reader loop, the `400`/`401`/`403` branches, the end-without-terminal case, and one stream at a time.
- [x] T034 [US2] Create `apps/web/app/routes/ask.tsx`: loader as in T026. Render the conversation, the prompt bar with its disclaimer, "Enter a question.", the Stop pill, Stopped/Interrupted/Refused states with Retry, the dropped notice, and FR-031's empty state. Mount the Sources button and panel from T027 in the header.
- [x] T035 [US2] On the stack, ask `How does grappling work?`. Move to Library mid-stream and back. Expect the stream to continue (FR-028).

**Checkpoint**: AC #2 holds on the stack.

## Phase 4: US3 — Open a citation's source passage (P1)

- [x] T036 [P] [US3] Create `apps/web/app/ask/highlight.ts` (`splitPassage`). Create `apps/web/test/highlight.test.mjs` asserting `marked === quote` for the contract example and one citation per `passage.kind` (SC-003).
- [x] T037 [US3] In `routes/ask.tsx`, render citation markers as buttons with FR-032's accessible name, and the source pane per plan D11: book, section path joined by " › ", kind label, `whitespace-pre-wrap`, monospace for tables, `<mark>` for the quote, "No citation selected.", collapse with `aria-expanded`.
- [x] T038 [US3] In `routes/ask.tsx`, add the `narrow:` Chat | Source control: a citation opens Source; "Back to answer" returns to Chat.
- [x] T039 [US3] On the stack, run quickstart §5 steps 4–6. Expect the highlight to equal the quote and the panel to return focus to the Sources button on Escape.
  - Deviation: "the panel to return focus to the Sources button on Escape" describes the
    Sources slide-out panel (Sheet, Phase 2/3), not this phase's citation source pane, which
    is a persistent `<aside>` (plan D11) with no Escape/focus-trap of its own. That prior
    behavior was verified in Phase 3 (T035) and is unchanged; this run verified the source
    pane's own scope instead: click-through, the exact-quote `<mark>` scrolled into view,
    keyboard (Tab + Enter) activation, and the 390px Chat | Source switch. See ci-evidence.txt.

**Checkpoint**: AC #3 holds on the stack.

## Phase 5: US4 — Player views, the Table landing, and the two-browser run (P2)

- [x] T040 [US4] In `routes/ask.tsx` and `routes/books.tsx`, render `OperatorOnly` with FR-037's two messages when the loader says `forbidden` or the store's `forbidden` is set (FR-038).
  - Deviation: already implemented in Phases 2/3 (T026/T034), each needing the loader's
    `forbidden` branch to support the "no `jobs()` call for a player" SSR assertions those
    phases added. Verified this phase (no code change): `ask.tsx` and `books.tsx` both return
    `<OperatorOnly message="…" />` for `loaderData.forbidden || storeForbidden`, with FR-037's
    exact two strings.
- [x] T041 [US4] Create `apps/web/app/routes/table.tsx` per plan D14: Start a new table (disabled until hydrated) and Join by link or id with "Enter a table link or id.".
- [x] T042 [US4] In `apps/web/app/routes/play.tsx`, remove the page's own sign-out button. Change nothing else.
- [x] T043 [US4] In `apps/web/test/ssr.test.mjs`, add: `/ask` and `/books` as player show the operator-only text, contain no `href="/ask"` or `href="/books"`, and the `jobs` stub count is 0; `/ask` as operator links to `/ask`, `/books`, `/play`, and `/settings`.
- [x] T044 [US4] Run the piloted run in quickstart §6 by hand. Record each step's result in the PR body.

**Checkpoint**: AC #4 holds by eye.

## Phase 6: Verification, evidence, and re-grounding

- [x] T045 Run `REQUIRE_DATABASE=1 pnpm ci:check` with `TEST_DATABASE_URL` exported from `.env`. Expect exit 0. Save the tail to `specs/024-chat-ui/ci-evidence.txt`.
- [x] T046 [P] Run `grep -rnE 'fonts\.googleapis|fonts\.gstatic|cdn\.|unpkg|jsdelivr' apps/web --exclude-dir=node_modules`. Run the same on `apps/web/build`. Expect zero hits. Record both in `ci-evidence.txt`.
- [x] T047 [P] Run the three dialog checks from plan D7: `ls apps/web/app/components/ui`; `grep -rnE '<dialog|showModal|AlertDialog' apps/web/app`; `grep -rlwE 'Dialog' apps/web/app`. Expect no `dialog.tsx` or `alert-dialog.tsx`, zero hits, and exactly `apps/web/app/components/ui/sheet.tsx`. Record them in `ci-evidence.txt`.
- [x] T048 [P] Run `node --test apps/web/test/contrast.test.mjs apps/web/test/no-dialog.test.mjs`. Expect exit 0. Record it in `ci-evidence.txt`.
- [x] T049 [P] Run `git diff origin/main -- apps/web/package.json apps/server/package.json packages/shared/package.json package.json`. Expect no dependency change.
- [x] T050 Create `specs/024-chat-ui/evidence/record-ac4.mjs` per plan D16 and research R13.
- [x] T051 Run the recording per quickstart §6. Expect `ac4-operator.webm` and `ac4-player.webm`, each under 8 MB, and `ac4-player-requests.txt` reporting 0 `/library` requests (SC-008). Commit all four files.
  - Deviation: joinTable initially navigated to `/table`; routes.ts mounts the Table landing
    (`routes/table.tsx`) at path `/play` (`/play/:sessionId` is the live session,
    `routes/play.tsx`). Fixed before the committed run — a script bug caught by a timeout,
    not a product bug.
- [x] T052 Run `/grounding-wiki:wiki-update`. Review `react-router-app`, `client-identity`, `static-serving`, `test-suite`, `m0-demo`, and `overview`. Add a `chat-ui` note (store, SSE parser, turn reducer, panel, theme tokens, UI cookies). Regenerate `CAPSULES.md` if any `description:` changes.
  - Deviation: the plan gate also flagged `client-session-hook` and `ingestion` (not in the
    dispatch's named list) as NEEDS-REVIEW — reviewed and re-pinned too, since the gate is
    authoritative over the source list, not the dispatch prompt's illustrative names.
    `overview`'s sources were untouched by this task (gate found it already fresh); read it,
    made no change. `test-suite`'s verified test counts (46/44/90 → 47/44/91) were re-measured
    by running the note's own 12-file command with and without the DB, not guessed from the diff.
- [x] T053 Run `node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.65.3/gates/cli.mjs freshness . docs/wiki`. Expect `OK`.
- [x] T054 Run `node ~/.claude/plugins/cache/praxisflux/spec-bridge/0.65.3/gates/cli.mjs check .`. Expect exit 0.
- [x] T055 Run `pnpm env:down`, then `pnpm env:prune --check`. Expect exit 0.

## Dependencies and order

- Phase 1 blocks every later phase.
- Phases 2, 3, and 4 share `routes/ask.tsx` and the store. Run them in order: 2 → 3 → 4.
- Phase 5 needs Phases 2–4 for the two-browser run.
- Phase 6 runs last. T051 needs T050 and a stack with the `answering` purpose.

## Parallel opportunities

- Phase 1: T001, T004, T006, T010, T013 touch separate files. T003 follows T001. T008 and T009 follow T007.
- Phase 2: T022 and T023.
- Phase 3: T030, T031, T032.
- Phase 6: T046–T049.
