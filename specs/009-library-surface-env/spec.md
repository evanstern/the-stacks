# Feature Specification: Library Operator Surface & Worktree Environment Protocol

**Feature Branch**: `009-library-surface-env`

**Created**: 2026-07-09

**Status**: Draft

**Input**: User description: "Library operator surface + worktree environment protocol (combined slice, read-only product surface). Part A — bridge the web-app gaps left by 008-ingestion-service without adding mutating endpoints: navigation to the library surface, a library listing page so a lost ticket URL is recoverable from the UI instead of the DB, and cheap read-only indexed-content evidence. Part B — formalize the port branching / worktree environment protocol for the bare + sibling-worktree development style: per-worktree .env resolution, deterministic port allocation, compose identity, and docker lifecycle guidance, landed as an updated environment contract plus docs and small self-enforcing tooling."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find the library and recover any upload from the UI (Priority: P1)

The operator ingested material during 008 — but the only way to reach the upload page
is to type its URL, and the only way back to an upload's status page is the claim-ticket
link handed out at submission time. If that link is lost, the upload is only findable by
querying the database. The operator opens the web app, follows visible navigation to the
library, and sees every upload — individual sources and ZIP batches — listed with enough
identity (filename, kind, status, when it was submitted) to recognize what they're
looking for. Clicking any entry lands on the existing ticket detail page with its full
event trail.

**Why this priority**: This is the gap that motivated the slice — the product's
observability principle says URL-addressable state is part of the product, yet 008's
records are unreachable without out-of-band knowledge. Every later spec (retrieval,
corpus lifecycle) assumes the operator can see what's in the library.

**Independent Test**: With a running stack containing at least one ingested source, one
failed source, and one batch: start from the home page, reach the library listing using
only visible navigation, locate each of the three records in the list, and click through
to each one's detail page — no URL typing, no database access.

**Acceptance Scenarios**:

1. **Given** an authenticated operator on the home page, **When** they look for the
   library, **Then** visible navigation leads them to the library surface without typing
   a URL.
2. **Given** uploads exist (sources and batches), **When** the operator views the
   library listing, **Then** every upload appears with its original filename, kind
   (source or batch), current status, and submission time, newest first.
3. **Given** a listed upload, **When** the operator selects it, **Then** they land on
   that upload's existing detail page (status, plugin attribution, event trail).
4. **Given** an empty library, **When** the operator views the listing, **Then** they
   see an honest empty state that points them to the upload page rather than a blank
   or broken page.
5. **Given** the operator is on the library listing, **When** they want to add
   material, **Then** the upload page is reachable from the listing (and vice versa).

---

### User Story 2 - Run parallel worktree stacks without collisions (Priority: P2)

A developer (the operator, or an agent acting for them) works in the bare + sibling
worktree layout: `main/` is deploy-oriented; each feature gets its own worktree. Each
worktree needs its own running stack — web, API, ML sidecar, database — without
fighting any other worktree's stack for ports, container names, or data volumes. Today
the environment file is an unwritten convention: `.env.example` is the contract, but
nothing states how a worktree mints its own `.env`, which ports it should claim, or
what its compose identity is (the operator's own instance historically ran on web port
4500 — an override that lived nowhere reproducible). The developer follows one
documented, deterministic step to mint a worktree's environment and gets a stack that
starts cleanly alongside any other worktree's stack.

**Why this priority**: The operating model (constitution Development Workflow) requires
sibling-worktree development, and every spec cycle's implement step pivots into one.
Without a formal protocol each pivot re-invents port math by hand, and a mistake
silently corrupts a neighboring stack's data or steals its ports. This protocol is
consumed by this very cycle at its own worktree pivot.

**Independent Test**: From a clean checkout, mint environments for two sibling
worktrees using the documented protocol, start both stacks concurrently, and verify:
all published ports differ, compose project names differ, both stacks pass their
readiness checks, and tearing one down (including volumes) leaves the other fully
functional.

**Acceptance Scenarios**:

1. **Given** a fresh worktree with no `.env`, **When** the developer follows the
   documented minting step, **Then** a valid `.env` exists with a port set and compose
   identity that are deterministic for that worktree and distinct from every other
   worktree's, and the stack starts successfully with it.
2. **Given** two worktrees running concurrently, **When** both stacks are up, **Then**
   no port, container name, network, or volume is shared between them.
3. **Given** a worktree already has a `.env`, **When** the minting step is re-run,
   **Then** the existing file is not silently overwritten — the developer is told it
   exists and how to proceed deliberately.
4. **Given** a feature worktree is finished, **When** its stack is torn down per the
   documented lifecycle, **Then** its containers, networks, and volumes are gone, and
   no other worktree's stack is affected.
