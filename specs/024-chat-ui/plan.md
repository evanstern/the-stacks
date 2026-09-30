# Implementation Plan: Chat UI — streaming answers and clickable citations

**Branch**: `task-0028-chat-ui` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)
**Board task**: TASK-0028 | **Input**: `specs/024-chat-ui/spec.md`
**Direction**: [`docs/design/chat-ui/decision.md`](../../docs/design/chat-ui/decision.md) (accepted
2026-09-29, amended for doc-0003; rulings of 2026-09-30 in effect)
**Base**: the TASK-0040 stack (spec 025): React Router 8 framework mode with SSR, Tailwind v4,
shadcn/ui, Hono mounting `apps/web/server.ts` last.

## Summary

Build the M1 demo surface on the spec-025 base. The shell, the Library page, and the
operator-only views render on the server. Books and jobs reach loaders through one new
load-context method, `jobs()`. Ask streams in the browser: `fetch` to `POST /library/ask`,
a small SSE parser, and a pure turn reducer. Upload uses XHR for progress; job polling runs
in the browser. The conversation, the upload, and the poll live in one app-level store above
every route, so they survive navigation. The Daylight palette becomes the app's CSS tokens,
checked for WCAG AA by a unit test. The slide-out panel wraps shadcn `Sheet` once. Icons are
inline SVG. **No new package.** No HTTP route and no contract changes.

## Technical Context

**Language/Version**: TypeScript 5.9, Node 22 (ESM), React 19.3.

