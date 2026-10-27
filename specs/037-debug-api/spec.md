# Feature Specification: Debug view card A — operator debug API and persisted model-call usage

**Feature Branch**: `task-0116-debug-api`

**Created**: 2026-10-26

**Status**: Draft

**Input**: Board card TASK-0116 (M3 sweep, track B2, HIGH). Design agreed with the operator on
2026-10-26: [docs/design/debug-view.md](../../docs/design/debug-view.md), decisions D1–D11 and
"Card A". The web page is the dependent card TASK-0117, specced against
[contracts/debug-api.md](contracts/debug-api.md).

**Rulings in force (not reopened)**: operator only, enforced on the server (D1). Show everything,
no masking (D2). HTTP polling; the seat-based socket rule (TASK-0045, `ws/registry.ts`
`viewerFor`) is untouched (D3). Persist usage, never prompt or completion text; the bounded
failure excerpts stay as they are (D4). Read-only plus the existing retry route (D8).

**Clarify**: skipped. The design record settles every scope decision and the four open
questions it hands to the spec are resolved under "Open questions" below. The remaining
choices are technical and recorded in [research.md](research.md).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every DM model call records what it cost (Priority: P1)

The operator reads, for every model call a DM job made, which provider and model served it, the
tokens in and out, the cost and how long it took.

**Why this priority**: cost and latency per pipeline node were the main missing numbers in the
M2 demo (D4). Usage reached only a log line.

**Independent Test**: run one full turn on the fake gateway against a database. Every model call
the turn made has one stored usage row, and the job's stored call list carries the same numbers
(runbook merge condition).

**Acceptance Scenarios**:

1. **Given** a turn job runs on the fake gateway, **When** it finishes, **Then** each call in its
   stored call list carries provider, model, input tokens, output tokens, cost and duration.
2. **Given** a companion job or a chronicle job, **When** it finishes, **Then** its stored calls
   carry the same six fields.
3. **Given** any DM model call ends, **When** the call ends, **Then** one usage row is stored for
   it at once, before the job finishes.
4. **Given** a turn the Director holds, or an attempt that a reclaim or shutdown abandons,
   **When** its calls end, **Then** their usage rows are still stored.
5. **Given** a model with no configured price, **When** a call to it ends, **Then** its cost is
   stored as unknown, never as zero.
6. **Given** any stored call record or usage row, **When** it is read, **Then** it holds no
   prompt or completion text.

---

### User Story 2 - The operator reads a session's full event log (Priority: P1)

The operator pages through every event of a session after a given seq, with every visibility,
including DM-only rows the socket never sends to a player.

**Why this priority**: with an AI DM seat, DM-visibility rows never reach any browser. Diagnosis
in the M2 demo needed SQL.

**Independent Test**: append public and DM-visibility events to a session, then page the route
from seq 0 with a small page size until it reports no more.

**Acceptance Scenarios**:

1. **Given** a session with public and DM events, **When** the operator requests events after
   seq 0, **Then** both visibilities return, in seq order.
2. **Given** more events than one page holds, **When** the operator follows the returned cursor,
   **Then** every event returns exactly once.
3. **Given** a cursor at the head of the log, **When** the operator polls, **Then** the response
   is empty and reports the head seq.

---

### User Story 3 - The operator reads each DM job in full (Priority: P1)

The operator reads every DM job of a session with its full input and result: the checkpoint,
the audit record, the calls and the failure record, plus the heartbeat and timing columns.

**Why this priority**: jobs are not on the socket. A companion hold looked like a frozen table.

**Independent Test**: run a turn, a held turn and a failed turn; the route returns all three with
their stored input and result unchanged.

**Acceptance Scenarios**:

1. **Given** a session with DM jobs, **When** the operator requests its jobs, **Then** each
   returns with kind, status, stage, attempts, input, result, error, heartbeat and timestamps.
2. **Given** a running turn job, **When** the operator polls, **Then** its saved checkpoint so far
   returns.
3. **Given** a job whose gate submissions appended events, **When** it returns, **Then** each
   submission names the seqs it wrote.
