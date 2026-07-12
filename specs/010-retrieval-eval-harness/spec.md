# Feature Specification: Retrieval & Evaluation Harness

**Feature Branch**: `010-retrieval-eval-harness`

**Created**: 2026-07-11

**Status**: Draft

**Input**: User description: "Retrieval and evaluation harness for the ingested corpus. Query-side retrieval: given an operator's query, return the most relevant indexed passages (chunks) using hybrid search — Postgres full-text and pgvector similarity over the same rows, fused into one ranked list, with an optional reranking stage served by the ML sidecar. Every retrieval is a durable, replayable record. Retrieval runs are operator-visible. Retrieval only reads the current generation of each source. This spec ships NO chat — the deliverable is the engine plus the evaluation program that justifies its tuning: gold-set construction protocol, pinned metric definitions, deterministic eval slices per-PR, model-backed slices on demand, findings as durable reports + ADRs."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search the library and get cited passages (Priority: P1) 🎯 MVP

The operator types a question or phrase into a search surface and gets back a ranked
list of passages from their own ingested material. Each result shows the passage text,
which source it came from, where in that source it sits (its anchor), and why it
ranked where it did (its scores). Clicking a result leads to the source's detail view.
Both retrieval signals contribute: exact-term matches (a rulebook term like "grapple")
and meaning matches (a paraphrase like "holding an enemy in place") both surface the
right passages, fused into one honest ranking.

**Why this priority**: This is the product's reason to exist — the first moment the
operator's uploaded library answers a question. Every later capability (receipts,
evals, Quick Ask, Conversations) consumes this engine. Without it there is nothing to
record, measure, or cite.

**Independent Test**: Ingest the synthetic fixture corpus, search for a term that
appears verbatim in one fixture and a paraphrase whose meaning matches another; both
searches return the expected passage ranked in the top results, with source
attribution and anchors present.

**Acceptance Scenarios**:

1. **Given** an ingested corpus, **When** the operator searches a term that appears
   verbatim in exactly one passage, **Then** that passage appears at or near the top,
   attributed to its source with a working link to the source's detail view.
2. **Given** an ingested corpus, **When** the operator searches a paraphrase that
   shares no keywords with the target passage, **Then** the meaning-matched passage
   still appears in the top results (the vector signal carried it).
3. **Given** a source that was re-ingested (generation flipped), **When** the operator
   searches, **Then** only current-generation passages appear — never a mix of old and
   new text from the same source.
4. **Given** a query that matches nothing, **When** the operator searches, **Then**
   they get an honest empty state — not an error, not filler results.

---

### User Story 2 - Every search is a receipt (Priority: P2)

Every retrieval — whoever or whatever triggered it — leaves a durable record: the
query as asked, the configuration used (signal weights, result count, reranker
on/off), and the exact passages returned with their scores and ranks. The operator can
list past retrieval runs and open any one of them at its own URL, reachable through
the product's navigation. Opening a months-old run still shows what was returned then,
even if sources have since been re-ingested — the record is a receipt, not a live
query.

**Why this priority**: Citations are receipts (Principle III) — the whole chat roadmap
rests on answer → run → chunk traceability. Building the record structure after chat
exists would mean retrofitting provenance; building it now means Quick Ask lands on a
surface that already proves what the model saw.

**Independent Test**: Perform a search, find its run in the records list, open its
URL; re-ingest the searched source (flipping its generation), reopen the same URL —
the recorded passages still display with their text-at-retrieval-time, flagged as
superseded where applicable.

**Acceptance Scenarios**:

1. **Given** any completed search, **When** the operator opens the retrieval records
   list, **Then** the run appears with its query, timestamp, configuration, and result
   count, and links to a URL-addressable detail view.
2. **Given** a retrieval run whose source was later re-ingested, **When** the operator
   revisits the run's detail view, **Then** every recorded passage still renders (from
   the run's own snapshot) and passages whose live counterpart was swept are visibly
   marked as superseded.
3. **Given** a retrieval run, **When** the operator inspects a single result, **Then**
   they can see each signal's contribution (text score, vector score, fused rank, and
   rerank position if reranking ran).

---

### User Story 3 - Build a gold set from my own corpus (Priority: P3)

