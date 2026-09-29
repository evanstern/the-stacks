# Feature Specification: Rules answerer

**Feature Branch**: `task-0027-rules-answerer`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "Rules answerer (TASK-0027): POST /library/ask streams a grounded
answer as text/event-stream; every claim cites a chunk by book, section, exact quote span,
verified against stored chunk text; refuse when retrieval finds nothing relevant; tests use the
fake provider."

**Direction (settled, not re-litigated here)**: decision-0004 (answers stream as SSE from an
HTTP route, not the WebSocket gateway); decision-0007 (every model call goes through the
provider-agnostic gateway under a named purpose); architecture A7 and A9; constitution V and
VIII. Consumers: the chat UI (TASK-0028) builds against `contracts/ask-sse.md`.

**Clarify**: skipped. The four open design calls (citation verification, refusal rule, purpose
name, who may ask) are settled from existing artifacts in research.md R1–R5. No question
remained whose answer those artifacts do not already give.

## User Scenarios & Testing *(mandatory)*

The user is the operator: the person who runs the install and imported the books. The operator
asks a rules question in plain language and reads an answer that points at the exact words it
came from. An agent (a future DM or NPC agent) asks through the same function the route uses.

### User Story 1 - Ask a question, get a streamed answer with verified citations (Priority: P1)

The operator asks a rules question. The answer appears progressively, word by word. Each claim
carries a citation naming the book, the section, and the exact quoted words. Opening a citation
shows the source passage with the quoted words highlighted. Every quote shown really appears in
the stored book text; a quote the model invented never reaches the operator.

**Why this priority**: This is the feature. Card AC #1, #2, and #4; constitution V.

**Independent Test**: Store a synthetic book. Script the model to answer with one real quote and
one invented quote. Ask a question that matches the book. The stream carries answer text, exactly
one citation (the real quote), and a completion that reports one dropped citation. Slicing the
stored book text by the citation's span reproduces the quote exactly.

**Acceptance Scenarios**:

1. **Given** a stored book that answers the question, **When** the operator asks, **Then** the
   response streams answer text, then citations, then one completion event, in that order of
   arrival relative to the text they annotate.
2. **Given** any citation in the stream, **When** the stored book text is sliced by its span,
   **Then** the result equals the citation's quote exactly.
3. **Given** the model cites a quote that is not in the cited passage, **When** the answer
   streams, **Then** that citation is not emitted, its marker does not appear in the text, and
   the completion event counts it as dropped.
4. **Given** the model's quote differs from the passage only in whitespace or quote-mark style,
   **When** the answer streams, **Then** the citation is emitted with the passage's own exact
   words and span.
5. **Given** a citation, **When** the UI reads it, **Then** it has the book, the section path,
   the quote, the quote's span in the book, and the full passage text with the quote's offsets
   inside it, so the UI can show and highlight the passage with no second request.

---

### User Story 2 - Refuse when the library has nothing relevant, and say so (Priority: P1)

The operator asks something the imported books do not cover. The system does not guess. It
answers with an explicit refusal that says the library has nothing to answer from.

**Why this priority**: Card AC #3; constitution V ("MUST NOT present an ungrounded assertion as
rules truth").

**Independent Test**: With a stored book, ask a question that shares no meaningful word with it.
The stream is a single refusal event, and the model is never called.

**Acceptance Scenarios**:

1. **Given** retrieval returns no passages, **When** the operator asks, **Then** the stream is
   one `refusal` event with reason `nothing_relevant`, and no model call is made.
2. **Given** retrieval returns passages but none passes the relevance rule, **When** the
   operator asks, **Then** the result is the same as scenario 1.
3. **Given** relevant passages but the model states they do not answer the question, **When**
   the answer streams, **Then** the stream ends with a `refusal` event with reason
   `model_declined`.
4. **Given** the model answers but no citation survives verification, **When** the answer
   completes, **Then** the stream ends with a `refusal` event with reason `unverified` instead
   of a completion event, and the UI discards the streamed text.

---

### User Story 3 - Failures and cancellation are explicit (Priority: P2)

A bad request, a missing model configuration, a provider outage, or the operator closing the
page each produce a defined outcome. Nothing hangs; nothing half-finishes silently.

**Why this priority**: The UI (TASK-0028) needs every terminal state named to render it.

**Independent Test**: Script the model to fail mid-answer. The stream carries the text so far,
then one `error` event with a kind, then closes.

**Acceptance Scenarios**:

1. **Given** an empty or oversized question, **When** posted, **Then** the response is the
   standard JSON validation error with status 400 and no stream.
2. **Given** no session, **When** posted, **Then** 401; **given** a player session, **Then** 403.
3. **Given** the answering model is not configured, **When** the operator asks a question with
   relevant passages, **Then** the stream is one `error` event of kind `config`.
