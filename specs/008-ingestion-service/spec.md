# Feature Specification: Extensible Ingestion Service

**Feature Branch**: `008-ingestion-service`

**Created**: 2026-07-06

**Status**: Draft

**Input**: User description: "Ingestion service: the extensible ingestion pipeline for The Stacks v3 — plugin contract, D&D Beyond ingester, normalized-document schema, corpus intake via the Postgres job queue. Grounded in docs/grounding/05-ingestion.md, docs/grounding/03-architecture.md (data & durability doctrine, queue, event trails), and the open questions under 'Spec: ingestion service' in docs/grounding/08-decisions-and-open-questions.md."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload a D&D Beyond export and get a searchable corpus (Priority: P1)

The operator has saved pages and ZIP exports from D&D Beyond — their lawfully owned
source material. They submit an export to The Stacks. The system accepts it immediately
(no waiting on processing), records it durably, and works through it in the background:
recognizing it as D&D Beyond material, extracting its structure (headings, prose, stat
blocks, tables, spell entries), splitting it into retrieval-sized passages that respect
that structure, and indexing those passages so they can be found by meaning and by
keyword. When processing completes, every indexed passage can be traced back to the
exact place in the original source it came from.

**Why this priority**: This is the flagship ingestion path (v3 scope item 1) and the
reason the product exists — without ingested D&D Beyond material there is nothing to
retrieve, cite, or converse about. Every later spec (retrieval, chat, eval) consumes
what this journey produces.

**Independent Test**: Submit a permitted/synthetic D&D Beyond-shaped fixture export
against a running stack; observe acceptance is immediate, processing completes without
intervention, and the resulting passages are present in the index with working
source-position links.

**Acceptance Scenarios**:

1. **Given** a running system and a supported D&D Beyond saved-HTML file, **When** the
   operator submits it, **Then** the system responds immediately with a claim ticket
   identifying the accepted upload and a queued processing job, before any parsing work
   happens.
2. **Given** an accepted D&D Beyond upload, **When** background processing completes,
   **Then** the source's content exists as ordered, classified sections (prose, stat
   block, table, spell entry where recognizable) and as indexed passages searchable by
   both meaning and keyword.
3. **Given** a completed ingestion, **When** any indexed passage is inspected, **Then**
   it records which source it came from, the position/anchor within that source, which
   plugin (and plugin version) produced it, and which embedding configuration indexed it.
4. **Given** a ZIP export containing multiple pages, **When** the operator submits it,
   **Then** each contained page is ingested as its own source under one batch, and the
   batch's overall progress is visible.

---

### User Story 2 - See what happened to every upload (Priority: P2)

The operator submits material and later wants to know: did it work? What stage is it
at? If it failed, why, and at which stage? They can look up any upload by its claim
ticket and see the job's status and its stage-by-stage history — including honest
failure reasons — without reading logs or asking the system's insides.

**Why this priority**: "Slow work never happens while a user waits" only works if the
status contract is legible (product principle 3 & 4). Without visibility, asynchronous
ingestion is a black box and failures are illegible.

**Independent Test**: Submit one upload that succeeds and one that fails (e.g., a file
that declares a supported type but is corrupt); verify both jobs expose their status and
per-stage event history, with a cause-typed failure reason on the failed one.

**Acceptance Scenarios**:

1. **Given** an accepted upload, **When** the operator queries its claim ticket, **Then**
   they see the job's current status and the ordered trail of stage events recorded so far.
2. **Given** a job that failed mid-pipeline, **When** the operator inspects it, **Then**
   the failure is attributed to a stage and a typed cause, the user-visible message is
   scrubbed of secrets/internals, and full diagnostics are retained operator-side.
3. **Given** any finished job (success or failure), **When** it is re-inspected later,
   **Then** its event history is still present and unchanged (append-only).

---

### User Story 3 - Honest front door: rejection, limits, and duplicates (Priority: P3)

The operator submits things the system can't or shouldn't process: an unsupported file
type (e.g., PDF), an oversized file, or a file they already uploaded. Unsupported and
oversized submissions are refused at the door with a clear, honest reason — no job is
created, nothing is queued. Re-submitting identical content is recognized by its
fingerprint and does not create duplicate sources or duplicate indexed passages.