**Primary Dependencies**: all already installed by TASK-0040: `react-router` 8.4, `radix-ui`
1.6.7 (its `Dialog` primitive backs `Sheet`), Tailwind 4.3.3, `class-variance-authority`,
`clsx`, `tailwind-merge`. See [New dependencies](#new-dependencies): none.

**Storage**: none new. `jobs()` reads the existing `jobs` table through `listJobs`.

**Testing**:
- `node:test` (web): the SSR suite grows; new pure-module suites run `.ts` sources directly
  through Node 22's type stripping (research R8).
- vitest (server): `static.test.ts` and one DB integration case for `jobs()`.
- Manual: the piloted two-browser run (quickstart §6), recorded in Brave.

**Target Platform**: the per-worktree stack and the runtime image (`node:22-alpine`).

**Project Type**: web app plus server, one process.

**Constraints**:
- No CDN, no webfont, no remote asset. System font stack.
- No `<dialog>`, no `showModal`, no shadcn `Dialog`/`AlertDialog` component.
- No `apps/server` import from `apps/web`. No self-HTTP from loaders.
- No new HTTP route. `ask-sse.md` and `http-ingest.md` unchanged.
- Book text never in browser storage (CR-004).

**Scale/Scope**: about 15 new files in `apps/web/app`, 6 new web test files, edits to
`root.tsx`, `routes.ts`, `home.tsx`, `app.css`, `packages/shared/src/web.ts`,
`apps/server/src/{web,static,app}.ts`, two server tests, wiki notes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Agent-operable** — every UI action is a plain request to a documented route:
      `POST /library/uploads`, `GET /library/jobs`, `POST /library/ask`, `/auth/*`, `/ws`.
      The loaders' `jobs()` calls the same `listJobs` function `GET /library/jobs` serves, so
      the page and an agent read one source. UI preferences (sidebar, theme) are per-browser
      display state, not capabilities.
- [x] **II. Content contract** — N/A: no codex entity.
- [x] **III. Data planes** — `apps/web` imports only `@the-stacks/shared` types and `~/*`.
      The `JobStatus` shape is restated in `packages/shared/src/web.ts`, citing
      `http-ingest.md`. Ask's event types are restated in `apps/web/app/ask/types.ts`, citing
      `ask-sse.md`. `check:boundaries` stays green.
- [x] **IV. Event-sourced play** — the play route and `useSession` are unchanged. The Table
      landing only picks a session id.
- [x] **V. Citations** — every marker carries book, section, and quote in its accessible name
      and opens its passage. The highlight is `passage.text.slice(quoteInPassage.start,
      quoteInPassage.end)`, tested equal to `quote`. A refusal discards every delta (tested).
- [x] **VI. System-agnostic** — N/A: no mechanics.
- [x] **VII. Structured first** — N/A: no generated artifacts.
- [x] **VIII. Operator-owned content** — `jobs()` returns `null` for any non-operator. Player
      views render server-side and never call a library route or `jobs()` (SSR test). The
      conversation lives in memory only. The Table shows no library content. SC-008 is
      measured in the recording run.
- [x] **IX. Self-hostable** — no dependency, no CDN, no webfont, inline SVG icons. `docker
      compose up` unchanged.

No violation. No Complexity Tracking entry.

## Design

### D1 — Files

```text
apps/web/app/
├── root.tsx                 # loader: { user, ui }; Layout sets data-theme; signed-in branch mounts store + shell
├── routes.ts                # index, ask, books, play, play/:sessionId, settings
├── routes/home.tsx          # loader-only redirect: operator → /ask, player → /play
├── routes/ask.tsx           # loader: jobs or forbidden; conversation + source pane + Sources panel
├── routes/books.tsx         # the Library page (URL /books, D3); loader: jobs or forbidden
├── routes/table.tsx         # Table landing: Start a new table / Join by link or id
├── routes/play.tsx          # unchanged apart from dropping its own sign-out (the shell owns it)
├── routes/settings.tsx      # theme: System / Light / Dark
├── ui-prefs.ts              # pure: parse and serialize the two UI cookies
├── store/app-store.ts       # createAppStore(): conversation, upload, jobs poll (framework-free)
├── store/provider.tsx       # AppStoreProvider, useAppStore(selector)
├── ask/types.ts             # ask-sse.md restated: Citation, AskEvent, DoneSummary, Refusal, AskError
├── ask/sse.ts               # pure: incremental SSE parser
├── ask/turns.ts             # pure: turn reducer (delta, citation, done, refusal, error, end, stop)
├── ask/highlight.ts         # pure: split passage text into before / mark / after
├── library/books.ts         # pure: deriveBooks(jobs), pill(job), stageIndex(job)
├── library/upload.ts        # XHR wrapper + pure classifyUploadResponse()
├── shell/shell.tsx          # sidebar (≥701px) and bottom tab bar (≤700px), role-aware
├── shell/operator-only.tsx  # the "available to the operator only" view
├── components/icons.tsx     # inline SVG icons
├── components/panel.tsx     # the project's slide-out panel (wraps Sheet)
├── components/sources.tsx   # Sources button + Sources panel body
├── components/ui/sheet.tsx  # shadcn Sheet (added by the CLI, icon import replaced)
└── app.css                  # Daylight tokens, variants, panel keyframes
apps/web/test/
├── ssr.test.mjs             # extended
├── sse.test.mjs  turns.test.mjs  highlight.test.mjs  books.test.mjs
├── ui-prefs.test.mjs  upload.test.mjs
├── contrast.test.mjs        # WCAG AA on app.css tokens
└── no-dialog.test.mjs       # SC-007 scan
```

`app/sign-in.tsx`, `auth.ts`, `context.ts`, `ws/*`, and `server.ts` do not change.

### D2 — The load context gains `jobs()`

This is a **new load-context method, not an HTTP contract change**. It is named here so the
operator checkpoint sees it plainly.

`packages/shared/src/web.ts` gains, as types only:

```ts
/** JobStatus from specs/017-ingestion-pipeline/contracts/http-ingest.md, restated. */
export interface LibraryJob { id: string; book: string; status: "queued" | "running" | "succeeded" | "failed";
  stage: "extract" | "parse" | "store" | "embed" | null; format: "zip" | "html" | "markdown";
  filename: string; bytes: number; attempts: number; createdAt: string; startedAt: string | null;
  finishedAt: string | null; heartbeatAt: string | null; result: LibraryJobResult | null; error: string | null }
export interface LibraryJobResult { documentId: string; chunkCount: number; pages: number;
  embedding: { status: "embedded"; model: string; count: number } | { status: "skipped"; reason: string } }

export interface StacksLoadContext {
  identity(): Promise<PublicUser | null>;
  /** Newest 100 jobs, as GET /library/jobs?limit=100 returns them. null unless the caller is an operator. */
  jobs(): Promise<LibraryJob[] | null>;
}
```

`LibraryJobResult` lists only the fields the UI reads. The server's full `JobResult` is
assignable to it, so the server implementation type-checks the restatement.

Server side:
- `createWebLoadContext(c, { lookup, listJobs })`. `jobs()` awaits `identity()`; for no user
  or a non-operator it resolves `null` without touching the database. Otherwise it returns
  `listJobs(100)`.
- `createWebMiddleware` takes `listJobs: (limit: number) => Promise<LibraryJob[]>`.
  `app.ts` passes `(limit) => listJobs(db, limit)` from `library/ingest/jobs.ts`.
- `jobs()` is not memoized: a loader calls it once per request.

The role check lives in two places on purpose. Loaders check the role first and never call
`jobs()` for a player. `jobs()` enforces it again, so a future loader that forgets cannot
leak (constitution VIII).

### D3 — The Library page lives at `/books`

`/library` and `/library/*` are reserved paths (spec 025, `static.ts`). A request for
`/library` never reaches React Router and answers the JSON 404. The spec's player scenario
("opens `/library` directly") is unbuildable on this base. The page therefore lives at
**`/books`**. Its title and nav label stay "Library". spec.md is amended in the same commit
as this plan (US4 narrative, US4 scenario 4, FR-037). Changing the reserved set was rejected
(research R3). This is operator checkpoint 3.

### D4 — Routes and rendering split

| Path | Loader (server) | Renders on the server | Client-only |
|---|---|---|---|
| `/` | `redirect("/ask")` for an operator, `redirect("/play")` for a player, `null` signed out | — | — |
| `/ask` | player → `{ forbidden: true }`; operator → `{ jobs: await jobs() }` | shell, empty conversation, source pane, Sources button, prompt (disabled until hydrated) | streaming, stop, retry, citations, panel |
| `/books` | same as `/ask` | shell, dropzone, title field, Recent imports with pills and stepper | file choice, XHR upload, polling |
| `/play` | none | Table landing | Start (needs `crypto.randomUUID`) |
| `/play/:sessionId` | `clientLoader` + `HydrateFallback`, unchanged | fallback only | everything |
| `/settings` | none | theme control, current value from the root loader | cookie write |

- Loaders read the load context only. None calls the app's own HTTP API.
- The root gate is unchanged: `user === null` renders `<SignIn />` for any path.
- Signed-in root renders `<AppStoreProvider key={user.id}><Shell><Outlet/></Shell></AppStoreProvider>`.
- A player's `/ask` and `/books` HTML carries the operator-only view and no operator nav. No
  client code for those views calls the store's library actions.

### D5 — Per-browser UI state in cookies

- Two cookies: `stacks-sidebar` (`expanded` | `collapsed`) and `stacks-theme` (`system` |
  `light` | `dark`). Attributes: `Path=/; Max-Age=31536000; SameSite=Lax`. Not `HttpOnly`:
  the client writes them. They hold no secret.
- `app/ui-prefs.ts` (pure, no imports):
  - `readUiPrefs(cookieHeader: string | null): { sidebar, theme }`. Unknown or missing
    values fall back to `expanded` and `system`.
  - `uiCookie(name, value): string`, the `document.cookie` assignment string.
- The root loader returns `{ user, ui: readUiPrefs(request.headers.get("cookie")) }`.
- `Layout` reads `useRouteLoaderData("root")` and sets `<html data-theme={theme}>` for `light`
  and `dark`, and no attribute for `system`. The shell sets `data-sidebar="collapsed"` from
  the same data. The first byte of HTML is already correct, so nothing flashes.
- Writing: the toggle sets local state at once, assigns `document.cookie = uiCookie(...)`,
  and calls `useRevalidator().revalidate()` so the root data agrees. For the theme, the
  control also sets `document.documentElement.dataset.theme` at once.
- `localStorage` is never used for UI state.

### D6 — Theme tokens

- Replace shadcn's neutral oklch variables in `app/app.css` with the Daylight palette, in hex,
  mapped onto shadcn's semantic names so the copied components pick it up:

  | Daylight (mock) | Token | Light | Dark |
  |---|---|---|---|
  | bg | `--background` | `#f4f6f6` | `#14181a` |
  | panel | `--card`, `--popover` | `#ffffff` | `#1c2124` |
  | panel-2 | `--muted`, `--secondary`, `--accent` (hover surface) | `#eef1f1` | `#242a2d` |
  | sidebar | `--sidebar` | `#eef1f1` | `#1a1f22` |
  | ink | `--foreground` and every `*-foreground` on surfaces | `#1b2023` | `#e8ecee` |
  | muted | `--muted-foreground` | `#5b6570` | `#a9b2b8` |
  | border | `--border` (dividers only) | `#d7dbe0` | `#343b3f` |
  | — (new) | `--input` (control boundaries, 3:1) | `#7a848d` | `#6b757c` |
  | accent | `--primary`, `--sidebar-primary` | `#0f6f63` | `#4fd1c0` |
  | accent-ink | `--primary-foreground` | `#ffffff` | `#0b2620` |
  | focus | `--ring` | `#1a5fb4` | `#8ec2ff` |
  | mark-bg / mark-ink | `--mark`, `--mark-foreground` | `#cfeee7` / `#0b2620` | `#2c4a44` / `#d9f5ef` |
  | danger / danger-bg | `--destructive`, `--destructive-surface` | `#8a2a1e` / `#fbe7e2` | `#f2a89b` / `#3a1f1a` |
  | ok / ok-bg | `--ok`, `--ok-surface` | `#1a6b3c` / `#e3f3e8` | `#8fd6ac` / `#1c3327` |
  | proc / proc-bg | `--proc`, `--proc-surface` | `#8a5a05` / `#fbeecb` | `#e0b23a` / `#3a2f14` |
  | queued-bg | `--queued-surface` | `#eceff0` | `#25292b` |

  `--input` is new: the mock's `--border` is 1.3:1 against the page, too low for a control's
  boundary (FR-040). Dividers keep `--border`.
- Three blocks carry the values: `:root` (light), `@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { … } }`, and `:root[data-theme="dark"] { … }`. The two dark
  blocks are identical; the contrast test asserts that.
- `@theme inline` maps each token to `--color-*`, as today, plus the new ones.
- `@theme { --font-sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; --font-mono:
  ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }`.
- Replace `@custom-variant dark (&:is(.dark *))` with a block variant that matches both the
  media query (unless `data-theme="light"`) and `[data-theme="dark"]`:

  ```css
  @custom-variant dark {
    @media (prefers-color-scheme: dark) { &:where(:root:not([data-theme="light"]) *) { @slot; } }
    &:where([data-theme="dark"], [data-theme="dark"] *) { @slot; }
  }
  @custom-variant narrow (@media (width <= 700px));
  ```

  `narrow:` is the one name for the ≤700px layout (FR-003, FR-036).
- `html { color-scheme: light dark; }` and `:root[data-theme="light"] { color-scheme: light }`,
  `:root[data-theme="dark"] { color-scheme: dark }`.
- Global `:focus-visible { outline: 3px solid var(--ring); outline-offset: 2px; }` (FR-041).

### D7 — The slide-out panel (`Sheet`) and the no-modals rule

**What `Sheet` is.** shadcn's `Sheet` is built on the Radix **Dialog primitive**
(`import { Dialog as SheetPrimitive } from "radix-ui"`). `radix-ui` 1.6.7, already installed,
pins `@radix-ui/react-dialog` 1.1.23, already in the lockfile. Nothing new is installed. The
rendered panel is a `<div role="dialog" aria-modal="true">`, never a `<dialog>` element, and
never calls `showModal`.

**Why this satisfies the rule.** The operator's no-modals rule is about UX: no `<dialog>`, no
`showModal`, no centred overlay. doc-0003 ruling 3 and decision-0008 name `Sheet` as the
sanctioned slide-out pattern; the decision record builds the panel on it and allows dimming
the page. The panel is edge-anchored (right on desktop, bottom under 700px) and never
centred. `role="dialog"` with `aria-modal` is the correct ARIA for a focus-trapping panel; it
is semantics, not a modal UX.

**The grep gate, rescoped.** TASK-0040's T040 grep (`grep -rniE 'dialog' apps/web/app`)
would false-positive on `sheet.tsx`'s primitive import. The gate forbids a Dialog/AlertDialog
*component*, so this task replaces it with:
1. `ls apps/web/app/components/ui` has no `dialog.tsx` and no `alert-dialog.tsx`.
2. `grep -rnE '<dialog|showModal|AlertDialog' apps/web/app` → zero hits.
3. `grep -rlwE 'Dialog' apps/web/app` → exactly `apps/web/app/components/ui/sheet.tsx`.
4. `test/no-dialog.test.mjs` encodes 1–3, so `pnpm test` enforces them in CI (SC-007).

**Adding it.** Run `pnpm dlx shadcn@4.21.0 add sheet` in `apps/web`. The copied file imports
`XIcon` from `lucide-react`; replace it with the project's `CloseIcon` (D9). If the CLI adds
`lucide-react` or `tw-animate-css` to `package.json`, remove them. Replace the `animate-in` /
`slide-in-from-*` classes (from `tw-animate-css`, not installed) with the keyframes in D6's
`app.css`: `panel-in-right`, `panel-out-right`, `panel-in-up`, `panel-out-down`, disabled under
`prefers-reduced-motion`. Radix `Presence` waits for `animationend`, so exit animations work.

**The wrapper, `components/panel.tsx`**, is the only way the app opens a panel:

```tsx
<Panel open={open} onOpenChange={setOpen} title="Sources" description="…">…</Panel>
```

- `SheetContent side="right"` with classes that turn it into a bottom sheet under `narrow:`
  (`inset-x-0 bottom-0 top-auto h-[85dvh] w-full rounded-t-xl`, plus a drag-handle bar that is
  decorative only). One component, CSS-only switch; no `matchMedia`.
- Desktop width `w-96 max-w-[90vw]`, full height, `border-l`.
- `SheetTitle` gives the accessible name (FR-020). `SheetDescription` is visually hidden when
  present.
- Radix supplies the focus trap, Escape, and focus return to the trigger. The close control
  is `SheetClose` with `aria-label="Close"`.
- `SheetOverlay` stays as the permitted dim, `bg-black/40`, not blurred. Clicking it closes.
- The trigger is the caller's own `<button aria-expanded aria-controls>`; the panel is
  controlled (`open`/`onOpenChange`), so the trigger does not have to be a `SheetTrigger`.
  Pass `id` to `SheetContent` for `aria-controls`.

### D8 — The app-level store

The conversation, the upload, and the jobs list live in one store per signed-in user,
created in the root's signed-in branch. **No state library.** React's
`useSyncExternalStore` over a plain object is enough.

- `store/app-store.ts` exports `createAppStore({ onUnauthorized })`. It holds:
  - `turns: Turn[]`, `openCitation: { turnId, n } | null`, `askError: string | null`;
  - one `AbortController` for the live ask stream;
  - `upload: { file name, size, sent, total, error } | null` and its XHR abort handle;
  - `jobs: LibraryJob[] | null`, `forbidden: boolean`, and the poll timer.
- Actions: `ask(question)`, `stop()`, `retry(turnId)`, `openCitation(turnId, n)`,
  `seedJobs(jobs)`, `refreshJobs()`, `upload(file, book)`, `cancelUpload()`, `dispose()`.
- `store/provider.tsx`: `AppStoreProvider` creates the store once with `useState(() =>
  createAppStore(…))`, and calls `dispose()` on unmount. `useAppStore(selector)` wraps
  `useSyncExternalStore` with a server snapshot equal to the initial state.
- The provider is keyed by `user.id`. Sign-out re-renders root as `<SignIn/>`, the provider
  unmounts, and `dispose()` aborts the stream, the upload, and the poll. Nothing reaches
  browser storage (FR-028, CR-004).
- **Never a module-level singleton**: SSR would share it across requests and users.
- `onUnauthorized` is the root's `revalidate`. Any `401` from ask, upload, or jobs calls it;
  the root loader then renders sign-in.
- A `403` from any library route sets `forbidden`, and Ask/Library render the operator-only
  view (FR-038).

### D9 — Icons: inline SVG

`components/icons.tsx` exports small components for the mock's glyphs: `StackIcon` (brand,
Sources), `AskIcon`, `LibraryIcon`, `TableIcon`, `SettingsIcon`, `UploadIcon`, `CloseIcon`,
`MenuIcon`, `ChevronIcon`, `StopIcon`, `SunIcon`, `MoonIcon`. Each is a 24×24 stroke `<svg
aria-hidden="true" focusable="false">` taking `className`. The paths come from
`round-2/a2-daylight.html`, lines 185–197. About 60 lines.