The operator curates evaluation questions against their own library: each gold item is
a question plus the passage(s) that should answer it, selected from real search
results or from a source's passage list. The protocol enforces a labeling standard
(what counts as "expected"), and the set is split into a tuning slice and a held-out
slice so configuration choices can't overfit the questions they were tuned on.

**Why this priority**: The eval program is only as honest as its labels. A gold set
must exist before any metric means anything — but it needs US1's search surface to
author labels efficiently, so it follows the engine.

**Independent Test**: Author gold items through the UI against the fixture corpus,
verify each stores the question, expected passages, and split assignment; verify the
held-out split is excluded from tuning-slice metrics.

**Acceptance Scenarios**:

1. **Given** search results for a question, **When** the operator marks a passage as
   the expected answer, **Then** a gold item is created linking the question to that
   passage's durable identity.
2. **Given** a gold set, **When** items are added, **Then** each is assigned to the
   tuning or held-out split per the protocol, and the split is visible on the item.
3. **Given** a gold item whose expected passage's source was re-ingested, **When** the
   gold set is listed, **Then** the item flags that its expected passage needs
   re-confirmation rather than silently pointing at swept data.

---

### User Story 4 - Measure before choosing (Priority: P4)

The operator (or CI) runs the evaluation harness: it executes every gold-set question
against a named retrieval configuration and reports pinned metrics — recall@k, MRR,
nDCG — per slice (tuning vs held-out). Two configurations can be compared side by
side, one variable at a time. Every eval run is itself a durable record, and a finding
that justifies a configuration choice becomes a durable report the repo keeps. A
deterministic slice of the harness runs without any model calls so CI can execute it
on every PR; model-backed slices run on demand.

**Why this priority**: D11 makes eval-justified choice a constitutional requirement —
fusion weights, k values, and reranker adoption must cite measurements, not vibes. It
needs US1 (an engine to measure) and US3 (labels to measure against).

**Independent Test**: Run the harness over the fixture gold set under two named
configurations; both eval runs record per-metric, per-slice results; the comparison
view shows them side by side; the deterministic slice completes in CI with no network
or model dependency.

**Acceptance Scenarios**:

1. **Given** a gold set and a named configuration, **When** an eval run executes,
   **Then** it records recall@k, MRR, and nDCG per slice, with the configuration
   pinned in the run record.
2. **Given** two eval runs over the same gold set, **When** the operator compares
   them, **Then** metric deltas are shown per slice and the changed variable is
   identifiable from the two pinned configurations.
3. **Given** the deterministic eval slice, **When** CI executes it on a PR, **Then**
   it completes without model calls and fails the build if retrieval correctness
   regresses below the pinned floor.

---

### User Story 5 - Sharpen the ranking with a reranker (Priority: P5)

The operator can enable a reranking stage: the fused candidate list is re-ordered by a
dedicated model served from the inference sidecar before results are returned. The
reranker is a named, environment-configured model role like every other model in the
system; turning it on or off is configuration, and whether it stays on is an eval
question (US4), not a default.

**Why this priority**: Reranking is the highest-leverage quality lever after fusion,
but it is meaningless without the harness to prove it earns its latency — so it lands
last, already inside the measurement loop.

**Independent Test**: With the sidecar serving a reranking model, run the same query
with reranking off and on; the run records show the stage's input order, output order,
and per-passage rerank scores; the eval harness reports the metric delta.

**Acceptance Scenarios**:

1. **Given** reranking enabled, **When** a search runs, **Then** the run record shows
   both the pre-rerank and post-rerank orderings and the reranker's model identity.
2. **Given** the sidecar unreachable or the reranking model not loaded, **When** a
   search with reranking enabled runs, **Then** the search fails honestly with a
   dependency error — it never silently degrades to the unreranked order — and the
   operator-visible message says which stage failed.
3. **Given** reranking disabled by configuration, **When** a search runs, **Then** no
   sidecar call is made and the run record marks the stage as skipped.

---

### Edge Cases

- Empty corpus: search returns the honest empty state with a pointer to the upload
  surface, and the run is still recorded.