**Why this priority**: The honest 415 and content-hash dedupe are ported v2 invariants
(product principle 6; doc 05 intake). They protect corpus integrity from day one, but
only matter once the happy path (US1) exists.

**Independent Test**: Submit a PDF, an over-limit file, and the same supported file
twice; verify the first two are refused with distinct, accurate reasons and no queued
work, and the second identical upload creates no duplicate corpus content.

**Acceptance Scenarios**:

1. **Given** a file of an unsupported type, **When** it is submitted, **Then** it is
   refused immediately with an "unsupported type" reason and no job or archive entry
   results.
2. **Given** a file exceeding the configured size limit, **When** it is submitted,
   **Then** it is refused immediately with a size-limit reason.
3. **Given** content already ingested, **When** the identical bytes are submitted again,
   **Then** the system recognizes the duplicate by content fingerprint and does not
   create a second source or duplicate indexed passages, and tells the operator so.
4. **Given** a ZIP containing a mix of supported and unsupported entries, **When** it is
   submitted, **Then** supported entries are ingested and unsupported entries are
   reported individually as skipped-with-reason, without failing the whole batch.

---

### User Story 4 - Generic material through fallback ingesters (Priority: P4)

The operator has source material that isn't from D&D Beyond: a plain HTML file, a
Markdown or text document. Each is recognized by the most specific ingester that
claims it — with generic fallbacks catching what nothing specific claims — and flows
through the same pipeline to the same kind of indexed, traceable passages.
(Archived-webpage and EPUB ingesters are deferred fast-follows against the same
contract — FR-028.)

**Why this priority**: Extensibility is scope item 2, but its user-visible half
(generic material works) depends on the pipeline and detection registry existing (US1).

**Independent Test**: Submit one fixture of each shipped generic type (Markdown, plain
text, non-DDB HTML); verify each is claimed by the expected ingester and produces
indexed passages with source anchors.

**Acceptance Scenarios**:

1. **Given** a Markdown file, **When** it is ingested, **Then** its heading structure is
   preserved as section paths and its passages are indexed.
2. **Given** an HTML file that is *not* D&D Beyond material, **When** detection runs,
   **Then** the generic HTML ingester claims it (the D&D Beyond ingester does not), and
   the source record shows which ingester owned it.
3. **Given** a source that multiple ingesters can recognize, **When** detection runs,
   **Then** the most specific/most confident ingester wins, and the decision is recorded.

---

### User Story 5 - Add a new ingester without touching the pipeline core (Priority: P5)

A developer (the operator wearing their other hat) wants to support a new kind of
source material. They write a plugin that declares its identity and version, what it
can detect (with confidence), how it transforms sources into the normalized document
shape, the failure categories it can report, and optional chunking hints. They register
it, prove it against a shared conformance suite, and the pipeline picks it up — no
changes to intake, detection dispatch, chunking, embedding, or indexing code.

**Why this priority**: "New ingesters are a small task" is the roadmap promise the
whole design is judged by (doc 05). It is last only because it is proven *through* the
stories above — the D&D Beyond and fallback ingesters must themselves be plugins.

**Independent Test**: Author a trivial demonstration plugin for a synthetic format
inside the test suite; verify it passes the conformance suite and ingests a fixture
end-to-end with zero modifications to pipeline-core code.

**Acceptance Scenarios**:

1. **Given** a new plugin that satisfies the plugin contract, **When** it is registered,
   **Then** sources it claims flow through the full pipeline with no pipeline-core changes.
2. **Given** the shared conformance suite, **When** it runs against every registered
   plugin (including D&D Beyond and all fallbacks), **Then** each passes the same
   contract obligations.
3. **Given** a plugin is updated to a new version, **When** the operator asks "which
   sources did the old version produce?", **Then** the system can list exactly those
   sources as re-ingestion candidates, and re-ingesting them replaces their derived
   sections/passages without duplicating them and without touching their original
   archives.

---

### Edge Cases

- A job crashes or its worker dies mid-stage: the job must be safely retryable, and a
  retry must not duplicate archives, sections, or indexed passages (deterministic
  identity, idempotent indexing).