`lucide-react` is not added (research R5). The spec's CR-005 already says "icons are inline
SVG", and a dozen glyphs do not justify a dependency.

### D10 — Ask: stream, parser, reducer

- **Request** (`store.ask`): trim; empty → `askError = "Enter a question."`, no request.
  Otherwise `fetch("/library/ask", { method: "POST", headers: { "Content-Type":
  "application/json" }, body: JSON.stringify({ question }), signal, credentials:
  "same-origin" })`. Never `EventSource`.
- Non-200 before the stream: `400` → `askError = error.message`, conversation unchanged
  (FR-027). `401` → `onUnauthorized`. `403` → `forbidden`.
- `200`: push a `streaming` turn. Read `res.body` with a `TextDecoder("utf-8", { stream })`,
  feed chunks to the parser, and apply each event to the turn.
- **`ask/sse.ts`**: `createSseParser()` returns `push(text): SseMessage[]` and `end():
  SseMessage[]`. It splits on blank lines, accepts `\n`, `\r\n`, and `\r`, joins multiple
  `data:` lines with `\n`, ignores comments (`:`), and keeps a partial message across chunks.
  No imports. The contract's single-line JSON is a subset, so the parser stays generic.
- **`ask/turns.ts`**: `applyEvent(turn, { event, data })` returns a new turn.
  - `delta` appends to the last text part, or starts one.
  - `citation` appends `{ type: "cite", n }` and stores `citations[n]` once (a repeat keeps
    the first, FR-022).
  - `done` → `state: "done"`, `summary` kept (for `dropped`).
  - `refusal` → `state: "refused"`, `parts = []`, `citations = {}`, `message` (FR-024).
  - `error` → `state: "interrupted"`, parts kept, `message` from the event (FR-025).
  - `endWithoutTerminal(turn)` → `interrupted`, "The connection closed before the answer
    finished."
  - `stopTurn(turn)` → `stopped`, parts kept (FR-023).
  - Unknown events are ignored.
