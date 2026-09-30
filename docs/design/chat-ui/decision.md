# Decision: chat UI and Library layout (TASK-0028 design rounds)

- **Status:** accepted by the operator, 2026-09-29
- **Task:** TASK-0028 (Chat UI: streaming answers and clickable citations)
- **Follow-up cards:** TASK-0038 (library management), TASK-0039 (chat sessions)
- **Stack:** doc-0003 / decision-0008 (React Router 8 SSR, Tailwind v4, shadcn/ui), landed by TASK-0040 before this task's build. Amended 2026-09-29; the visual direction is unchanged.
- **Rounds:** [round 1](round-1/index.html), [round 2](round-2/index.html), [round 3](round-3/index.html)

## Chosen

**Direction A, "Reference desk", developed in round 2 and styled with the Daylight palette, using the round-3 option P slide-out panel for sources.**

- Layout and states: [round-2/a2-daylight.html](round-2/a2-daylight.html).
- Sources control: [round-3/p-sources-panel.html](round-3/p-sources-panel.html).

### App shell

- A left sidebar that collapses to icons. The collapsed state is remembered per browser in a cookie (see open question 5).
- The sidebar shows only what the signed-in role can reach:
  - operator: **Ask**, **Library**, **Table**, plus Settings and the user at the bottom;
  - player: **Table** only.
- On mobile (390px) the sidebar becomes a bottom tab bar.

### Ask

- **Session list column.** This ships in TASK-0039. TASK-0028 leaves room for it and ships a single conversation.
- **Conversation.** A **Sources** button sits in its header. A prompt bar sits at the bottom, with the disclaimer "Answers quote only your library. Click a citation to see the source."
- **Source pane.** It is pinned on the right and collapsible. A clicked citation renders `passage.text` there, labelled with the book and a section breadcrumb, with `passage.text.slice(quoteInPassage.start, quoteInPassage.end)` in a `<mark>`. When nothing is open, the pane shows "No citation selected."
- **Mobile.** A Chat | Source segmented control switches between the two. Clicking a citation switches to Source, and "Back to answer" returns to the chat.
- **Streaming.** Text streams in, and an accent "Stop generating" pill aborts the fetch.
- **Refusal.** The streamed deltas are discarded and replaced by a calm system message.
- **Error.** The partial text is kept and marked "Interrupted", with the error message and a Retry button.
- **Dropped citations.** When `done.dropped > 0`, a quiet notice is shown.

### Sources panel (option P)

- The Sources button in the Ask header opens a panel that slides in from the right edge. On desktop it covers the source pane; on mobile it is a bottom sheet with a drag handle.
- The panel lists every book with a status pill: Ready, Ingesting · <stage>, Failed, or Search-only. Each book has an overflow menu with "Open in Library", and "Embed now" on Search-only books.
- An inline **Add a book** dropzone at the bottom runs the same upload as the Library page. Its progress card appears at the top of the list.

### Library

- Title "Library", with the subtitle "Rulebooks you've imported. Only you can see them."
- A large dropzone: "Drop a D&D Beyond export (.zip), HTML or Markdown file, or click to browse", with "Max 1 GB". A Book title field sits with it.
- An upload card with an XHR progress bar and a cancel control.
- **Recent imports** from `GET /library/jobs`, showing a status pill and the stage stepper extract → parse → store → embed.
- A **Books** table. This ships in TASK-0038.

### Table

- The M0 shared play session (`/play/:id`) keeps its event list and input.
- Library content never appears on it (constitution VIII).

## Modifications the operator asked for on top of the chosen options

1. **Palette: Daylight in both modes.**
   - Light mode accent: teal `#0f6f63`. Dark mode accent: `#4fd1c0`.
   - Every colour is a CSS custom property on `:root`, redefined for `prefers-color-scheme: dark` and for the `[data-theme]` overrides.
   - All text meets WCAG AA contrast.