- The embedding provider is unavailable at the embed stage: the job fails legibly as a
  dependency-down cause (not "our bug"), remains retryable, and earlier stage outputs
  are not lost.
- A plugin's transform yields an empty document (no sections): the job completes with an
  honest "nothing ingestible" outcome rather than silently indexing nothing.
- A file's declared type and actual content disagree (e.g., a renamed binary): detection
  or extraction fails with a typed cause; the archive is retained for diagnosis.
- Two plugins claim the same source at equal confidence: the tie is broken
  deterministically and the decision recorded; ambiguity never stalls a job.
- A ZIP contains nested ZIPs or zero ingestible entries: bounded handling with honest
  per-entry outcomes; no infinite recursion.
- A stat block or table is larger than the target passage size: structure-aware chunking
  must still not split it mid-entity; oversized structural units are handled as a
  documented policy, not silently truncated.
- The same content is uploaded under two different filenames: dedupe is by content
  fingerprint, not name; the operator is told it is a duplicate.
- Re-ingestion runs while the original job's outputs are being queried: replacement is
  atomic from the reader's perspective (no half-old/half-new source visible).

## Requirements *(mandatory)*

### Functional Requirements

**Intake (synchronous front door)**

- **FR-001**: The system MUST accept uploads of supported source material, validate type
  and size at the door, and respond immediately with a claim ticket — before any parsing,
  transformation, or indexing occurs.
- **FR-002**: The system MUST refuse unsupported types (including PDF, which is
  explicitly out of scope for v3) and oversized files immediately, with cause-typed,
  honest reasons, creating no job and no archive entry.
- **FR-003**: The system MUST fingerprint every accepted upload by content hash, store
  the original bytes as an immutable, content-addressed archive, and detect duplicate
  content by that fingerprint — never by filename.
- **FR-004**: The system MUST support batch submission via ZIP: each ingestible entry
  becomes its own source under a shared batch identity; unsupported entries are skipped
  and reported individually without failing the batch.
- **FR-005**: Upload size limits and supported-type lists MUST be configurable, with
  safe defaults.

**Asynchronous processing (queue and stages)**

- **FR-006**: All processing beyond intake MUST run asynchronously via the existing
  Postgres-backed job queue with locked claims (D12); no ingestion work may block the
  submitting request.
- **FR-007**: The pipeline MUST proceed through the stage vocabulary intake → detect →
  extract → transform → chunk → embed → index, recording an append-only event per stage
  transition (started/completed/failed with cause) for every job.
- **FR-008**: Job retries and re-runs MUST be idempotent end to end: deterministic
  identities derived from content and position guarantee that re-processing never
  duplicates archives, sources, sections, or indexed passages.
- **FR-009**: Failures MUST be typed by cause in domain terms and mapped to honest
  transport statuses only at the API boundary; user-visible messages are scrubbed while
  full diagnostics are retained operator-side.
- **FR-010**: The claim ticket MUST resolve to the job's current status and full event
  history at any time, including after completion or failure.

**Detection and the plugin registry**

- **FR-011**: Ingester selection MUST be performed by a registry that asks each
  registered plugin to recognize the source and declare a confidence; the most
  specific/confident plugin wins, ties break deterministically, and the winning plugin
  and its version are recorded on the source.
- **FR-012**: Generic fallback ingesters MUST catch what no specific plugin claims
  (this cycle ships the generic-HTML and Markdown/plain-text fallbacks — see FR-028);
  sources nothing claims fail detection with an honest, typed cause.

**The plugin contract**

- **FR-013**: A plugin MUST declare: stable identity and version; detection capability
  with confidence; extraction/transformation to the normalized document; the failure
  categories it can report; and optional chunking hints. This contract lives in the
  designated shared contract package and is the only seam plugins use.
- **FR-014**: Plugins MUST NOT access the database, embed, index, or call model
  providers. The pipeline core owns chunking policy, embedding, and indexing; plugins
  may only *inform* chunking via hints.
- **FR-015**: A shared conformance suite MUST verify any plugin's contract obligations;
  all shipped plugins (D&D Beyond and fallbacks) MUST pass it, and it MUST be runnable
  against future third plugins unchanged.