- **Stop**: `abort()`; the reader rejects with `AbortError`; the turn becomes `stopped`.
- **Retry** (FR-029): re-ask the same question, replacing the failed turn in place.
- **Navigation** (FR-028): the reader loop lives in the store, not a component. Leaving Ask
  unmounts only the view; the loop keeps writing to the store.
- One stream at a time. Ask is disabled while a turn is streaming.

### D11 — Citations and the source pane

- A marker is `<button type="button" class="cite">[n]</button>` with `aria-label="Citation
  n: <book>, <section joined by ' › '>"`, and `title` set to the quote (FR-032).
- `ask/highlight.ts`: `splitPassage(text, { start, end })` returns `[before, marked, after]`,
  clamping out-of-range offsets. The test asserts `marked === quote` for every contract
  example and for every passage kind (SC-003).
- The source pane renders `<p class="whitespace-pre-wrap">` with the three parts, the middle
  one in `<mark>` styled `bg-mark text-mark-foreground`. A `table` kind uses `font-mono`. The
  pane labels the kind: Heading, Prose, List, Table, Stat block, Sidebar (FR-034).
- Header: the book, then `section.join(" › ")` (FR-033). Empty: "No citation selected."
- Desktop: the pane is a labelled `<aside aria-label="Source">`, collapsible with a button
  that sets `aria-expanded` (FR-035). Collapse state is per page view, not a cookie.
