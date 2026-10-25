# Research — 024 chat UI

Decisions made against the TASK-0040 base on this branch (`44cad26`, origin/main merged at
`bca4b05`). The decision record, doc-0003, and the 2026-09-30 rulings are taken as given; this
file records only how to build them. Package versions were checked with `npm view` on
2026-09-30. The host runs Node 22.23.2.

## R1 — Rendering split: SSR the shell and Library, stream Ask in the browser

- **Decision**: loaders render the shell, the Library page, and every operator-only view.
  Ask's conversation, upload progress, and polling run after hydration. The Table stays
  client-only (spec 025 R4).
- **Why**: the decision record's Stack section says so. First paint shows real book status.
  A React Router action cannot stream SSE to a fetch reader (ruling 2026-09-30), so Ask posts
  to `/library/ask` directly.
- **Alternatives rejected**:
  - *Resource route proxying `/library/ask`*: a second path to the same capability, and it
    would re-serialize the stream through React Router for no gain.
  - *Client-only Ask and Library*: first paint without status; contradicts the record.

## R2 — Loaders get jobs through a new load-context method, `jobs()`

- **Decision**: add `jobs(): Promise<LibraryJob[] | null>` to `StacksLoadContext`, typed in
  `packages/shared`, implemented in `apps/server/src/web.ts` over the existing
  `listJobs(db, 100)`. It returns `null` for a non-operator.
- **Why**: doc-0003 ruling 5 forbids loaders calling the app's own HTTP API, and spec 025 D3
  says "a later loader need adds one method here, in the task that needs it". This is that
  task. The method reads the same function `GET /library/jobs` serves, so agents and pages see
  one source (constitution I).
- **Not an HTTP contract change.** `http-ingest.md` is unchanged. `LibraryJob` restates its
  `JobStatus`, and cites it.
- **Alternatives rejected**:
  - *Loader fetches `http://localhost:$PORT/library/jobs` with the cookie*: forbidden.
  - *A generic `library` object on the context*: YAGNI; one method is the whole need.
  - *Role check only in loaders*: one forgotten check would leak book names to a player.

## R3 — The Library page URL: `/books`

- **Decision**: serve the Library page at `/books`. Nav label and title stay "Library".
- **Why**: spec 025 made `/library` a reserved prefix; `isReservedPath("/library")` is true,
  so the request never reaches React Router and answers the JSON 404. The spec's `/library`
  page URL is unbuildable on this base. spec.md is amended (US4, FR-037).
- **Alternatives rejected**:
  - *Exempt exactly `/library` (no trailing path) from the reserved set*: reopens a TASK-0040
    checkpoint, and a page and an API sharing a prefix is the confusion the reserved set
    exists to prevent.
  - *`/library-page`, `/lib`*: awkward. `/books` also reads well beside TASK-0038's future
    Books table.

## R4 — Per-browser UI state in cookies read by the root loader

- **Decision**: `stacks-sidebar` and `stacks-theme` cookies, parsed by a pure `ui-prefs.ts`
  in the root loader, written client-side with `document.cookie`, then `revalidate()`.
- **Why**: ruling 2026-09-30. The server renders `data-theme` and `data-sidebar` in the first
  HTML, so no flash. Client writes are instant and need no route.
- **Alternatives rejected**:
  - *A React Router action at `/settings` that sets the cookie*: works, but adds a round trip
    to a toggle and a form for the sidebar. Kept as the fallback if a future need wants
    server-validated prefs.
  - *`localStorage` plus an inline script*: rejected by the ruling.
  - *One JSON cookie*: two flat values are simpler to parse and test.

## R5 — Icons: inline SVG, not `lucide-react`

- **Decision**: one `components/icons.tsx` with about a dozen stroke icons whose paths come
  from the round-2 mock.
- **Why**: spec CR-005 already says "icons are inline SVG". The mock already drew every glyph
  needed. A dependency (`lucide-react` 1.49.0) would add a package for about 60 lines of
  markup. The only external pull is `sheet.tsx`'s `XIcon`, replaced with `CloseIcon`.
- **Alternatives rejected**:
  - *`lucide-react`*: fine technically (ISC, tree-shaken, no CDN), but not needed. Revisit
    when icon count passes about 30 or a designer wants the full set.
  - *A sprite sheet with `<use href>`*: needs the sprite in every page; components are
    simpler with SSR.

## R6 — The panel: shadcn `Sheet`, wrapped once

- **Decision**: add `Sheet` with the shadcn CLI, strip its lucide and `tw-animate-css`
  dependencies, and wrap it in `components/panel.tsx` (right on desktop, bottom under
  700px via CSS).
- **What `Sheet` depends on**: `radix-ui`'s `Dialog` namespace (`@radix-ui/react-dialog`
  1.1.23, which brings `react-focus-scope`, `react-dismissable-layer`, `react-remove-scroll`,
  and `aria-hidden`). All are already in the lockfile through `radix-ui` 1.6.7.
- **Why it is allowed**: the no-modals rule targets UX (`<dialog>`, `showModal`, centred
  overlays). doc-0003 ruling 3 names `Sheet` as the sanctioned slide-out pattern. Radix
  renders a `<div role="dialog" aria-modal="true">`, the correct ARIA for a focus-trapping
  panel.
- **The gate**: TASK-0040's `grep -i dialog` would flag `sheet.tsx`. The gate's intent is "no
  Dialog/AlertDialog component". The rescoped check (plan D7) forbids `dialog.tsx`,
  `alert-dialog.tsx`, `<dialog`, `showModal`, and `AlertDialog`, and allows the word
  `Dialog` only in `components/ui/sheet.tsx`. A node test enforces it.