- **FR-016**: Every ingested source MUST permanently record which plugin and plugin
  version produced it, such that the system can enumerate all sources produced by a
  given plugin version as re-ingestion candidates.

**The normalized document**

- **FR-017**: Past the transform stage, the pipeline MUST see exactly one shape: a
  normalized document with ordered sections, heading/section paths, content classified
  by kind where the plugin knows it (at minimum: prose, stat block, table, spell entry,
  plus an unclassified default), source anchors sufficient for citation deep-linking,
  and sanitized display artifacts for the archive viewer.
- **FR-018**: The full normalized-document schema (section kinds, anchor semantics,
  artifact model) MUST be specified as an explicit, versioned contract during planning —
  it is the pivotal contract of the design and a required planning deliverable.

**Chunking, embedding, indexing**

- **FR-019**: Chunking MUST be pipeline-owned and structure-aware: it must not split
  atomic structural units (stat blocks; tables stay with their captions), may consume
  plugin hints, and its parameters MUST be expressed so the evaluation program (doc 06)
  can vary them without code surgery.
- **FR-020**: Embedding MUST use the named, env-first embedding-model configuration
  (D14) — no hardcoded model identifiers — and the embedding-model identity (provider,
  model, dimensions) MUST be stamped on the index such that mixed vector spaces are
  structurally detectable.
- **FR-021**: Indexed passages MUST carry deterministic identities derived from chunk
  identity, be indexed idempotently for both semantic and keyword (full-text) search in
  the system's single datastore (D5), and record source, anchor, plugin version, and
  corpus membership.
- **FR-022**: Sources and passages MUST carry a corpus identifier from day one (D4),
  even while exactly one live corpus exists.

**Re-ingestion**

- **FR-023**: The system MUST support re-ingesting a source from its immutable archive
  (identify → re-run → re-index): derived sections and passages are replaced without
  duplication, the original archive is never modified, and the replacement is atomic
  from a reader's perspective.

**Licensing and provenance**

- **FR-024**: The repository MUST NOT ship, download, or embed any proprietary game
  content; all test fixtures for every ingester MUST be synthetic, minimal, or
  explicitly permitted material (Principle I).

**Scope-boundary requirements (what this feature deliberately does not do)**

- **FR-025**: Corpus lifecycle verbs (seed, reset, re-embed, verify) are OUT of this
  feature's scope — they are the corpus-lifecycle spec's job. This feature MUST leave
  them unblocked: archives immutable, manifests derivable, corpus id present.
- **FR-026**: Query-side retrieval (search endpoints, ranking, fusion) is OUT of scope —
  the retrieval spec's job. This feature's obligation ends at correctly indexed,
  traceable passages.

- **FR-027**: This feature MUST ship a minimal operator surface in the web app: an
  upload form (file and ZIP) and a claim-ticket status view showing job status and the
  per-stage event history. It is deliberately bare — the full Records/observability
  surface remains a later spec — but the end-to-end journey (submit → watch → indexed)
  MUST be completable by a human without command-line tools. [Resolved 2026-07-06:
  operator chose minimal UI in 008.]

- **FR-028**: The shipped ingester lineup for this cycle is: **D&D Beyond saved-HTML/ZIP**
  (flagship), **Markdown/plain text** (fallback), and **generic HTML** (fallback), plus
  the synthetic demonstration plugin used by the conformance suite (SC-007).
  Archived-webpage and EPUB ingesters are explicitly deferred as fast-follow plugins
  against the same contract — the conformance suite MUST be sufficient for them to be
  added without pipeline-core changes. [Resolved 2026-07-06: operator chose the reduced
  first slice.]

### Key Entities

- **Corpus**: The named collection all sources and passages belong to. Exactly one is
  live in v3, but every source and passage carries its corpus id (D4 door-stays-open).
- **Source Archive**: The immutable, content-addressed record of uploaded bytes — the
  permanent "what went in." Never modified, never deleted by this feature.
- **Source**: One ingestible unit (a file, or one entry of a batch) and its lifecycle:
  fingerprint, originating batch, owning plugin + version, detection decision, current
  derived-content generation.
- **Batch**: A multi-source submission (ZIP) grouping sources for shared progress and
  per-entry outcomes.