- `narrow:` a Chat | Source segmented control (two `aria-pressed` buttons) switches views.
  Opening a citation switches to Source; "Back to answer" switches to Chat (FR-036).

### D12 — Library, upload, polling, books

- **`library/books.ts`** (pure, no imports):
  - `bookKey(name)` = `name.trim().toLowerCase()`.
  - `deriveBooks(jobs)`: newest job per key; returns `{ name, pill, detail }[]`.
  - `pill(job)`: `queued` → "Ingesting · queued"; `running` → "Ingesting · <stage>" or
    "Ingesting"; `succeeded` + `embedded` → "Ready"; `succeeded` + `skipped` → "Search-only";
    `failed` → "Failed".
  - `stageIndex(job)` for the stepper extract → parse → store → embed.
  - `hasActive(jobs)`.
- **Polling**: while `hasActive(jobs)`, the store fetches `GET /library/jobs?limit=100`
  every 1500 ms, with `setTimeout` chained after each response (never overlapping). It stops
  when nothing is active, and restarts after a `202` or a cancel (FR-011, FR-014).
  `seedJobs` from a loader starts it if needed.
- **`library/upload.ts`**: `sendUpload(file, book, onProgress)` returns `{ done: Promise<
  { status, body } | "network" | "aborted">, abort }`. It builds `FormData` with `book` first,
  then `file` (FR-009), and reports `xhr.upload.onprogress`. `classifyUploadResponse(result)`
  is pure: `202` → accepted; `400`/`409`/`413` → the body's `error.message`; `401` →
  unauthorized; `403` → forbidden; `"network"` → "Upload failed. Check your connection and
  try again."; `"aborted"` → cancelled.