5. **Given** a deliberate port override (like the historical web-on-4500 instance),
   **When** it is applied per the protocol, **Then** the override lives in that
   worktree's environment file and is reproducible from the documentation alone.

---

### User Story 3 - See ingestion evidence at a glance (Priority: P3)

The operator scans the library listing and understands the state of the corpus without
opening every record: which ingester plugin (and version) handled each source, which
generation it's on, how many sections and indexed passages it produced, and — for
batches — how their entries fared. Failures are visible in the list, not just on the
detail page.

**Why this priority**: Cheap to surface (the data already exists on every record and is
already shown per-ticket) and it turns the listing from a link directory into an
operator dashboard. It only matters once US1 exists.

**Independent Test**: With a library containing an ingested source (generation ≥ 1), a
failed source, and a partially-skipped batch, verify the listing alone (no click-through)
communicates: plugin attribution and counts for the ingested source, a failure
indication for the failed one, and an entry-outcome summary for the batch.

**Acceptance Scenarios**:

1. **Given** an ingested source in the listing, **When** the operator reads its row,
   **Then** they see its ingester plugin name and version, its generation, and its
   section and indexed-passage counts.
2. **Given** a failed source in the listing, **When** the operator reads its row,
   **Then** the failure is visibly distinguished and attributes the failing stage,
   with the scrubbed reason available at most one interaction away.
3. **Given** a batch in the listing, **When** the operator reads its row, **Then**
   they see a summary of entry outcomes (how many ingested, skipped, failed) without
   opening the batch.

---

### Edge Cases

- Library grows large (hundreds of uploads): the listing stays usable and bounded —
  results are paged or capped with an explicit indication that more exist; it never
  renders unboundedly.
- An upload is mid-pipeline while the listing is open: the list shows its current
  status at load/refresh time; the listing is not required to live-update, but a
  refresh must reflect reality (the detail page remains the live-polling surface).
- A batch whose entries all failed or were skipped: the batch row must not read as
  success; its outcome summary must make the situation legible.
- Duplicate submissions (dedupe returned an existing ticket): the listing shows one
  record per stored upload — dedupe means no duplicate rows appear.
- Two worktrees derive the same port block (e.g., numbering collision or manual
  override mistake): the protocol must make the collision detectable before both
  stacks are up (deterministic derivation plus a stated check), not discovered as a
  runtime bind failure mid-startup.
- A worktree's `.env` drifts from `.env.example` after the contract gains new
  variables: the protocol states how drift is detected and reconciled.
- Teardown run from the wrong directory: compose identity per worktree must guarantee
  that a teardown command can only affect the worktree it is run in.

## Requirements *(mandatory)*

### Functional Requirements

**Part A — library operator surface (read-only)**

- **FR-001**: The web app MUST provide visible navigation from the authenticated home
  surface to the library (listing and upload pages); no library page may be reachable
  only by typing its URL.
- **FR-002**: The web app MUST provide a library listing page showing all uploads —
  sources and batches — each with original filename, kind, current status, and
  submission time, ordered newest first.
- **FR-003**: Each listed upload MUST link to its existing detail (claim-ticket) page,
  so any lost ticket URL is recoverable from the UI alone.
- **FR-004**: Source rows MUST surface ingestion evidence already recorded on the
  source: ingester plugin name and version, generation, and section / indexed-passage
  counts (where the source has reached those stages).
- **FR-005**: Failed sources MUST be visibly distinguished in the listing with their
  failing stage, and their scrubbed failure reason MUST be reachable within one
  interaction (the detail page satisfies this).
- **FR-006**: Batch rows MUST summarize entry outcomes (ingested / skipped / failed
  counts) without requiring the batch to be opened.
- **FR-007**: The listing MUST present an honest empty state when the library has no
  uploads, pointing the operator to the upload page.
- **FR-008**: The listing MUST remain bounded as the library grows: results are paged
  or explicitly capped with an indication that more exist and a way to reach them.
- **FR-009**: The listing capability MUST be read-only end to end: this slice adds no
  operation that creates, mutates, or deletes library content, and no re-ingestion or
  corpus-management operation (those stay pinned to the corpus-lifecycle spec per the
  2026-07-07 decision).
- **FR-010**: The listing data MUST be exposed to the web app through the same
  operator-authenticated, server-side access path as existing pages (browser never
  talks to the API directly; single-operator auth model unchanged).

**Part B — worktree environment protocol**

- **FR-011**: The environment contract MUST document a single, deterministic rule for
  minting a worktree's `.env` from `.env.example`, including where secrets come from
  and what must never be committed.