- **Responsive side**: one `SheetContent side="right"`, reshaped to a bottom sheet with the
  `narrow:` variant. No `matchMedia`, so SSR and hydration agree.
- **Alternatives rejected**:
  - *Hand-built panel with `inert` and a focus trap*: re-implements Radix's focus scope,
    Escape, and scroll lock; more code and more risk.
  - *Radix `Popover`*: not a focus trap; wrong semantics for a panel with a dropzone.
  - *`vaul` `Drawer`*: a new dependency for the drag gesture only; the handle is decorative.

## R7 — Conversation state: one store with `useSyncExternalStore`

- **Decision**: `createAppStore()` returns a plain object with `getState`, `subscribe`, and
  actions. `AppStoreProvider`, keyed by `user.id`, sits in the root's signed-in branch. The
  ask reader, its `AbortController`, the upload XHR, and the poll timer all live in the store.
- **Why**: spec Resolved open question 3 needs state that outlives any page. The root
  component outlives every child route. `useSyncExternalStore` is React's own primitive for
  this. Keying the provider by user id discards everything on sign-out.
- **Alternatives rejected**:
  - *Zustand / Jotai*: a dependency for one store.
  - *Module-level singleton*: shared across SSR requests and users; a data leak.
  - *React Router `useFetcher` / revalidation for jobs*: fits polling but not the stream or
    the XHR; two mechanisms for one store.
  - *`useReducer` + context*: re-renders the whole tree per delta; the external store lets
    each view select its slice.

## R8 — Web tests: `node --test` on `.ts` sources, no DOM

- **Decision**: pure modules (`sse`, `turns`, `highlight`, `books`, `ui-prefs`, `upload`'s
  classifier) are tested by `.mjs` suites that import the `.ts` files directly. Node 22.23
  strips types by default (verified on this host: a `.mjs` importing `./m.ts` runs).
  `contrast.test.mjs` and `no-dialog.test.mjs` read files. `ssr.test.mjs` covers markup
  through the built bundle.
- **Constraint**: those modules use `import type` only and erasable syntax only. The plan
  names it; Biome's `useImportType` already nudges toward it.
- **Why**: every rule worth a test is pure logic or a server-rendered string. The browser-only
  paths (stream reader, XHR, panel focus) are thin and proven in the recorded run.
- **Alternatives rejected**:
  - *jsdom + Testing Library*: two dependencies and a DOM emulation for code that is thin
    glue around the tested pure modules.
  - *vitest in `apps/web`*: a second runner; the base chose `node:test` (spec 025 D13).

## R9 — SSE parsing: a small generic parser

- **Decision**: `createSseParser()` in about 40 lines: line splitting over CR, LF, and CRLF,
  blank-line dispatch, multi-line `data`, comments ignored, a partial buffer across chunks.
- **Why**: the contract uses `event:` + one `data:` line, but chunk boundaries are arbitrary.
  A generic parser is barely larger than a special case and survives a server change.
- **Alternatives rejected**: `eventsource-parser` (a dependency for 40 lines); `EventSource`
  (cannot POST; the contract forbids it).

## R10 — Upload: XHR with progress

- **Decision**: `XMLHttpRequest` with `upload.onprogress`, `FormData` with `book` then `file`.
- **Why**: `fetch` exposes no upload progress; `http-ingest.md` names this exact fallback.
- **Cancel**: `xhr.abort()`. `http-ingest.md` guarantee 2 and
  `uploads.integration.test.ts` prove no job row is created. After a cancel, the store
  refreshes jobs once to catch the race (spec Resolved open question 4).

## R11 — Polling cadence

- **Decision**: chained `setTimeout(1500)` after each response while any job is queued or
  running; `limit=100`.
- **Why**: ruling 2026-09-30 fixes 1.5 s. Chaining never overlaps requests on a slow server.
  `limit=100` matches the book-derivation ceiling in spec Resolved open question 1.

## R12 — Contrast test on the real tokens

- **Decision**: parse `app/app.css`'s three token blocks with a regex, compute WCAG relative
  luminance, and assert each listed pair.
- **Pairs** (text ≥ 4.5:1): foreground on background, card, muted, and sidebar;
  muted-foreground on background, card, muted, and sidebar; primary-foreground on primary;
  primary on background and card; mark-foreground on mark; destructive on
  destructive-surface; ok on ok-surface; proc on proc-surface; muted-foreground on
  queued-surface. Non-text (≥ 3:1): ring and input on background and card.
- **Measured from the mock** (2026-09-30): the lowest text pair is 5.13:1 (proc on
  proc-surface, light; muted on queued, light). The mock's `--border` is 1.28:1, so control
  boundaries use the new `--input` (3.51:1 light, 3.45:1 dark).
- **Why values in hex**: the test and the mock both speak hex; oklch would need a converter.

## R13 — AC #4 recording

- **Decision**: a committed script, `evidence/record-ac4.mjs`, run with the out-of-tree
  `playwright-core` 1.63.0 at `/Users/evanstern/.claude/jobs/a48ac8bd/tmp`, driving Brave with
  two contexts and `recordVideo`. The script loads the package with `createRequire`.
- **Why**: the operator asked for both a piloted script and a recording (decision record,
  AC #4). Two contexts in one Brave process give two cookie jars, like two browsers. Playwright
  records webm natively; no ffmpeg step.
- **Size**: 960×600, about 90 s each → a few MB. The plan caps each file at 8 MB.
- **Alternatives rejected**: screen capture by hand (not repeatable); `playwright-core` in
  `devDependencies` (the runbook forbids new packages without a checkpoint, and CI does not
  need it).