- **Title** (FR-008): default = file name without its last extension; empty → "Enter a book
  title." and no request.
- **Dropzone** (FR-007): a `<label>` wrapping a visually hidden `<input type="file"
  accept=".zip,.html,.htm,.md,.markdown">`, so click and keyboard work natively. Drag and
  drop sets the same file. Text and "Max 1 GB" from FR-006.
- **One upload** (FR-012): the store refuses a second while one runs. It survives leaving
  Library and closing the panel, because it lives in the store.
- **Recent imports** (FR-013): SSR from loader data, then from the store. Started time is a
  `<time dateTime>`; its human text renders after hydration to avoid a server/client clock
  mismatch.
- **Sources panel** (FR-016–FR-018): the Ask header's Sources button shows `StackIcon`,
  "Sources · <n>", and a `ChevronIcon` rotated when open. It has a border, hover and pressed
  styles, `aria-expanded`, and `aria-controls="sources-panel"`. The panel lists
  `deriveBooks(jobs)`, each with its pill and a link "Open in Library" to `/books`. The
  upload card sits at the top. The inline "Add a book" dropzone at the bottom calls the same
  `store.upload`.
- Empty library: Library shows FR-015's text. Ask shows "Import a book to start asking." with
  a link to `/books`, and the prompt is disabled (FR-031).

