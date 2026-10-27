# Feature Specification: Debug view card B — the `play/:sessionId/debug` page

**Feature Branch**: `task-0117-debug-page`

**Created**: 2026-10-27

**Status**: Draft

**Input**: Board card TASK-0117 (M3 sweep, track B4, HIGH). Design agreed with the operator on
2026-10-26: [docs/design/debug-view.md](../../docs/design/debug-view.md), decisions D1, D2,
D5–D8 and "The page". The page consumes TASK-0116's operator debug API (branch
`task-0116-debug-api`, PR #62): `specs/037-debug-api/contracts/debug-api.md`. This PR is held as
a draft until TASK-0116 merges.

**Rulings in force (not reopened)**: operator only (D1). Show everything, no masking, spoilers
accepted (D2). HTTP polling of the debug API (D3). A pinned "why waiting?" strip over three
linked columns; tabs stay in reserve (D5). Live by default, plus a seq scrub on the state column
(D6). All four MVP panel groups (D7). Read only, plus one retry control (D8). The `/play` table
shows an unseated operator the player view (TASK-0118, merged); this page is where DM-only data
lives.

**Clarify**: skipped. The design record settles scope, layout and actions. Its four open
questions are answered under "Open questions resolved" below. The remaining choices are
technical and live in [plan.md](plan.md).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Why is the table waiting? (Priority: P1)

The operator plays at `/play/:sessionId` and opens the debug page beside it. A pinned strip
answers at a glance whether the table is frozen or waiting on something, and on what.

**Why this priority**: in the M2 demo a companion's uncommitted action looked like a frozen
table. This question came up first and most often.

**Independent Test**: open the page on a session with a queued turn job, a declared but
uncommitted action, a pending proposal and a held turn. The strip names each one. Then fail a
turn: the strip shows the failure and the retry control.

**Acceptance Scenarios**:

1. **Given** a turn job is queued or running, **When** the page polls, **Then** the strip shows
   its kind, stage, attempts and heartbeat age, and the age counts up between polls.
2. **Given** an action is declared or discussed but not committed, **When** the page shows the
   strip, **Then** the strip lists the action with its actor's display name.
3. **Given** the table is in turn mode, **When** the strip renders, **Then** it shows the mode
   and whose turn it is. In free mode it shows "free".
4. **Given** a pending proposal, **When** the strip renders, **Then** it lists the proposal's
   kind and policy.
5. **Given** a turn the Director held, with its companion job, **When** the strip renders,
   **Then** it shows the hold and the companion job's status.
6. **Given** the newest failed turn finished after the last shipped narration, **When** the
   strip renders, **Then** it shows the failure node and kind, and the retry control.
7. **Given** the operator presses retry, **When** the request returns, **Then** the page shows
   the queued job id and polls at once. A refusal shows inline.

---

### User Story 2 - What did each DM job do? (Priority: P1)

The operator reads one card per DM job and expands a turn to see each pipeline node's output,
every gate submission, every audit attempt, the failure record and the cost of every model call.

**Why this priority**: narration fallbacks and gate refusals were diagnosed by SQL in the M2
demo. The checkpoint and call usage now come over the debug API.

**Independent Test**: run one turn on the fake gateway. Its card shows kind, trigger, status,
duration, attempts, call count, tokens, cost and an outcome badge. Expanding it shows the seven
pipeline sections in node order.

**Acceptance Scenarios**:

1. **Given** jobs exist, **When** the page loads, **Then** the timeline shows one card per job,
   newest at the bottom, and appends new jobs as polls return them.
2. **Given** a collapsed card, **When** it renders, **Then** it shows kind, trigger, status,
   duration, attempts, call count, total tokens, total cost and one outcome badge: shipped,
   fallback, failed, held, empty, queued or running.
3. **Given** an expanded turn card, **When** it renders, **Then** it shows, in order: assemble,
   director, interpret, adjudicate, resolve, narrate and audit, failure. A node with no output
   shows "not run".
4. **Given** the resolve section, **When** it renders, **Then** each submission shows step ref,
   kind, result or refusal code, and its seqs as links into the event log.
5. **Given** the narrate and audit section, **When** it renders, **Then** each attempt shows its
   word count, its blocking and advisory issues in two separate lists, and its prose hash. The
   section shows whether the fallback shipped.
