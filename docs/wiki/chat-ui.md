---
name: chat-ui
description: The Chat UI (TASK-0028, specs/024-chat-ui) — the app-level store (upload, jobs poll, streamed ask, citations) that outlives any one route; the incremental SSE parser and pure turn reducer behind streaming answers; the Sheet-based slide-out Panel (the project's only modal-shaped UI, never a <dialog>); the Daylight theme tokens and the two client-written UI cookies; and the role-aware route tree (Ask, Library, Table landing, Settings) and shell around them.
kind: component
sources:
  - apps/web/app/store/app-store.ts
  - apps/web/app/store/provider.tsx
  - apps/web/app/ask/sse.ts
  - apps/web/app/ask/turns.ts
  - apps/web/app/ask/types.ts
  - apps/web/app/ask/highlight.ts
  - apps/web/app/components/panel.tsx
  - apps/web/app/components/sources.tsx
  - apps/web/app/components/icons.tsx
  - apps/web/app/shell/shell.tsx
  - apps/web/app/shell/operator-only.tsx
  - apps/web/app/ui-prefs.ts
  - apps/web/app/app.css
  - apps/web/app/routes/home.tsx
  - apps/web/app/routes/ask.tsx
  - apps/web/app/routes/books.tsx
  - apps/web/app/routes/table.tsx
  - apps/web/app/routes/settings.tsx
  - apps/web/app/library/books.ts
  - apps/web/app/library/upload.ts
verified_against: 667fd6141eaecd0ac7f4797ccc20d8c6a1a5358e
---

# Chat UI

TASK-0028 (specs/024-chat-ui) is the operator-facing library UI: upload a book and watch it
ingest (US1), ask a streamed, cited question (US2), open a citation's source passage (US3),
and the player's much smaller Table-only view (US4). It adds no HTTP route and no dependency
— it is built entirely on the load context ([[client-identity]]'s `jobs()`), the existing
`POST /library/ask` SSE contract ([[rules-answerer]]), and `POST /library/uploads`
([[ingestion]]).

## How it works

**The app-level store** (`store/app-store.ts`'s `createAppStore`, `store/provider.tsx`'s
`AppStoreProvider`) holds the upload, the jobs poll, and every ask turn — state that must
survive navigating away from the page that started it (FR-028). One store per signed-in
user, created in `root.tsx`'s signed-in branch keyed on `user.id` (never a module-level
singleton — SSR would share it across requests and users). `dispose()` aborts the live
stream, the upload, and the poll timer on unmount. `onUnauthorized` (any `401` from ask,
upload, or the jobs poll) is wired to the same `revalidator.revalidate()`
[[client-identity]] describes for sign-out. The jobs poll is a **chained** `setTimeout`
(`POLL_MS` = 1500ms, research R11), never `setInterval`: the next poll is scheduled only
after a response lands and only while `hasActive(jobs)` is true, so a slow response can't
stack overlapping requests. Upload is one-at-a-time (`uploadAbort` guards re-entry, FR-012);
ask is one stream at a time (`askController` guards `ask`/`retry`, plan D10).

**Streaming an answer** (`ask()` → `runAsk`) `fetch`es `POST /library/ask`, branches on
`400`/`401`/`403` before touching the body, then reads `res.body` through
`createSseParser()` (`ask/sse.ts`) — an incremental, dependency-free parser: splits on blank
lines, accepts `\n`/`\r\n`/`\r`, joins multiple `data:` lines with `"\n"`, ignores `:`
comment lines, and keeps a partial message across chunks (`push(chunk)` returns every
message the chunk completes; a trailing partial is never flushed). Each parsed message is
JSON-decoded and folded into the turn by `ask/turns.ts`'s pure `applyEvent` (import-type
only, erasable TypeScript, research R8, no runtime imports) — restating `ask-sse.md`'s
events: `delta` appends to (or starts) the trailing text part; `citation` appends a `cite`
part and records the citation the first time its `n` is seen (a repeat renders as the same
reference, FR-022); `done` sets `state: "done"` with the summary; `refusal` clears
parts/citations and sets `state: "refused"` (SC-004: zero streamed words survive a refusal);
`error` sets `state: "interrupted"`. A stream that ends without any terminal event
(`done`/`refusal`/`error`) is also `"interrupted"`, via `endWithoutTerminal` — a distinct
message ("The connection closed before the answer finished.") from a server-sent `error`.
`stop()` aborts the fetch; the turn becomes `"stopped"` (FR-023), keeping the partial text.