### D13 — Shell

- `shell/shell.tsx`: a CSS grid of sidebar and main. `≥701px`: a left sidebar, 15rem, or
  4rem when `data-sidebar="collapsed"` (labels become visually hidden; icons stay; each link
  keeps its accessible name). `narrow:`: the sidebar hides and a fixed bottom tab bar shows
  the same links.
- Links by role (FR-001): operator → Ask `/ask`, Library `/books`, Table `/play`, and
  Settings `/settings` at the bottom; player → Table only. The user's display name, role,
  and Sign out sit at the bottom for both. `NavLink` sets `aria-current="page"`.
- The nav is built from `user.role` in the root loader's data, so the server never emits
  operator links to a player.
- `<nav aria-label="Main">`, `<main>` labelled by each page's `<h1>`.
- Sign out: `signOut()` then `revalidate()`. `play.tsx` loses its own sign-out button; the
  shell's replaces it.

### D14 — Table landing and Settings

- `/play` (FR-005): "Start a new table" navigates to `/play/<crypto.randomUUID()>`; it is
  disabled until hydrated. "Join a table" takes a link or id, extracts the first UUID with a
  regex, and navigates; no match → "Enter a table link or id."
- `/settings` (FR-039): a radio group System / Light / Dark, per D5. Nothing else.

### D15 — Tests

All web tests run with `node --test` from `apps/web`. The pure-module suites import `.ts`
sources directly (research R8). Rule for those modules: **no runtime imports; `import type`
only**, and erasable TypeScript only (no `enum`, no `namespace`, no parameter properties).

| File | Asserts |
|---|---|
| `sse.test.mjs` | chunk splits mid-line and mid-message; CRLF; multi-`data`; comments; `end()` flushes nothing partial |
| `turns.test.mjs` | delta order; citation placement; repeated `n`; refusal clears everything (SC-004); error keeps text; end-without-terminal; stop; dropped summary |
| `highlight.test.mjs` | `marked === quote` for the contract example and for one citation per `passage.kind` (SC-003); clamping |
| `books.test.mjs` | grouping by trimmed lower-case name; newest wins; every pill; `null` stage; `hasActive` |
| `ui-prefs.test.mjs` | missing, garbage, and valid cookies; the serialized string's attributes |
| `upload.test.mjs` | `classifyUploadResponse` for 202, 400, 409, 413, 401, 403, network, aborted |
| `contrast.test.mjs` | parses the three token blocks in `app/app.css`; text pairs ≥ 4.5:1; `--ring` and `--input` against `--background` and `--card` ≥ 3:1; the two dark blocks are identical (SC-006) |
| `no-dialog.test.mjs` | D7's scan (SC-007) |
| `ssr.test.mjs` | see below |

`ssr.test.mjs` (stub context now has `identity` and `jobs`; the `jobs` stub counts calls):
- `/` signed out shows the form.
- `/` as operator → 302 to `/ask`; as player → 302 to `/play`.
- `/ask` as operator shows the display name, links to `/ask`, `/books`, `/play`, `/settings`,
  and "No citation selected.".
- `/ask` and `/books` as player show the operator-only text, contain no `href="/books"` or
  `href="/ask"`, and the `jobs` stub was called zero times.
- `/books` as operator with one `succeeded`+`embedded` job shows "Ready" and the book name;
  with no jobs shows FR-015's text.
- Cookie `stacks-theme=dark` → `<html` carries `data-theme="dark"`; `stacks-sidebar=collapsed`
  → `data-sidebar="collapsed"`; no cookie → neither.
- `/play/<uuid>` still shows the fallback.

The existing "/ signed in shows the display name" case moves to `/ask`, since `/` now
redirects.

Server:
- `static.test.ts`: the handler's context has `jobs()`; it resolves `null` with no cookie
  and never calls the injected `listJobs`.
- `library/jobs.integration.test.ts` (DB): a load context for an operator token returns the
  inserted job; for a player token returns `null`.

### D16 — AC #4 evidence

