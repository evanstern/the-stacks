# Feature Specification: Chat UI — streaming answers and clickable citations

**Feature Branch**: `task-0028-chat-ui`

**Created**: 2026-09-29

**Status**: Draft

**Input**: Card TASK-0028, "Chat UI: streaming answers and clickable citations". The M1 demo
surface. Card ACs: (1) the operator uploads a book and sees ingestion status; (2) answers
stream into the chat as they generate; (3) clicking a citation opens the source passage with
the quoted span highlighted; (4) the M1 demo runs in two browsers from the per-worktree stack.

**Direction (settled, not re-litigated here)**: the operator-accepted decision record
[`docs/design/chat-ui/decision.md`](../../docs/design/chat-ui/decision.md) (Direction A
"Reference desk", Daylight palette, round-3 option P slide-out panel, the no-modals rule, the
ownership table). Layout and copy come from
[`round-2/a2-daylight.html`](../../docs/design/chat-ui/round-2/a2-daylight.html) and
[`round-3/p-sources-panel.html`](../../docs/design/chat-ui/round-3/p-sources-panel.html).
The AC #4 ruling (operator and player at one Table, operator uses Ask and Library alongside,
player sees only the Table) is recorded on the card, 2026-09-29.

**Contracts consumed, unchanged**: [`specs/018-rules-answerer/contracts/ask-sse.md`](../018-rules-answerer/contracts/ask-sse.md)
and [`specs/017-ingestion-pipeline/contracts/http-ingest.md`](../017-ingestion-pipeline/contracts/http-ingest.md).
This feature adds **no server route** and changes no contract.

**Clarify**: skipped. The decision record's four open questions are answered from existing
artifacts under "Resolved open questions" below. No question remained whose answer those
artifacts do not already give.

**Scope note (operator hold, 2026-09-29)**: a frontend refactor that changes the base of the
web client takes precedence. This spec states behaviour only. Plan, research, quickstart,
and tasks are written after that refactor lands, against the new base.

## Scope