6. **Given** a failed turn, **When** it is expanded, **Then** the failure section shows node,
   kind, message and the bounded attempt excerpts.
7. **Given** any node row, **When** it renders, **Then** it lists that node's model calls with
   purpose, prompt version, attempt, outcome, model, tokens, cost and duration. A call stored
   before TASK-0116 shows "usage not recorded".
8. **Given** a companion or chronicle job, **When** it is expanded, **Then** it shows its plays
   or entries, their submissions with linked seqs, and its calls.

---

### User Story 3 - Every event, linked to the job that wrote it (Priority: P1)

The operator reads every event of every visibility, filters the log, and follows links between
jobs and the events they wrote.

**Why this priority**: the cross-link is the point of the view (D5).

**Independent Test**: after one turn, select the turn's card. Its submission and narration rows
highlight in the log. Select a highlighted row: the turn's card highlights.

**Acceptance Scenarios**:

1. **Given** a session, **When** the page loads, **Then** the log holds every event in seq
   order, with seq, time, actor display name, type, visibility and collapsed payload.
2. **Given** the page is live, **When** a poll returns new events, **Then** they append, and the
   log advances by the API's seq cursor without refetching older rows.
3. **Given** the type filter, **When** the operator types, **Then** an autocomplete dropdown
   offers the event types present in the log, and the log narrows to the chosen types.
4. **Given** the actor and visibility filters, **When** the operator chooses values, **Then**
   the log narrows to matching rows. Filters combine with AND.
5. **Given** a selected job, **When** the log renders, **Then** every row the job wrote is
   highlighted, and a note says when part of the link is unknown.
6. **Given** a selected event, **When** the timeline renders, **Then** the job that wrote it is
   highlighted and scrolled into view. An event no job wrote highlights nothing.

---

### User Story 4 - The state at any seq (Priority: P2)

The operator reads the DM-side state live, or pins it to any event to see the state as of that
seq.

**Why this priority**: knowing what the table looked like just before a turn ran explains its
input. It costs no server work (D6).

**Independent Test**: click an event in the middle of the log. The state column shows a "pinned
at seq N" badge and the state as of seq N. Press "back to live": the badge clears and the column
follows the head again.

**Acceptance Scenarios**:

1. **Given** live mode, **When** a poll returns events, **Then** the state column shows the DM
   view of the whole log: party and characters, combatants, trackers, table mode, encounter, DM
   seat and gate policy, pending proposals.
2. **Given** the operator clicks an event, **When** the column renders, **Then** it shows the
   state through that seq only, with a "pinned at seq N" badge.
3. **Given** a pinned column, **When** new events arrive, **Then** the column stays pinned, and
   the log keeps appending.
4. **Given** a pinned column, **When** the operator presses "back to live", **Then** the column
   unpins and shows the head state.

---

### User Story 5 - Seed, ledger, journal and cost (Priority: P2)

The operator opens slide-out panels for the scene seed, the dice ledger, the journal and the
session's cost totals.

**Why this priority**: each answered a real question in the M2 demo (D7), but none is needed to
read a single turn.

**Independent Test**: open each panel from the state column header. Each slides out from the
right and closes with Escape or its close control. The page shows no modal.

**Acceptance Scenarios**:

1. **Given** the Seed panel, **When** it opens, **Then** it shows the full seed and marks every
   DM-only field as DM only.
2. **Given** a session with no scene, **When** the Seed panel opens, **Then** it says the session
   has no scene. A seed that fails to load shows that message instead.
3. **Given** the Ledger panel, **When** it opens, **Then** it lists the dice ledger in the same
   format as the table's ledger, through the pinned seq when pinned.
4. **Given** the Journal panel, **When** it opens, **Then** it lists every journal entry, and
   marks `dm`-visibility entries, including the fallback flags.
5. **Given** the Cost panel, **When** it opens, **Then** it shows session totals overall, by
   purpose and by model, with the count of unpriced calls.

---

### User Story 6 - The operator reaches the page, nobody else does (Priority: P1)

An operator at `/play/:sessionId` sees a Debug link. Anyone else sees no link, and gets the
operator-only message at the debug URL.

**Why this priority**: the page shows spoilers and system internals (D1, D2).

**Independent Test**: sign in as a player and open the debug URL: the operator-only message
renders and no debug request is made. Sign in as the operator: the link shows on the table.