4. **Given** more jobs than one page holds, **When** the operator follows the returned cursor,
   **Then** older jobs return with no gap or repeat.

---

### User Story 4 - The operator reads the scene seed as loaded (Priority: P2)

The operator reads the full scene seed the session plays, with the DM-only fields named.

**Why this priority**: the debug page's Seed panel (TASK-0117) shows it. Players never get it.

**Independent Test**: start a scene, request its seed, and compare it with the loaded seed file.

**Acceptance Scenarios**:

1. **Given** a session with a scene, **When** the operator requests its seed, **Then** the full
   seed returns with a list of its DM-only field paths.
2. **Given** a session with no scene, **When** the operator requests its seed, **Then** the
   response is `404 not_found`.

---

### User Story 5 - Only the operator reaches the debug API (Priority: P1)

**Why this priority**: the API returns DM secrets and system internals (D1).

**Independent Test**: call each new route with no session, with a player session and with the
operator session.

**Acceptance Scenarios**:

1. **Given** no session cookie, **When** any new route is called, **Then** it answers `401`.
2. **Given** a signed-in non-operator, **When** any new route is called, **Then** it answers `403`.
3. **Given** the existing `GET /dm/sessions/:id/turns`, **When** it is called after this change,
   **Then** its response matches its current contract field for field.

### Edge Cases

- A call ends with a gateway error, an invalid-JSON repair, or an abort: each still stores a
  usage row with its outcome.
- The gateway emits no usage record (an unknown purpose fails before any provider call): the call
  record stores the six usage fields as unknown, and the row stores them as unknown.
- Storing a usage row fails: the job continues, and the failure is logged without text.
- Jobs stored before this change lack the usage fields and submission seqs: the API returns them
  as stored. The page shows "usage not recorded" (TASK-0117).
- A session with no events or jobs: each list route answers `200` with an empty list.
- Malformed cursor or page size: `400 validation`, after the auth checks.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every DM model-call record stored in `jobs.result` MUST carry `provider`, `model`,
  `inputTokens`, `outputTokens`, `costUsd` and `durationMs`. The paths are turn nodes
  (`callJson`, `callText`), companion and chronicle.
- **FR-002**: The usage values MUST come from the gateway's own usage record for that call.
  They MUST NOT be recomputed by the DM runtime. A field with no gateway value is `null`.
- **FR-003**: Every DM model call MUST store one row in a per-call usage ledger when the call ends.
  The row names the job, session, job kind, job attempt, purpose, prompt version, call attempt,
  outcome, error kind and the six usage fields.
- **FR-004**: The ledger MUST also record calls whose attempt is abandoned (aborted, fenced,
  reclaimed). A held turn MUST keep its calls in `jobs.result.calls`.
- **FR-005**: A failure to store a ledger row MUST NOT fail or stop the job. It MUST log one
  line with no text.
- **FR-006**: No call record, ledger row or debug response MAY contain prompt text, completion
  text or retrieved passages, except the bounded failure excerpts already in `jobs.result`.
- **FR-007**: Every gate submission a DM job stores MUST name the seqs the gate returned for it.
  This covers turn submissions, narration, companion plays and chronicle entries.
- **FR-008**: `GET /dm/sessions/:sessionId/events` MUST return the session's events after a seq
  cursor, all visibilities, in seq order, paginated, with the head seq.
- **FR-009**: `GET /dm/sessions/:sessionId/jobs` MUST return the session's DM jobs newest first,
  with full input, result and error, paginated by a job cursor. It MUST NOT return the claim
  token.
- **FR-010**: `GET /dm/sessions/:sessionId/seed` MUST return the seed named by the session's
  scene, as the loader returns it, with the DM-only field paths.
- **FR-011**: `GET /dm/sessions/:sessionId/calls` MUST return the session's ledger rows after a
  row cursor, paginated, with session totals by purpose and by model.
- **FR-012**: Each new route MUST answer `401` with no session and `403` for a non-operator,
  before any validation or read.