4. **Given** the model fails mid-answer, **When** streaming, **Then** the stream ends with one
   `error` event and no completion event.
5. **Given** the client disconnects mid-answer, **When** the server notices, **Then** the model
   call is cancelled and no further events are written.

### Edge Cases

- A citation marker split across two streamed text pieces is still recognized.
- A malformed or unterminated marker is not shown to the operator as marker syntax; it is
  dropped and counted.
- The model cites a passage number it was not given: dropped and counted.
- A quote too short to be meaningful (a word or two) is dropped, unless it is the whole passage.
- The same quote cited twice gets the same citation number both times.
- A quote that occurs twice in one passage cites its first occurrence.
- Question text containing search syntax characters is treated as plain text (retrieval
  invariant 7).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST accept a question at `POST /library/ask` and respond with an
  event stream (`text/event-stream`) as defined in `contracts/ask-sse.md`.
- **FR-002**: The question MUST be 1–2000 characters after trimming. Anything else is refused
  with the standard validation error before any search or model call.
- **FR-003**: Only an authenticated operator MAY ask. No session gets 401; a player gets 403.
- **FR-004**: The system MUST retrieve passages through the existing retrieval function in the
  deployment's configured mode and result count.
- **FR-005**: The system MUST apply the relevance rule (research R2) to the retrieved passages.
  If no passage is relevant, it MUST emit a `nothing_relevant` refusal and MUST NOT call the
  model.
- **FR-006**: The system MUST send only relevant passages to the model, under the named purpose
  `answering`, with instructions to cite each claim with a passage number and an exact quote.
- **FR-007**: The system MUST verify every citation against the stored text of the passage it
  names before emitting it (research R1). A citation that fails verification MUST NOT be
  emitted, and its marker MUST NOT appear in the answer text.
- **FR-008**: Every emitted citation MUST carry: chunk id, document id, book, section path,
  quote, the quote's span in the book, the passage text and span, and the quote's offsets inside
  the passage text.
- **FR-009**: The stream MUST end with exactly one terminal event: `done`, `refusal`, or
  `error`.
- **FR-010**: `done` MUST report the count of emitted and dropped citations and the prompt
  version.
- **FR-011**: When the model declines, or no citation survives verification, the stream MUST
  end with a `refusal` instead of `done`.
- **FR-012**: A model or retrieval failure after the stream opens MUST end the stream with an
  `error` event carrying a kind and a fixed human-readable message.
- **FR-013**: A client disconnect MUST cancel the model call.
- **FR-014**: The answering function MUST be callable directly, without HTTP, and yield the same
  events the route writes.
- **FR-015**: The similarity floor in the relevance rule MUST be configurable by an optional
  environment variable with a documented default, validated at boot.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): An agent MUST be able to ask through the same function the
  route calls (`answer()`), receiving the same event sequence (FR-014).
- **CR-003** (V. Citations): Every cited claim MUST carry book, section, and exact quote span,
  proven against stored text. An answer with no verified citation MUST be refused, not shown
  as rules truth.
- **CR-004** (VI. System-agnostic): The prompt MUST NOT assume 5e; it answers from whatever the
  passages say.
- **CR-005** (VIII. Operator-owned content): Quoted book text MUST be shown only to the operator
  (FR-003). Nothing quoted is logged or stored.

### Key Entities

- **Question**: the operator's plain-language text.
- **Relevant passage**: a retrieved chunk that passes the relevance rule; numbered for the model.
- **Citation**: a verified pointer from the answer into one passage: book, section path, exact
  quote, its span in the book, and the passage it came from.
- **Answer event**: one item in the stream (`delta`, `citation`, `done`, `refusal`, `error`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In every test, 100% of emitted citations' quotes equal the stored book text sliced
  by their span.
- **SC-002**: A scripted invented quote is never emitted, in 100% of test runs.
- **SC-003**: A question with nothing relevant yields a refusal with zero model calls.
- **SC-004**: Every test stream ends with exactly one terminal event.
- **SC-005**: A player or anonymous caller receives zero passage text.
- **SC-006**: The whole suite runs with no network and no real model.

## Assumptions

- Single tenant: every book was imported by an operator (upload is operator-only), so "the
  operator who supplied the book" is any operator of this install (research R4).
- One question per request; no conversation history. Follow-up context is TASK-0028's or a later
  task's concern.
- The UI reads the stream with `fetch`, not `EventSource`, because the route is `POST`.
- No route to fetch a whole document is added: the citation carries its passage text.
- Retrieval quality itself is TASK-0026's and TASK-0029's concern; this task consumes it.