**The slide-out panel** (`components/panel.tsx`'s `Panel`) is the project's only way to open
a Sheet-shaped surface — see [[react-router-app]] for why `Sheet` (Radix Dialog underneath)
satisfies the no-`<dialog>` rule. One `SheetContent side="right"` with `narrow:` classes that
turn it into a bottom sheet (`inset-x-0 bottom-0 top-auto h-[85dvh] w-full rounded-t-xl`) —
a CSS-only breakpoint switch, no `matchMedia`. `components/sources.tsx`'s Sources button and
its panel body (the upload card, derived books, "Open in Library") mount it in
`routes/ask.tsx`'s header; the play route's ledger and DM approvals slide-outs are its other
callers ([[play-route]]).

**Theme tokens and UI cookies.** `app.css`'s Daylight palette is three token blocks —
`:root` (light), `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }`,
and `:root[data-theme="dark"]` — the last two byte-identical (`contrast.test.mjs`, SC-006).
`ui-prefs.ts`'s `readUiPrefs(cookieHeader)` is pure and import-free: `stacks-sidebar`
(`"expanded"`/`"collapsed"`) and `stacks-theme` (`"system"`/`"light"`/`"dark"`), unknown or
missing falling back to `"expanded"`/`"system"`. `root.tsx`'s loader calls it server-side so
the first byte of HTML already carries `data-theme` ([[client-identity]]); `routes/settings.tsx`
writes it client-side with `uiCookie()` (one year, `Path=/`, `SameSite=Lax`, not `HttpOnly` —
display preference only, no `localStorage`/`sessionStorage` per the standing rule) and
revalidates. `shell/shell.tsx` reads/writes `stacks-sidebar` the same way for the
collapse toggle.

**The route tree and role gate.** `routes.ts` adds four routes around the original two
(`/`, `/play/:sessionId`): `ask`, `books` (the Library page — `/library` is reserved for
the HTTP API, plan D3 checkpoint), `play` (the Table landing, `routes/table.tsx`: start a
fresh table or join one by pasting its id/link; an operator also sees a "Preview fixtures"
link to `/play/fixtures`, see [[play-route]]), and `settings`. `home.tsx` is now
loader-only, redirecting a signed-in operator to `/ask` and a signed-in player to `/play`.
`ask.tsx` and `books.tsx` share one loader shape: `{ forbidden: true }` for a non-operator
without calling `jobs()` at all (so a player's SSR never even asks for job data), else
`{ jobs: await jobs() }`; the forbidden case renders `shell/operator-only.tsx`'s
`OperatorOnly` with one of FR-037's two fixed messages (FR-038).

TASK-0043 adds an always-visible About link to the shell nav (`shell/shell.tsx`, a `NavLink` to
`/about` with the new inline `InfoIcon`) for every signed-in role; the `/about` route itself is
described in [[react-router-app]] and [[srd-data]].

## Connections

Reads [[client-identity]]'s `jobs()` load-context method and the `onUnauthorized`/
revalidation path it documents. Streams from [[rules-answerer]]'s `POST /library/ask` SSE
contract and uploads to [[ingestion]]'s `POST /library/uploads`/`GET /library/jobs`. Its
route tree and app-shell wrapping are described from the framework side in
[[react-router-app]]; `Sheet`'s no-modals justification lives there too. `library/books.ts`'s
`deriveBooks`/`stageIndex`/`pill` turn a `LibraryJob[]` into the per-book pills and 4-stage
stepper both `routes/books.tsx` and `components/sources.tsx` render from one source.
`ask/highlight.ts`'s `splitPassage` (used by `routes/ask.tsx`'s source pane) locates a
citation's exact quote inside its passage text for the `<mark>` highlight (SC-003).

## Operational notes

No dependency was added (plan checkpoint 1): `Sheet` reuses the already-installed
`radix-ui`; icons are inline SVG (`components/icons.tsx`, including the play route's `LedgerIcon` and
`ApprovalsIcon`), not `lucide-react` (plan checkpoint 4). `test/no-dialog.test.mjs` and `test/contrast.test.mjs` enforce D7's and D6's
gates in CI, not just at review time. AC #4's evidence is a committed recording
(`specs/024-chat-ui/evidence/record-ac4.mjs`, out-of-tree `playwright-core`, never added to
any `package.json`) driving both accounts through the two-browser run and logging every
`/library` request the player's page makes — expected 0 (SC-008).