2. **The Sources button must look openable.**
   - The round-3 button reads as a status label.
   - Add a leading icon (a book/stack glyph) and a trailing affordance: a chevron or panel-open glyph that turns when the panel is open.
   - Give it button styling, with a border and hover and pressed states.
   - Set `aria-expanded` and `aria-controls` on it.
3. **The slide-out panel becomes a reusable component.**
   - It is the project's standard for anything that would otherwise be a modal or a dropdown menu. TASK-0028 builds it once and uses it for Sources. TASK-0038 and TASK-0039 reuse it.
   - Build it on shadcn/ui `Sheet` (doc-0003 ruling 3): `side="right"` on desktop, `side="bottom"` on mobile. Wrap it once as the project's panel component so every caller gets the same behaviour.
   - The component:
     - anchors to an edge (right on desktop, bottom sheet on mobile);
     - has a labelled region, a close control, and closes on Escape;
     - traps focus while open and returns focus to its trigger when closed;
     - may dim the page behind it;
     - is never centred with a backdrop.

## Standing UI rule: no modals

Never use `<dialog>`, `showModal`, or a centred overlay with a backdrop. They work badly on mobile, and designing UX around them is painful. Use instead:
- the slide-out panel component;
- inline expansion;
- an autocomplete dropdown (shadcn/ui `Command` or `Combobox`).