- **FR-012**: The protocol MUST define deterministic, per-worktree port allocation for
  all published services (web, API, ML, database) such that any two worktrees
  following the rule cannot collide, and MUST define the compose project identity per
  worktree with the same guarantee.
- **FR-013**: The protocol MUST be self-enforcing at the minting step: a repository
  tool MUST generate the worktree's environment (ports, compose identity) from the
  rule, MUST refuse to silently overwrite an existing `.env`, and MUST make a port
  collision with a sibling worktree detectable at mint time.
- **FR-014**: Deliberate overrides (e.g., the historical web-on-4500 instance) MUST be
  expressible within the protocol: recorded in the worktree's environment file,
  reproducible from documentation, and never requiring edits to tracked files.
- **FR-015**: Docker lifecycle rules MUST be documented per worktree: what `up`,
  `down`, and full teardown (including volumes) may touch, with the guarantee that a
  lifecycle command run in one worktree cannot affect another worktree's stack; the
  AGENTS.md "Worktree safety" guidance and README MUST be updated to state the
  protocol rather than warn vaguely about it.
- **FR-016**: The protocol MUST state how `.env` drift is handled when `.env.example`
  gains or changes variables (detection and reconciliation guidance).
- **FR-017**: The updated environment contract MUST supersede or extend the 007
  environment contract explicitly (a successor document or a versioned update — not a
  second, competing source of truth).

**Cross-cutting**

- **FR-018**: All capabilities this slice delivers MUST themselves be operator-visible
  per the (concurrently amended) visibility principle: the library surface in the web
  UI; the environment protocol through its tool's output and documentation (a
  developer-facing capability with no web surface, satisfied by CLI/docs visibility).

### Key Entities

- **Source record**: An individual uploaded document as 008 recorded it — filename,
  media type, status, ingester plugin attribution, generation, section/passage counts,
  failure detail. This slice reads it; it does not change it.
- **Batch record**: A ZIP upload that expanded into per-entry sources, with its entry
  report (per-entry outcome and reason). Read-only here.
- **Library listing**: The operator-facing collection view over source and batch
  records — bounded, ordered, linked to detail pages. New in this slice.
- **Worktree environment profile**: The per-worktree set of values that make a stack
  runnable and isolated — compose project identity, published port set, secrets, and
  deliberate overrides — materialized as that worktree's `.env`. Formalized (not
  invented) by this slice.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From the home page, the operator can reach any existing upload's detail
  page in at most 3 interactions, without typing a URL or touching the database.
- **SC-002**: A lost claim-ticket URL is recoverable through the UI in under 30
  seconds even with 100+ uploads in the library.
- **SC-003**: The state of the corpus is assessable from the listing alone: for a
  library with mixed outcomes (ingested / failed / partial batch), an operator can
  correctly answer "what succeeded, what failed, and roughly how much is indexed"
  without opening any detail page.
- **SC-004**: Two sibling worktrees, environments minted per the protocol, run their
  full stacks concurrently with zero collisions (ports, names, volumes), and each
  passes its readiness checks — verified as part of this cycle's own worktree pivot.
- **SC-005**: Minting a new worktree's environment is one documented step and yields
  a stack that starts successfully on the first attempt.
- **SC-006**: Tearing down one worktree's stack (including volumes) leaves every other
  worktree's running stack observably unaffected.
- **SC-007**: The slice ships zero new mutating operations on library content —
  verifiable by inspection of the delivered interface surface.

## Assumptions

- Read-only scope line is pinned: re-ingestion endpoints and corpus management
  (create/select corpora, dry-run/confirm mutations) remain deferred to the
  corpus-lifecycle spec per the operator's 2026-07-07 decision; this slice must not
  partially introduce them. The upload form continues to target the default corpus.
- Single-operator auth (D13) is unchanged; the listing sits behind the same session
  gate as every other protected page.
- The listing needs no search, filtering, or live polling in this slice — newest-first
  ordering with bounded pages is sufficient at current corpus scale; search over
  content is the retrieval spec's job.
- The detail pages delivered by 008 remain the canonical per-upload surfaces; this
  slice links to them rather than duplicating their content.
- Port defaults for `main/` stay 4400/4401/4402/5442; the protocol assigns other
  worktrees non-colliding blocks deterministically (exact derivation is a planning
  decision). Dev publishes keep binding 127.0.0.1; the prod overlay is out of scope.
- A concurrent constitution amendment (processed via the governance mechanism in this
  same cycle) establishes the feature-visibility principle FR-018 references: features
  must be visible in the web UI where the capability is operator-facing, and through
  CLI output or logs where a web surface is not warranted.
- The environment protocol governs local development and the existing compose
  topology; it does not introduce new deployment targets.