- **Ingestion Job**: The queued unit of asynchronous work for a source (or batch),
  with status, claim ticket, and stage progression.
- **Ingestion Event**: One append-only record of a stage transition or notable outcome
  on a job — the legible history.
- **Normalized Document**: The pivotal in-pipeline contract: ordered, classified
  sections with section paths, source anchors, and display artifacts. Produced by
  plugins, consumed by everything downstream.
- **Section**: An ordered span of a normalized document with a kind (prose, stat block,
  table, spell entry, unclassified), heading path, and source anchor.
- **Passage (Chunk)**: A retrieval-sized unit derived from sections by pipeline-owned
  chunking; deterministic identity; indexed for semantic and keyword search; records
  source, anchor, plugin version, embedding-model identity, corpus id.
- **Plugin Registration**: The record of an available ingester: identity, version,
  detection capability, conformance status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An operator can submit a supported D&D Beyond fixture export through the
  web surface and, with no further intervention or command-line tools, watch it reach
  "indexed" — with 100% of its resulting passages traceable to a source anchor that
  opens the right place in the archived original.
- **SC-002**: Upload acceptance (submit → claim ticket) completes in under 2 seconds for
  any file within the configured size limit, independent of how long processing takes.
- **SC-003**: Submitting identical content twice produces exactly zero duplicate
  sources and zero duplicate indexed passages, and the operator is told why.
- **SC-004**: Killing and retrying an in-flight ingestion job at any stage produces an
  index state identical to an uninterrupted run (verified by comparing deterministic
  passage identities).
- **SC-005**: 100% of unsupported-type submissions are refused at the door with a
  cause-specific reason and leave zero residue (no job, no archive entry).
- **SC-006**: For every job ever run, the operator can retrieve its complete per-stage
  event history, including at least: each stage's start/completion/failure and any
  per-entry skip reasons for batches.
- **SC-007**: A demonstration plugin for a new synthetic format can be added by writing
  only plugin code + fixtures + registration — a reviewer can verify zero lines of
  pipeline-core change in the diff — and it passes the same conformance suite as the
  shipped ingesters.
- **SC-008**: Given a plugin version bump, the system lists exactly the sources produced
  by the prior version, and re-ingesting them yields no duplicate passages and no
  modified archives.
- **SC-009**: On the D&D Beyond fixture set, zero stat blocks or tables are split across
  passage boundaries by default chunking.
- **SC-010**: All shipped ingesters pass the shared conformance suite in the standard
  verification run; the suite runs against fixtures only (no proprietary content in the
  repository).

## Assumptions

- **Plugin packaging is in-tree for v3**: plugins are registered in-repo modules against
  the shared contract package; a runtime discovery/distribution mechanism is deliberately
  deferred (doc 08 question answered by the boring-infrastructure default, D12-era
  reasoning; revisiting it later is additive).
- **No v2 data migrates**: v2 was retired (ADR 0001) and re-ingestion from operator
  archives/re-uploads is the durable-record default (doc 08's stated assumption). This
  spec includes no migration tooling.
- **The pipeline includes chunk/embed/index**: "ingested" means searchable-and-traceable,
  not merely parsed — per doc 05's pipeline definition. Query-side retrieval remains a
  separate spec (FR-026).
- **One live corpus**: multi-corpus returns only as a future spec; this feature's
  obligation is carrying the corpus id (FR-022).
- **Embedding capacity exists**: the ML sidecar (local embeddings) and/or configured
  provider from the walking skeleton is available; this spec configures and consumes it
  via the named embedding role (D14) but does not redesign it.
- **Sanitized display artifacts serve a future archive viewer**: this feature produces
  and stores them (FR-017) but the viewer UI belongs to a later spec. The minimal
  operator surface (FR-027) shows job status and events only, not archive contents.
- **Deferred ingesters stay cheap**: archived-webpage and EPUB arrive as fast-follow
  plugins; the conformance suite (FR-015) is the mechanism that keeps them
  pipeline-core-untouched (SC-007 proves it in this cycle).
- **Fixtures**: all D&D Beyond-shaped fixtures are synthetic look-alikes exercising the
  same structures (stat blocks, tables, spell entries) without any proprietary text
  (Principle I).