The shadcn/ui `Dialog` and `AlertDialog` components are never added (doc-0003 ruling 3; TASK-0040 AC #5).

Confirmations go inline. For example, deleting a book expands a confirm row beneath that book's row.

## Rejected, and why

- **B, Marginalia** (round 1): citations unfold inline, and Ask and Library are tabs. Long passages push the conversation apart, and it has no side-by-side reading.
- **C, Console** (round 1): a dense jobs strip and a log-style chat. It reads as a tool, not a reading surface, and its citations open in a modal.
- **Nightshift** (round 2): a violet palette, dark-first. The operator preferred Daylight in both modes.
- **D, Sources dropdown** (round 3): removable chips plus an `@` autocomplete. It was rejected in favour of the panel, which is roomier and consistent with the reusable panel pattern.
- **Round 1's styling for A**: too dull. The round-1 scoping of A was also too thin; round 2 replaced both.
- **Delete confirmation in a `<dialog>`** (round 2): replaced by the inline confirm row under the no-modal rule.

## Ownership: which card ships what

| Element | Card |
|---|---|
| App shell, role-aware sidebar, remembered collapse, mobile tab bar | TASK-0028 |
| Ask: conversation, streaming, stop, refusal, error, dropped notice | TASK-0028 |
| Citations and the source pane with the highlighted quote (prose and every `passage.kind`) | TASK-0028 |
| Slide-out panel component | TASK-0028 |
| Sources panel as a library-wide view: book status and Add a book | TASK-0028 |
| Library page: dropzone, XHR upload progress, recent imports with stage | TASK-0028 |
| Player views of Ask and Library ("available to the operator only") | TASK-0028 |
| Books table; Delete with its inline confirm; Re-import; Embed now | TASK-0038 |
| Session list; AI-generated titles; rename and delete; per-session source checkboxes | TASK-0039 |

TASK-0028 has no book-list route. So its Sources panel derives book status from `GET /library/jobs` (the latest job per book). TASK-0038 swaps that source for `GET /library/books`. The checkboxes do not ship in TASK-0028, because `POST /library/ask` has no source filter.

## Contract needs recorded for the follow-up cards

These routes do not ship in TASK-0028. The contracts on main (`ask-sse`, `http-ingest`) are unchanged.

- **TASK-0038:**
  - `GET /library/books`: operator-only. Each book has its name, pages, chunks, embedding model or null, and ingest date.
  - `DELETE /library/books/:id`: operator-only. Library rows are immutable, and the delete cascades through the foreign keys.
  - An operator-only **embed** route for "Embed now". A book without embeddings stays keyword-searchable, because hybrid retrieval already runs full-text search over every chunk (`apps/server/src/library/retrieve.ts`). Embedding is offered whenever a model is available and is never forced.
- **TASK-0039:**
  - Operator-only session routes: list, create, rename, delete, and persisted turns with their citations.
  - An AI-generated title from the first question.
  - A source filter on ask. This changes the `ask-sse` contract, and TASK-0039 owns that change.

## Constraints the implementation is checked against

- **Constitution VIII.** Ask, Library, and every book view are operator-only; players get 403. Book text reaches the operator only as citations and passages, and never appears on the Table.
- **Constitution V.** Every claim carries its book, section, and exact quote, and the operator clicks through to the passage.
- **Constitution I.** Every UI action is a plain fetch to a documented route:
  - `POST /library/ask` is read with a fetch stream reader;
  - `POST /library/uploads` uses XHR, for progress only;
  - `GET /library/jobs` is polled every 1–2 seconds while a job is queued or running.
- **Constitution IX.** The app stays self-hostable: no CDN, no webfonts, the `system-ui` font stack, and locally bundled SVG icons.
- **Stack.** doc-0003: React Router 8 framework mode with SSR by default; Tailwind v4; shadcn/ui copied into `apps/web`. Express the Daylight palette as Tailwind v4 theme tokens (CSS custom properties) with light and dark values. Loaders reach server data through the load context in `packages/shared`, never the app's own HTTP API and never `apps/server` imports.
- **Rendering split.**
  - SSR the Library page and the shell: books and jobs load in the loader, so first paint shows real status.
  - Render Ask's streaming conversation client-side. The SSE read, the stop control and the source pane run after hydration.
  - Keep the Table client-only (`clientLoader` + `HydrateFallback`), as TASK-0040 ports it.
  - Upload progress (XHR) and job polling run client-side after hydration.
  - Role-aware sidebar: the root loader resolves the session and role on the server, so a player never receives operator nav in the HTML.
- **Accessibility.**
  - Citations are real `<button>`s.
  - Regions are labelled.
  - Focus is visible (`:focus-visible`).
  - The panel manages focus.
  - Text meets WCAG AA contrast in both modes.
- **No modals** (see above).

## AC #4: two browsers

- The operator and a player join the same **Table** (M0 WebSocket session) in two browsers on the per-worktree stack. The operator uses Ask and Library alongside.
- The player's sidebar shows the Table only.
- The operator's proof must be visually inspectable. Provide both:
  - a piloted run script the operator can follow;
  - a screen recording committed with the PR evidence.

## Open questions implementation must resolve

1. **Book identity before TASK-0038.** Jobs carry `book` (the title) and `result.documentId`, so group by title and take the latest job per book. Confirm in the plan that this is enough for the Sources panel.
2. **Passage kinds.** Render each `passage.kind` (heading, prose, list, table, statBlock, sidebar) from plain `passage.text`. The contract carries no structure beyond the text. Decide in the plan how far a stat block or table is formatted.
3. **Where the conversation lives.** A single conversation sits in client state for TASK-0028. It must survive moving between Ask and Library. With TanStack Query likely gone (doc-0003 ruling 6), keep it in a layout-level store above both routes. Decide in the plan.
5. **Remembered UI state under SSR — resolved 2026-09-30.** Per-browser UI state (sidebar collapse, theme) lives in cookies that the root loader reads, so the server renders it without a flash. Never use `localStorage` for it.
6. **Posting to the ask stream — resolved 2026-09-30.** A React Router action cannot stream SSE back to a fetch reader. The client posts to `/library/ask` directly; `/library` is a reserved path that never reaches the React Router handler (TASK-0040 AC #3). The loaders' load context still serves jobs and status reads.
4. **Upload cancel.** Aborting the XHR cancels the upload. Confirm that no job row is created when the request never completes.