**Acceptance Scenarios**:

1. **Given** an operator on `/play/:sessionId`, **When** the header renders, **Then** it shows a
   Debug link to `/play/:sessionId/debug` that opens in a new tab.
2. **Given** a non-operator, **When** the header renders, **Then** it shows no Debug link.
3. **Given** a non-operator opens the debug URL, **When** it renders, **Then** it shows the
   operator-only message and calls no debug route.
4. **Given** the operator's session expires, **When** a poll returns 401 or 403, **Then** the
   page stops polling and says so.

### Edge Cases

- **Empty session.** A valid UUID with no events and no jobs shows an empty log, an empty
  timeline and a strip reading "nothing queued". The Seed panel says "no scene".
- **Long log.** The first load pages the whole log by cursor. The log renders the newest 500
  matching rows and offers "show 500 older".
- **Jobs stored before TASK-0116.** Calls lack usage fields and submissions lack `seqs`. The page
  shows "usage not recorded" and "link not recorded", and never throws.
- **Unknown links.** A submission recovered after a reclaim has `seqs: []` on a non-refused
  result. A checkpoint with no `narration.seqs`. Both show "link unknown", not "wrote nothing".
- **Jobs change in place.** A running job is replaced by id on every poll. Older terminal jobs
  are paged once with "load older jobs".
- **A held turn.** The badge reads held. The strip pairs it with the companion job whose
  `beatJobId` names it.
- **Unpriced calls.** Cost shows "unpriced" for a null cost. Totals count unpriced calls apart
  and never print them as zero.
- **Poll failure.** A network or 5xx failure keeps the last data, shows a "poll failed, retrying"
  notice and retries on the next tick. A 401 or 403 stops polling.
- **Hidden tab.** Polling pauses while the tab is hidden and polls at once when it shows again.
- **Narrow window.** Below 1024 px the three columns stack, strip first. No horizontal scroll.
- **Unknown event types.** The log lists them. The fold tolerates them, as `project` does.

## Requirements *(mandatory)*

### Functional Requirements

**Access and entry**

- **FR-001**: The app MUST add the route `play/:sessionId/debug`, client-only like
  `play/:sessionId`.
- **FR-002**: The route MUST render the shared `OperatorOnly` view for any user whose role is not
  `operator`, and MUST make no debug request for that user.
- **FR-003**: The `/play/:sessionId` header MUST show a Debug link to operators only. The link
  MUST open the debug page in a new tab. The fixture routes show no Debug link.

**Polling**

- **FR-004**: The page MUST poll the debug events, jobs and calls routes on one shared tick.
- **FR-005**: The tick MUST be 2 s while the session is active and 10 s while it is idle. Active
  means a job is queued or running, or a new seq arrived in the last 30 s, or a retry was sent in
  the last 30 s. Idle means none of these.
- **FR-006**: The page MUST poll at once after a retry, and when a hidden tab becomes visible.
  It MUST not poll while the tab is hidden.
- **FR-007**: The first load MUST follow the events cursor (`nextAfter` while `hasMore`) until
  the whole log is held. Each later poll MUST request only `after = last nextAfter`.
- **FR-008**: The jobs poll MUST fetch the newest page and replace each job by id. "Load older
  jobs" MUST page with `before` once per page.
- **FR-009**: The calls poll MUST follow its own cursor and keep the returned session totals.
- **FR-010**: The seed MUST be fetched on load and again when the scene's seed id changes.
- **FR-011**: One poll MUST be in flight at a time. A slow poll delays the next tick; it never
  overlaps it.

**"Why waiting?" strip**

- **FR-012**: The strip MUST stay pinned at the top while the columns scroll.
- **FR-013**: The strip MUST show queued and running jobs with kind, stage, attempts and
  heartbeat age. The age MUST update every second.
- **FR-014**: The strip MUST show uncommitted actions (declared or discussed) with actor name.
- **FR-015**: The strip MUST show the table mode and, in turn mode, whose turn it is.
- **FR-016**: The strip MUST show pending proposals with kind and policy.
- **FR-017**: The strip MUST show each held turn with its companion job's status.
- **FR-018**: The strip MUST show the newest failed turn when it finished after the last
  narration event, with node, kind and message.

**Retry**