- **FR-013**: `GET /dm/sessions/:sessionId/turns` MUST keep its current response contract.
- **FR-014**: The DM API contract, the gateway contract and the touched wiki notes MUST be
  updated and re-pinned. A new wiki note `debug-view` MUST describe the API.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): an agent MUST be able to read every debug datum through the
  same HTTP routes the debug page uses, with an operator session. No datum is page-only.
- **CR-002** (IV. Event-sourced play): the debug routes MUST only read. They MUST NOT append an
  event or change a job. The event route MUST return rows as the log stores them.
- **CR-003** (IX. Self-hostable, one gateway seam): usage MUST be captured at the gateway seam.
  No adapter or DM node may time or price a call itself.
- **CR-004** (VIII. Operator-owned content): debug responses MUST NOT carry retrieved library
  passages. Library text stays in the library routes.

### Key Entities

- **Model-call record**: one entry of `jobs.result.calls`. Purpose, prompt version, attempt,
  outcome, error kind, plus the six usage fields. The job's own summary.
- **Usage ledger row**: one per DM model call, written when the call ends. The authority for
  session cost totals and for calls an abandoned attempt made.
- **Submission seqs**: the event seqs one gate submission wrote. They link a job to its events.
- **Debug job**: a DM job as stored, minus the claim token.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a full fake-gateway turn, 100% of model calls have a stored usage row, and the
  row count equals the call count.
- **SC-002**: An operator reads a session's whole event log, all visibilities, with no database
  access.
- **SC-003**: An operator reads any DM job's checkpoint, audit, calls and failure with no database
  access.
- **SC-004**: A scan of every debug response and ledger row in the test run finds no prompt or
  completion text from the fake gateway's script.
- **SC-005**: Every new route refuses a non-operator, in tests: 4 routes × 2 refusals.
- **SC-006**: The existing `turns` route tests pass unchanged.

## Open questions (from the design record)

1. **Log page size and up-front load** — resolved for the API. `limit` defaults to 500, maximum
   1000. The response reports `hasMore` and the head seq. TASK-0117 decides how the page loads or
   windows the log; this API supports both.
2. **Paths and mount** — resolved. The routes live under the existing `/dm` mount, beside
   `/turns`, with its auth middleware and `requireOperator` rule. No new mount.
3. **Poll back-off when idle** — a client decision, handed to TASK-0117. The API is cheap to
   poll: an idle poll returns empty lists. Recommendation for 0117: back off to about 10 s
   when no job is queued or running and no new seq arrived for 30 s.
4. **Reachable on hosted dev (vm-104)** — **for the operator.** Default in this spec: the routes
   ship wherever the server runs, behind the operator gate, with no feature flag.
5. **TASK-0132 (progress between Commit and narration)** — noted, not scoped. These routes are
   operator only (D1), so a player seat cannot read them. TASK-0132 needs a signal every seat
   can see. Two options: a client-side fold (a committed action with no later narration), or
   a new non-operator signal carrying only "DM working" and the stage. Its spec chooses; this
   spec changes neither.

## Assumptions

- The fake gateway's usage is deterministic enough to assert row counts and token totals.
- DM jobs are not deleted in normal operation. Ledger rows follow their job on delete.
- One session's ledger stays small (hundreds to low thousands of rows), so totals are computed
  per request.
- Pre-existing jobs are not back-filled. The old log lines are not imported.

## Card acceptance criteria map

| Card AC | Requirement | Proven by (tasks.md) |
|---|---|---|
| #1 usage fields on every path | FR-001, FR-002, FR-004 | T004, T005, T012, T013 |
| #2 no prompt or completion text | FR-006 | T006, T014, T025 |
| #3 full event log after a seq | FR-008 | T022 |
| #4 jobs with full input and result | FR-007, FR-009 | T015, T023 |
| #5 scene seed with DM-only facts | FR-010 | T019, T024 |
| #6 403 non-operator, 401 unauthenticated | FR-012 | T021 |
| #7 `/turns` contract unchanged | FR-013 | T026 |
| #8 contracts and wiki updated, re-pinned | FR-014 | T027, T030–T037 |
| Merge condition: each call persists its usage row | FR-003 | T013 |