- Query embedding unavailable (sidecar down, embedding model not loaded): the search
  fails with a typed dependency error; it MUST NOT silently fall back to text-only
  results (hidden fallback is forbidden — if a degraded text-only mode is ever
  offered, it must be explicit in the request and stamped on the run record).
- Embedding-space mismatch: if the query embedding's model/dimensions differ from
  what's stamped on the index rows, the mismatch is structurally detected and the
  search refuses with an operator-actionable message (Principle VII) rather than
  comparing incompatible vectors.
- A source is re-ingested between the search and the operator clicking a result: the
  result's deep link resolves to the source detail view, which shows current state;
  the run record itself keeps the snapshot.
- Gold item whose expected passage was swept by re-ingestion: flagged for
  re-confirmation (US3); eval runs report it as unresolvable rather than scoring it as
  a miss silently.
- Very long queries: clamped at a documented limit with an honest validation error
  beyond it, never truncated silently.
- Concurrent eval runs: each run's record is independent; runs never share or mutate
  each other's state.

## Requirements *(mandatory)*

### Functional Requirements

**Retrieval engine**

- **FR-001**: The system MUST answer a query with a ranked list of passages drawn
  from the ingested corpus, combining a text-match signal and a semantic-similarity
  signal over the same passage store into a single fused ranking.
- **FR-002**: Retrieval MUST read only current-generation passages (the reader
  predicate): a source mid-re-ingest never yields mixed-generation results.
- **FR-003**: Each result MUST carry source attribution (which source, which location
  anchor within it), its passage text, and its per-signal scores plus fused rank.
- **FR-004**: The fusion strategy and its parameters (signal weights or fusion
  method, candidate depth, returned k) MUST be a named configuration, resolvable
  without code changes; the shipped default MUST be justified by an eval report
  before this spec closes.
- **FR-005**: The query's semantic embedding MUST be produced by the same
  environment-configured embedding role the index was built with, and a
  model/dimension mismatch between query and index MUST be detected and refused,
  never silently compared.
- **FR-006**: Search MUST be available in the web UI, reachable through the
  product's navigation (Principle V), and MUST NOT be callable from the browser
  except through the product's own server layer.

**Receipts**

- **FR-007**: Every retrieval (operator-initiated or harness-initiated) MUST create
  a durable retrieval-run record capturing: the query text, the full configuration
  used, every result's passage identity, snapshot text, anchors, scores, and ranks,
  and the run's timing.
- **FR-008**: Retrieval-run records MUST be append-only: no update or delete path
  exists in the product for them.
- **FR-009**: A retrieval-run record MUST remain fully renderable after any
  re-ingestion: it snapshots what it returned (passage text and identity at
  retrieval time) and marks passages whose live counterparts are gone as superseded.
- **FR-010**: Retrieval runs MUST be operator-visible: a records list and a
  URL-addressable per-run detail view, both reachable by navigation.

**Gold sets**

- **FR-011**: The operator MUST be able to create gold items — a question plus one
  or more expected passages selected from the corpus — through the product UI.
- **FR-012**: Gold items MUST follow the labeling standard: an expected passage is
  one whose text alone answers the question (not merely mentions its topic); the
  standard MUST be visible at authoring time.
- **FR-013**: The gold set MUST maintain a tuning/held-out split; the split
  assignment is recorded per item, and held-out items are excluded from any metric
  used to choose between configurations (they exist to validate the final choice).
- **FR-014**: Gold items MUST reference expected passages by durable identity and
  flag themselves for re-confirmation when re-ingestion sweeps the referenced
  passage.

**Evaluation harness**

- **FR-015**: The harness MUST execute a gold set against a named retrieval
  configuration and record recall@k, MRR, and nDCG per slice in a durable eval-run
  record; metric definitions are pinned in the spec's contracts and MUST NOT vary
  between runs.
- **FR-016**: Two eval runs MUST be comparable side by side with per-metric,
  per-slice deltas.
- **FR-017**: A deterministic eval slice MUST run with no model calls and no network
  beyond the database, using a committed synthetic fixture corpus with
  deterministic embeddings, and MUST be wired into CI to fail the build when its
  pinned correctness floor regresses.