In scope (the decision record's ownership table, rows marked TASK-0028):

- The app shell: a role-aware sidebar, collapse remembered per browser, a mobile tab bar.
- Ask: one conversation, streaming, stop, refusal, error, the dropped-citation notice.
- Citations and the source pane, with the quote highlighted, for every `passage.kind`.
- The reusable slide-out panel component.
- The Sources panel as a library-wide view: book status and Add a book.
- The Library page: dropzone, XHR upload progress, recent imports with stage.
- The player's "available to the operator only" views of Ask and Library.
- The Daylight theme, light and dark, with a Settings page holding only the theme choice.
  The decision record puts Settings in the sidebar and requires `[data-theme]` overrides;
  this page is what sets them.

Out of scope, explicitly:

- **TASK-0038**: the Books table, Delete with its inline confirm, Re-import, and Embed now.
  The routes they need (`GET /library/books`, `DELETE /library/books/:id`, an embed route)
  do not exist and are not added here.
- **TASK-0039**: the session list, AI-generated titles, rename and delete, and per-session
  source checkboxes. `POST /library/ask` has no source filter; TASK-0039 owns that contract
  change.
- **Any new server route**, and any change to the two contracts above.

## User Scenarios & Testing *(mandatory)*

Two people use this surface. The **operator** runs the install, imports the books, and asks
rules questions. A **player** is an invited account; a player sits at the Table and never
sees library content (constitution VIII). An agent drives the same capabilities through the
same documented routes the UI calls (constitution I).

### User Story 1 - Upload a book and watch it ingest (Priority: P1)

The operator opens Library, drops a D&D Beyond export, HTML, or Markdown file, names the book,
and uploads it. A progress bar shows bytes sent. Once the server accepts the file, the book
appears in Recent imports and moves through extract, parse, store, and embed until it is
Ready, Search-only, or Failed. The same status shows in the Sources panel beside Ask, and the
operator can start an upload from there too.

**Why this priority**: Card AC #1. Without a book, nothing else can be demonstrated.

**Independent Test**: On a fresh stack, sign in as the operator, upload a Markdown file, and
watch Recent imports reach a terminal state without reloading the page.

**Acceptance Scenarios**:

1. **Given** an empty library, **When** the operator opens Library, **Then** the page shows
   the dropzone and "Your library is empty. Upload your first book to start asking
   questions."
2. **Given** a chosen file and a book title, **When** the operator uploads, **Then** an upload
   card shows the file name, size, and a progress bar that advances with bytes sent.
3. **Given** an upload in progress, **When** the operator cancels it, **Then** the upload
   stops and no new import appears.
4. **Given** the server accepts the upload, **When** the job runs, **Then** Recent imports
   shows the book with a status pill and the stage stepper, updating within 2 seconds of each
   change, until the job is terminal.
5. **Given** an import already queued or running for the same book, **When** the operator
   uploads again, **Then** the upload card shows "A job for this book is already queued or
   running." and no second import appears.
6. **Given** books in several states, **When** the operator opens the Sources panel from Ask,
   **Then** each book shows one pill: Ready, Ingesting · <stage>, Failed, or Search-only.

---

### User Story 2 - Ask a question and watch the answer stream (Priority: P1)

The operator types a rules question and presses Ask. Answer text appears as it is generated.
Citation markers appear inline, directly after the claim each supports. The operator can stop
the answer. A refusal replaces anything streamed with a calm message. A failure keeps the
partial text, marks it Interrupted, and offers Retry.

**Why this priority**: Card AC #2. This is the M1 demo's centre.

**Independent Test**: With a book on the stack that covers grappling, ask "How does grappling
work?" and watch text arrive progressively, ending with citations and no error.

**Acceptance Scenarios**:

1. **Given** a ready book, **When** the operator asks a question it covers, **Then** answer
   text appears progressively, and a "Stop generating" control is visible until the stream
   ends.
2. **Given** a stream that emits citations, **When** each citation arrives, **Then** a
   citation marker appears at that point in the text.
3. **Given** a stream that ends in `refusal`, **When** the refusal arrives, **Then** every
   streamed word is removed and the refusal's message is shown in its place.
4. **Given** a stream that ends in `error`, **When** the error arrives, **Then** the partial
   text stays, marked "Interrupted", with the error's message and a Retry button.
5. **Given** a `done` event with `dropped > 0`, **When** it arrives, **Then** a quiet notice
   says how many citations could not be verified and were left out.
6. **Given** a streaming answer, **When** the operator presses "Stop generating", **Then** the
   request is aborted, no further text appears, and the partial text stays, marked "Stopped".
7. **Given** an empty question, **When** the operator presses Ask, **Then** "Enter a
   question." shows under the prompt and no request is sent.
8. **Given** the server answers `400 validation`, **When** the response arrives, **Then** the
   server's message shows under the prompt and the conversation is unchanged.
9. **Given** an answer in progress or finished, **When** the operator moves to Library and
   back, **Then** the conversation is still there, and an in-progress stream keeps going.

---

### User Story 3 - Open a citation's source passage (Priority: P1)

The operator clicks a citation marker. The source pane shows the whole passage the quote came
from, labelled with the book and the section breadcrumb, with the quoted words highlighted. On
a phone, clicking a citation switches to the Source view, and "Back to answer" returns.

**Why this priority**: Card AC #3 and constitution V: every claim carries its book, section,
and exact quote, and the operator can click through to the passage.

**Independent Test**: After a cited answer, click `[1]` and check that the highlighted words
equal the citation's quote exactly.

**Acceptance Scenarios**:

1. **Given** no citation opened, **When** the operator views Ask, **Then** the source pane
   says "No citation selected."
2. **Given** a cited answer, **When** the operator clicks a citation, **Then** the source pane
   shows the book, the section breadcrumb, and the passage, with exactly the quoted words in a
   highlight.
3. **Given** a citation of any passage kind (heading, prose, list, table, statBlock, sidebar),
   **When** it is opened, **Then** the passage renders with its line breaks kept.
4. **Given** a 390px-wide screen, **When** the operator clicks a citation, **Then** the view
   switches to Source, and "Back to answer" switches back.
5. **Given** a citation number that repeats, **When** either marker is clicked, **Then** the
   same passage opens.

---

### User Story 4 - Operator and player at one Table, in two browsers (Priority: P2)

The operator and an invited player open the same Table in two browsers on the per-worktree
stack and exchange messages. Alongside, the operator uploads a book and asks a question. The
player's sidebar shows only Table. If the player opens `/ask` or `/books` directly, the page
says the feature is available to the operator only. No library text ever appears on the
Table.

**Why this priority**: Card AC #4, as ruled on 2026-09-29. It proves the whole surface at once
and proves constitution VIII in a browser.

**Independent Test**: Follow the piloted two-browser run script (written with the plan, in
this spec's quickstart), and compare with the committed screen recording.

**Acceptance Scenarios**:

1. **Given** a signed-in player, **When** the shell renders, **Then** the navigation shows
   Table only.
2. **Given** a signed-in operator, **When** the shell renders, **Then** the navigation shows
   Ask, Library, and Table, with Settings, the user, and Sign out at the bottom.
3. **Given** a signed-in player, **When** the player opens `/ask`, **Then** the page shows
   "Asking the library is available to the operator only." and sends no library request.
4. **Given** a signed-in player, **When** the player opens `/books` (the Library page), **Then** the page shows
   "The library is available to the operator only." and sends no library request.
5. **Given** operator and player on the same `/play/<id>`, **When** either sends a message,
   **Then** it appears in both browsers, as in M0.
6. **Given** the operator has asked and opened citations, **When** the player looks at the
   Table, **Then** no book text appears there.

---

### Edge Cases

- The stream closes with no terminal event (network drop): treat it as an error. Keep the
  partial text, marked "Interrupted", with "The connection closed before the answer
  finished." and Retry.
- The session expires mid-use (any `401`): identity flips to signed out and the sign-in form
  shows, as spec 007 already does for the socket.
- A player reaches an operator route and the server answers `403`: show the same
  operator-only view.
- The operator signs out: the conversation and any upload state are discarded, never kept
  for the next person on that browser.
- The UI-state cookie is absent or unreadable (first visit, cleared cookies): the sidebar
  starts expanded, the theme follows the system, and the page still works.
- The upload is refused with `413` or `400`: the upload card shows the server's message.
- The network fails during upload: the card shows "Upload failed. Check your connection and
  try again."
- The operator cancels just as the server accepts the file: a job may exist. The next jobs
  poll shows it (see Resolved open questions, 4).
- No book has ever been imported: Ask shows "Import a book to start asking." with a link to
  Library, and the prompt is disabled.
- A running job's stage is momentarily `null`: the pill reads "Ingesting".
- A book was re-imported: it appears once, under its latest import (see Resolved open questions, 1).

## Requirements *(mandatory)*

### Functional Requirements

**Shell and navigation**

- **FR-001**: The shell MUST show navigation for the signed-in role only: operator → Ask,
  Library, Table, and Settings at the bottom; player → Table. The user's display name, role,
  and Sign out MUST sit at the bottom for both roles.
- **FR-002**: The sidebar MUST collapse to icons. The collapsed state MUST persist per
  browser in a cookie the server reads, so the first render shows it without a flash
  (operator ruling 2026-09-30). The page MUST work when the cookie is absent.
- **FR-003**: At a viewport of 700px wide or less, the navigation MUST become a bottom tab bar.
- **FR-004**: `/` MUST send the operator to Ask and a player to Table.
- **FR-005**: The Table landing MUST let a person start a new table (a fresh id) or open one by
  pasting its link or id. `/play/<id>` MUST keep the M0 event list, input, and behaviour.

**Library and upload (AC #1)**

- **FR-006**: The Library page MUST show the title "Library", the subtitle "Rulebooks you've
  imported. Only you can see them.", a dropzone ("Drop a D&D Beyond export (.zip), HTML or
  Markdown file, or click to browse", "Max 1 GB"), and a Book title field.
- **FR-007**: The dropzone MUST accept a drop or a click-to-browse, through a real file input
  reachable by keyboard.
- **FR-008**: The Book title MUST default to the file name without its extension and MUST be
  editable. An empty title MUST block the upload with "Enter a book title."
- **FR-009**: Upload MUST send `multipart/form-data` to `POST /library/uploads`, with `book`
  before `file`, and MUST show a progress bar driven by bytes sent.
- **FR-010**: The upload card MUST offer Cancel while sending. Cancel MUST abort the request.
- **FR-011**: On `202`, the card MUST clear and the jobs list MUST refresh at once. On `400`,
  `409`, or `413`, the card MUST show the server's `error.message`. On a network failure, it
  MUST show "Upload failed. Check your connection and try again."
- **FR-012**: Only one upload runs at a time. It MUST survive moving between Ask and Library
  and closing the Sources panel.
- **FR-013**: Recent imports MUST list jobs from `GET /library/jobs`, newest first, each with
  the book, a status pill, the stage stepper extract → parse → store → embed, a detail line,
  and when it started.
- **FR-014**: The jobs list MUST refresh every 1.5 seconds while any listed job is queued or
  running, and MUST stop polling when none is.
- **FR-015**: With no jobs, Library MUST show "Your library is empty. Upload your first book to
  start asking questions."

**Sources panel**

- **FR-016**: The Ask header MUST carry a Sources button with a leading book icon, a trailing
  chevron that turns when the panel is open, a border, hover and pressed states, and
  `aria-expanded` and `aria-controls`.
- **FR-017**: The Sources panel MUST list every book derived from the jobs list (Resolved open questions, 1)
  with one pill: Ready, Ingesting · <stage>, Failed, or Search-only. Each book MUST link to
  Library.
- **FR-018**: The panel MUST end with an inline Add a book dropzone running the same upload as
  FR-009–FR-012. The upload's progress card MUST sit at the top of the list.

**Slide-out panel component**

- **FR-019**: The slide-out panel MUST anchor to the right edge on desktop and become a bottom
  sheet on mobile. It MUST NOT be centred and MUST NOT use a backdrop overlay. It MAY dim the
  page behind it.
- **FR-020**: While open, the panel MUST trap focus, MUST close on Escape and on its labelled
  close control, and MUST return focus to its trigger on close. It MUST carry an accessible
  name from its heading.

**Ask (AC #2)**

- **FR-021**: Ask MUST post `{ "question" }` to `POST /library/ask` and read the response with
  a fetch stream reader, never `EventSource`.
- **FR-022**: `delta` text MUST be appended in order. Each `citation` MUST appear as a marker
  at its arrival point, rendered after its quoted words (the citation's `quote`, shown as visible
  text, not a tooltip). A repeated `n` MUST render as the same reference.
- **FR-023**: While streaming, an accent "Stop generating" control MUST abort the request.
  The partial text MUST stay, marked "Stopped", with Retry.
- **FR-024**: On `refusal`, every received delta and citation for that turn MUST be discarded
  and the refusal `message` shown as a calm system message.
- **FR-025**: On `error`, or a stream that ends with no terminal event, the partial text MUST
  stay, marked "Interrupted", with the error message and a Retry button.
- **FR-026**: On `done` with `dropped > 0`, a quiet notice MUST say "N citation(s) could not be
  verified and were left out."
- **FR-027**: An empty question MUST show "Enter a question." without a request. A `400`
  response MUST show its `error.message` and leave the conversation unchanged.
- **FR-028**: The conversation MUST hold multiple turns in client memory. It MUST survive
  moving between Ask and Library, and an in-flight stream MUST continue across that move.
  It MUST be discarded on sign-out and MUST NOT be written to browser storage.
- **FR-029**: Retry MUST re-ask the same question, replacing the failed turn.
- **FR-030**: The prompt bar MUST carry the disclaimer "Answers quote only your library.
  Click a citation to see the source."
- **FR-031**: With no jobs at all, Ask MUST show "Import a book to start asking." with a link
  to Library, and the prompt MUST be disabled.

**Citations and source pane (AC #3)**

- **FR-032**: Each citation marker MUST be a `<button>` whose accessible name includes its
  number, book, and section.
- **FR-033**: Opening a citation MUST render `passage.text` in the source pane, with
  `passage.text.slice(quoteInPassage.start, quoteInPassage.end)` inside a `<mark>`, labelled
  with the book and the section path joined by " › ". No second request is made.
- **FR-034**: Every `passage.kind` MUST render from plain text with line breaks kept. Tables
  MUST render in the monospace stack. No kind is parsed further (Resolved open questions, 2).
- **FR-035**: The source pane MUST be collapsible on desktop and MUST say "No citation
  selected." when nothing is open.
- **FR-036**: At 700px or less, a Chat | Source segmented control MUST switch views. Opening a
  citation MUST switch to Source. "Back to answer" MUST switch to Chat.

**Player views (AC #4)**

- **FR-037**: For a player, `/ask` MUST show "Asking the library is available to the operator
  only." and `/books` (the Library page) MUST show "The library is available to the operator
  only." Neither page may call a `/library` route. The Library page lives at `/books` because
  `/library` is a reserved API path (amended 2026-09-30, plan D3).
- **FR-038**: A `403` from any `/library` route MUST render the same operator-only view.

**Theme and accessibility**

- **FR-039**: Every colour MUST be a CSS custom property on `:root`, redefined under
  `prefers-color-scheme: dark` and under `[data-theme="light"]` / `[data-theme="dark"]`.
  Light accent `#0f6f63`; dark accent `#4fd1c0`. Settings MUST offer System, Light, and Dark;
  the choice sets `data-theme` on `<html>` and persists per browser like FR-002.
- **FR-040**: All text MUST meet WCAG AA contrast (4.5:1 body, 3:1 large text and UI
  boundaries) in both modes.
- **FR-041**: Focus MUST be visible through `:focus-visible` on every interactive element.
  Page regions (navigation, conversation, source pane, panel) MUST be labelled.
- **FR-042**: The UI MUST NOT use `<dialog>`, `showModal`, or a centred overlay. Confirmations
  go inline.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): Every UI action MUST be a plain request to a documented
  route: `POST /library/uploads`, `GET /library/jobs`, `POST /library/ask`, and the M0 auth
  and WebSocket routes. The UI MUST hold no capability an agent cannot reach through those
  routes.
- **CR-002** (III. Data planes): The web client MUST NOT import server code. Contract types are
  restated in the client, citing their contract files.
- **CR-003** (V. Citations): Every citation shown MUST carry its book, section, and exact
  quote, and MUST open its passage. A refused answer MUST NOT be shown as an answer.
- **CR-004** (VIII. Operator-owned content): Book text MUST reach only the operator, only as
  citations and passages. The Table MUST NOT show library content. The client MUST NOT write
  book text to browser storage.
- **CR-005** (IX. Self-hostable): No CDN, no webfonts, no remote asset. Fonts use the
  `system-ui` stack; icons are inline SVG.

### Key Entities

- **Turn**: one question and its answer state: streaming, done, refused, interrupted, or
  stopped. It holds the ordered text and citation parts and the `done` summary.
- **Citation**: the `citation` event as the contract defines it.
- **Book (derived)**: one entry per book name, from its latest job (Resolved open questions, 1): name, pill,
  detail.
- **Upload**: the one in-flight upload: file, title, bytes sent, total, error.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the per-worktree stack, the operator uploads a book and sees it reach a
  terminal pill without a page reload.
- **SC-002**: The first answer text appears before the stream ends; text is visibly
  progressive, not delivered in one block.
- **SC-003**: For every citation opened, the highlighted text equals the citation's `quote`
  exactly (100% in tests).
- **SC-004**: A refused turn shows zero streamed words (100% in tests).
- **SC-005**: The AC #4 run completes in two browsers, and a recording of it is committed.
- **SC-006**: Every theme text pair passes WCAG AA in light and dark (checked by test).
- **SC-007**: Zero `<dialog>` or `showModal` uses in the web client source (checked by test).
- **SC-008**: A player's browser issues zero requests to `/library` routes during the AC #4
  run.

## Assumptions

- Single tenant, one operator: "the operator" is any operator account on the install.
- The stack has an `answering` purpose configured (inherited from the root `.env`, spec 022)
  for the live demo. Without one, Ask shows the `config` error as Interrupted, which is the
  correct behaviour.
- One conversation per browser tab, lost on reload. Persisted sessions are TASK-0039.
- Book status comes from `GET /library/jobs` until TASK-0038 adds `GET /library/books`.
- The mockups' SRD and original copy are the source for all visible strings not fixed by a
  contract.

## Resolved open questions

The decision record's §"Open questions implementation must resolve", answered from the
contracts and the server code on main.

1. **Book identity before TASK-0038.** Group `GET /library/jobs` rows by the trimmed,
   lower-cased `book`, the same key as the server's one-active-job-per-book index. The newest
   job per group decides the pill:
   - `queued` → Ingesting · queued;
   - `running` → Ingesting · `<stage>`, or Ingesting when `stage` is null;
   - `succeeded` with `result.embedding.status = "embedded"` → Ready;
   - `succeeded` with `result.embedding.status = "skipped"` → Search-only;
   - `failed` → Failed, with the job's `error`.

   This is enough for the Sources panel: its only per-book action in this task, "Open in
   Library", needs no id. Known ceilings, both removed by TASK-0038's `GET /library/books`:
   a book whose last job is older than the newest 100 jobs drops out of the list, and a
   failed re-import shows Failed while the earlier successful import still answers questions.
2. **Passage kinds.** Every kind renders from `passage.text` as plain text with its line
   breaks kept. Tables use the monospace stack, because the parser writes rows as
   `cell | cell` lines. A stat block is not parsed into fields: the contract carries no
   structure beyond the text, and plain text keeps `quoteInPassage` offsets valid unchanged.
   The pane labels the kind (for example "Stat block").
3. **Where the conversation lives.** In app-level client memory that outlives any one page,
   not in page or router state. The stream's reader and its abort handle live at the same
   level, not inside a page. The frontend refactor's base decides the exact mechanism. So a stream keeps running while the operator is on
   Library (FR-028). Sign-out clears it (edge cases). Nothing is written to browser storage
   (CR-004).
4. **Upload cancel.** Aborting the request creates no job. `http-ingest.md` guarantee 2 says
   so ("on client disconnect, the partial file is deleted and no job row exists"), and
   `apps/server/test/library/uploads.integration.test.ts` asserts it. One race remains: a
   cancel after the server enqueued but before the `202` arrived. The UI refreshes the jobs
   list after every cancel, so that job appears in Recent imports.