- The piloted run is quickstart §6. The operator follows it by eye.
- The recording script is `specs/024-chat-ui/evidence/record-ac4.mjs`. It is committed and runs
  out of tree:
  - it loads `playwright-core` with `createRequire` from `PLAYWRIGHT_DIR` (default
    `/Users/evanstern/.claude/jobs/a48ac8bd/tmp`), where 1.63.0 is installed;
  - it launches Brave (`executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave
    Browser"`) once, with two browser contexts, so the cookie jars differ;
  - each context records video at 960×600 into `specs/024-chat-ui/evidence/`;
  - it reads `APP_PORT`, `OPERATOR_PASSWORD`, and `PLAYER_PASSWORD` from the environment and
    writes none of them anywhere;
  - it logs every request the player's page makes and writes the `/library` count to
    `evidence/ac4-player-requests.txt` (SC-008: expect 0).
- Output: `ac4-operator.webm` and `ac4-player.webm`, renamed from Playwright's random names.
  Keep each under 8 MB; the run is about 90 s. Commit both, the script, and the requests file.
- `playwright-core` is never added to any `package.json`.

### D17 — Dev loop

`pnpm dev` (spec 025 D7) is unchanged: Vite in middleware mode inside Hono, HMR on
`WEB_HMR_PORT`. Quickstart §7 uses it for UI work. The load context's `jobs()` works in dev
because the dev handler receives the same context.

## Operator checkpoints

Answer these before `/speckit-implement` starts. The recommendation follows each item.

1. **New dependencies: none.** Every item below the table was considered and not added.
   Recommend: approve "none".
2. **`Sheet` under the no-modals rule** (D7).
   - `Sheet` is built on the Radix Dialog primitive, already installed through `radix-ui`.
     It renders `role="dialog" aria-modal="true"` on a `<div>`: no `<dialog>`, no `showModal`,
     edge-anchored, never centred.
   - It keeps shadcn's overlay as a dim (the decision record's "may dim the page"). Clicking
     it closes the panel.
   - TASK-0040's `grep -rniE 'dialog'` gate is replaced by D7's three checks plus
     `no-dialog.test.mjs`, which allow the word `Dialog` only in `components/ui/sheet.tsx`.
   - Recommend: approve the panel as designed and the rescoped gate.
3. **Library page URL `/books`** (D3). `/library` is reserved, so a page cannot live there.
   The nav label and title stay "Library". spec.md is amended (US4 narrative, US4 scenario
   4, FR-037). Recommend: approve `/books`. The alternative is narrowing the reserved set,
   which reopens a TASK-0040 checkpoint.
4. **Icons: inline SVG, no `lucide-react`** (D9). About a dozen glyphs from the mock, one file.
   `sheet.tsx`'s `XIcon` import is replaced. Recommend: approve inline SVG.
5. **New load-context method `StacksLoadContext.jobs()`** (D2). It is not an HTTP contract
   change. It adds `LibraryJob` (a restatement of `http-ingest.md`'s `JobStatus`) to
   `packages/shared`, and returns `null` for non-operators. Recommend: approve.
6. **UI cookies are client-written, not `HttpOnly`** (D5): `stacks-sidebar` and
   `stacks-theme`, one year, `SameSite=Lax`. They hold display preferences only.
   Recommend: approve.
7. **Recording artifacts** (D16): two webm files, each under 8 MB, committed under
   `specs/024-chat-ui/evidence/`. The run needs the `answering` purpose configured in the root
   `.env`; without it, Ask shows the `config` error as Interrupted. Recommend: approve, and
   confirm `answering` is configured before the recording task.

## New dependencies

| Package | Version (`npm view`, 2026-09-30) | Why | Runtime or dev |
|---|---|---|---|
| — | — | None added. `Sheet` uses `radix-ui` 1.6.7's Dialog primitive (`@radix-ui/react-dialog` 1.1.23, already in the lockfile). | — |

**Considered and not added**:

| Package | Version checked | Why not |
|---|---|---|
| `lucide-react` | 1.49.0 | Inline SVG covers a dozen icons; CR-005 already says inline SVG (D9, research R5). |
| `tw-animate-css` | 1.4.0 | Four keyframes in `app.css` replace it (D7). |
| `jsdom` | 30.1.1 | The logic worth testing is pure; the SSR suite covers markup (research R8). |
| `@testing-library/react` | 16.3.3 | Same as `jsdom`. |
| `playwright-core` | 1.63.0 | Used out of tree for the recording only (D16); never in a `package.json`. |
| any state library | — | `useSyncExternalStore` over one plain store (D8). |