- **FR-018**: Model-backed eval slices MUST be runnable on demand (never required
  for CI), and their runs recorded like any other.
- **FR-019**: A finding that justifies a configuration choice MUST be recordable as
  a durable report in the repository, and the shipped default configuration MUST
  cite one.

**Reranking**

- **FR-020**: A reranking stage MUST be available behind configuration: candidates
  from fusion are re-ordered by a dedicated model role served by the inference
  sidecar; the role is environment-configured with no hardcoded model identity.
- **FR-021**: When reranking is enabled and its dependency is unavailable, the
  search MUST fail with a typed dependency error; silent degradation to the
  unreranked order is forbidden.
- **FR-022**: Run records MUST capture the reranking stage's input ordering, output
  ordering, per-passage scores, and the model identity used — or that the stage was
  skipped by configuration.

**Boundaries**

- **FR-023**: This spec ships no conversational surface: no answer generation, no
  chat model calls, no citation rendering beyond the run records themselves.
- **FR-024**: All fixture and gold-set material committed to the repository MUST be
  synthetic or explicitly permitted content (Principle I) — never proprietary game
  text.

### Key Entities

- **Retrieval Run**: the receipt for one retrieval — query, configuration, timing,
  and an ordered set of results; append-only; operator-visible at its own URL.
- **Retrieval Result**: one passage's appearance in a run — durable passage
  identity, snapshot text and anchor, per-signal scores, fused rank, rerank score
  and position when applicable, superseded flag derived at view time.
- **Retrieval Configuration**: a named, environment-resolvable bundle of fusion
  method/parameters, candidate depth, returned k, and reranker on/off + role.
- **Gold Item**: a question, its expected passage identities, split assignment
  (tuning/held-out), authoring metadata, and a needs-reconfirmation flag.
- **Eval Run**: the receipt for one harness execution — gold set version, named
  configuration, per-slice metric results, and per-item hits/misses.
- **Eval Report**: a durable, repo-committed document recording a finding that
  justifies a configuration choice, referencing the eval runs that support it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the fixture corpus, a verbatim-term query and a paraphrase query
  each place their expected passage in the top 5 results (proving both signals and
  fusion work end to end).
- **SC-002**: 100% of retrievals — interactive or harness-driven — leave an
  inspectable run record; a sampled run's detail view renders completely after its
  source is re-ingested, with superseded passages marked.
- **SC-003**: An operator can go from typing a query to seeing ranked, attributed
  results in under 2 seconds on the reference corpus (the fixture set plus a
  realistically sized library).
- **SC-004**: The deterministic eval slice runs on every PR with zero model calls
  and fails the build when its pinned floor regresses (demonstrated once by
  deliberately breaking retrieval on a scratch branch).
- **SC-005**: The shipped default retrieval configuration is traceable to a
  committed eval report comparing at least two configurations over a gold set of at
  least 30 questions, with held-out metrics reported alongside tuning metrics.
- **SC-006**: With reranking toggled, the eval harness reports the metric delta;
  the decision recorded for the default (on or off) cites that measurement.

## Assumptions

- **Two corpora serve two jobs**: the operator's live corpus backs interactive
  search and their own gold sets; a small committed synthetic fixture corpus (with
  deterministic, model-free embeddings) backs the per-PR deterministic slice. Gold
  sets over the operator's corpus live in their database, never in the repo
  (Principle I).
- **Run records snapshot result text**: the passage text-at-retrieval-time is
  stored on the run so receipts outlive generation sweeps. Storage cost is accepted
  as the price of Principle III; runs are records, not caches.
- **Retrieval scope is passages**: results are chunk-level with anchors into their
  source; whole-document retrieval and answer synthesis are later specs.
- **Single-operator auth (D13)** covers all new surfaces; no per-user gold sets or
  sharing.
- **Query embedding is computed at search time** via the existing embedding role
  and sidecar; embedding latency is inside the SC-003 budget.
- **The eval harness runs where the product runs** (operator machine or CI); no
  external eval service, no telemetry leaves the machine.
- **Fusion candidates**: the plan phase evaluates reciprocal-rank fusion vs
  weighted score fusion (the grounding's open question) and the choice ships
  eval-justified per FR-004/SC-005.