- **FR-019**: The retry control MUST call `POST /dm/sessions/:sessionId/turn`.
- **FR-020**: The control MUST show only when the table is failed or stuck. Failed is FR-018's
  condition. Stuck means the newest `action.committed` is later than the newest narration, no
  turn or companion job is queued or running, and the commit is at least 15 s old.
- **FR-021**: The control MUST disable while its request is in flight, then show the returned job
  id or the refusal inline.

**Job timeline**

- **FR-022**: The timeline MUST show one card per DM job, oldest at the top, newest at the
  bottom. It MUST follow the bottom while the operator has not scrolled up.
- **FR-023**: A collapsed card MUST show kind, trigger, status, duration, attempts, call count,
  total tokens, total cost and one outcome badge.
- **FR-024**: A card's call count, tokens and cost MUST come from the usage ledger rows for that
  job, abandoned attempts included.
- **FR-025**: An expanded turn card MUST show seven sections in node order: assemble, director,
  interpret, adjudicate, resolve, narrate and audit, failure.
- **FR-026**: The assemble section MUST link each frozen action id to the seq that declared it.
- **FR-027**: The director section MUST show the decision, `goalNote`, scene, tracker and mode
  changes, and any hold.
- **FR-028**: The resolve section MUST show every submission's step ref, kind, result or refusal
  code, and its seqs as links.
- **FR-029**: The narrate and audit section MUST split each attempt's issues into blocking and
  advisory lists, and MUST show word count, prose hash and the fallback flag.
- **FR-030**: The failure section MUST show node, kind, message and the stored attempt excerpts.
- **FR-031**: Each section MUST list its model calls with purpose, prompt version, attempt,
  outcome, model, tokens, cost and duration. A call without usage MUST read "usage not
  recorded".
- **FR-032**: Companion and chronicle cards MUST show their plays or entries, submissions with
  linked seqs, and calls.

**Event log**

- **FR-033**: The log MUST show every event with seq, time, actor display name, type, visibility
  and a collapsed payload that expands to formatted JSON.
- **FR-034**: The type filter MUST be an autocomplete dropdown over the types in the log. Actor
  and visibility filters MUST offer the values in the log. Filters MUST combine with AND.
- **FR-035**: The log MUST render the newest 500 matching rows and offer "show 500 older".

**Cross-links**

- **FR-036**: Selecting a job MUST highlight every event whose seq is in any `seqs` list of the
  job's result.
- **FR-037**: Selecting an event MUST highlight the job that wrote it and scroll it into view.
- **FR-038**: A link MUST read "link unknown" when the job's result cannot name the rows: an
  empty `seqs` on a non-refused submission, a missing `narration.seqs`, or a missing `seqs`.

**State column and scrub**

- **FR-039**: The state column MUST fold the held events with the DM viewer, client-side, through
  the pinned seq or through the head when live.
- **FR-040**: The column MUST show party and characters, combatants, trackers, table mode,
  encounter, DM seat and gate policy overrides, and pending proposals.
- **FR-041**: Clicking an event row MUST pin the column to that seq and select that event.
- **FR-042**: A "back to live" control MUST show while pinned, and MUST unpin.

**Panels**

- **FR-043**: Seed, Ledger, Journal and Cost MUST open from the state column header as slide-out
  panels through the shared `Panel`.
- **FR-044**: The Seed panel MUST mark every field named in `dmOnlyPaths` as DM only.
- **FR-045**: The Ledger and Journal panels MUST follow the state column's pinned seq.
- **FR-046**: The Cost panel MUST show totals overall, by purpose and by model, and the count of
  unpriced calls.
- **FR-047**: The page MUST use no modal. The existing no-dialog test MUST stay green.

**Read-only**

- **FR-048**: The page MUST send no request other than the four debug reads, the existing
  `/auth/me`, and the retry POST.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): Every datum on the page comes from the operator debug API, and
  retry is the existing `POST /dm/sessions/:sessionId/turn`. An agent with an operator session
  reads and drives the same routes. The page adds no human-only path.
- **CR-004** (VI. 5e engine boundary): The page computes no game mechanics. It folds stored
  events with `project` and displays engine output.
- **CR-005** (VIII. Operator-owned content): The page shows only what the API returns. The API
  carries no prompt, completion or retrieved passage text, apart from the bounded failure
  excerpts already stored.
- **CR-006** (IV. Event-sourced play): The page appends nothing to the log. Its state column is a
  projection of the log, and the DM viewer sees hidden rows only for the operator (D1, D2).

### Key Entities

- **Debug snapshot**: the page's held data — the event list and its cursor, the jobs by id and the
  older-page cursor, the call ledger rows and totals, and the seed result.
- **Job view**: a job reduced for display — badge, duration, totals, sections, and the seqs it
  wrote with a "link unknown" flag.
- **Waiting summary**: the strip's derived rows — active jobs, uncommitted actions, mode and turn,
  pending proposals, holds, the latest failure, and the stuck flag.
- **Selection**: the selected job id, the selected seq and the pinned seq.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: During a live fake-gateway turn, the operator sees a new event on the page within
  3 s of its append, and a job's stage change within 3 s.
- **SC-002**: With the session idle for 30 s, the page polls no more often than every 10 s.
- **SC-003**: The operator identifies which job wrote any linked event in one click, with no
  database access.
- **SC-004**: Pinning the state column to any seq of a 2,000-event log shows the state in under
  100 ms.
- **SC-005**: A non-operator at the debug URL sees the operator-only message, and the test run
  records zero debug requests from that render.
- **SC-006**: The PR carries Brave screenshots of the page during a live fake-gateway turn, light
  and dark (runbook merge condition).
- **SC-007**: The page opens no modal: the no-dialog test passes.

## Open questions resolved (from the design record)

1. **Log page size and up-front load.** The page loads the whole log up front by cursor at the
   API's maximum page (1000). It renders the newest 500 matching rows and windows older ones
   behind "show 500 older". The fold always runs over the whole held log.
2. **Endpoint paths.** Settled by TASK-0116: the routes live under `/dm`.
3. **Poll back-off.** Yes: 2 s active, 10 s idle (FR-005). Active also covers 30 s after a retry.
   Polling pauses on a hidden tab.
4. **Hosted dev (vm-104).** The page ships wherever the app runs, behind the operator role, with
   no flag, as TASK-0116 does for the API. The operator can rule otherwise.

## TASK-0132 (progress between Commit and narration) — noted, not scoped

TASK-0132 is a separate card. Its signal must reach every seat, and these routes are operator
only, so it cannot poll them. It could reuse two pieces of this card:

- The **stuck and in-progress derivation** (`waiting.ts` in the plan): "the newest
  `action.committed` is later than the newest narration" is a pure fold over the player-visible
  log. TASK-0132 can lift that half into a shared module and run it on `/play`.
- The **stage labels** for pipeline nodes (`labels` in the plan), if TASK-0132 chooses a server
  signal that carries the stage.

This card changes nothing on `/play` beyond the Debug link.

## Assumptions

- TASK-0116 merges with the contract as read on 2026-10-27. A contract change after that is
  reconciled in this card's reconcile merge.
- One session's log stays within a few thousand events, so holding it whole in the browser is
  cheap. A longer log is a later card's problem (a windowed fetch), named as an open question.
- The fake gateway serves the live turn for the screenshots. No paid provider runs.
- Daylight tokens and `Panel` from `docs/design/chat-ui/decision.md` set the visual language.

## Card acceptance criteria map

| Card AC | Requirements | Proven by (tasks.md) |
|---|---|---|
| #1 route, OperatorOnly, Debug link | FR-001–FR-003 | T020, T021, T023, T024 |
| #2 polls ~2 s, seq cursor | FR-004–FR-011 | T002, T004, T005, T008, T010, T025 |
| #3 strip | FR-012–FR-018 | T011, T016, T022, T026 |
| #4 job timeline and pipeline | FR-022–FR-032 | T001, T012, T017, T027, T030 |
| #5 event log with filters | FR-033–FR-035 | T013, T018, T028, T031 |
| #6 cross-links | FR-036–FR-038 | T012, T017, T029, T032 |
| #7 seq pin, back to live | FR-039–FR-042 | T014, T019, T033, T036 |
| #8 slide-out panels, no modals | FR-043–FR-047 | T034, T035, T037, T038 |
| #9 retry control | FR-019–FR-021 | T011, T016, T022, T025, T026 |
| #10 Brave screenshots | SC-006 | T039–T041 |
