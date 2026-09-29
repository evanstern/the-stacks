# Feature Specification: Hybrid retrieval

**Feature Branch**: `task-0026-hybrid-retrieval`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "Hybrid retrieval per architecture A9 (TASK-0026). Given a question,
find the library passages most likely to answer it, by meaning (vector), by keyword (full-text),
or both fused together. Retrieval mode is configurable so the retrieval benchmark (TASK-0029) can
compare modes on the same corpus. Hybrid fuses both result lists with a documented rank-fusion
method. Every result carries its chunk anchor — book, section, and exact quote span — so the
rules answerer (TASK-0027) can cite it. Out of scope: ingestion and chunking (TASK-0024), the
answer route and prompt (TASK-0027), the benchmark harness and corpus (TASK-0029)."

## User Scenarios & Testing *(mandatory)*

The "users" of this feature are two components. The rules answerer (TASK-0027) asks a question
and turns the passages it gets back into a cited answer. The retrieval benchmark (TASK-0029) asks
the same questions under each retrieval mode and compares which passages come back. The operator
benefits through them: answers point at the page they came from, and the default mode is chosen
by measurement rather than by assumption (doc-0001's benchmark requirement).

### User Story 1 - Ask a question, get cited passages back (Priority: P1)

A caller hands retrieval a natural-language question. Retrieval returns an ordered list of the
most relevant stored passages. Each passage carries everything needed to cite it: the book, the
section path, the passage's exact text, and its character span in the book.

**Why this priority**: Constitution V says every rules claim carries a source anchor. The
answerer cannot cite what retrieval does not return. This is card AC #3 and the MVP.

**Independent Test**: Store a synthetic fixture book. Ask a question containing a word that
appears in exactly one passage. That passage comes back first, and slicing the stored book text
by its returned span reproduces its returned text exactly.

**Acceptance Scenarios**:

1. **Given** a stored book, **When** a question matches one of its passages, **Then** that
   passage is returned with its book name, section path, exact text, and start/end span.
2. **Given** any returned passage, **When** the stored book text is sliced by its span, **Then**
   the result equals the returned text exactly.
3. **Given** a question that matches nothing in the library, **When** retrieval runs, **Then** it
   returns an empty list rather than an error or unrelated filler.
4. **Given** an empty or whitespace-only question, **When** retrieval runs, **Then** it is
   refused as invalid input before any search or model call.

---

### User Story 2 - Choose the retrieval mode by configuration (Priority: P1)

The deployment chooses one of three modes: meaning-only (vector), keyword-only (full-text), or
both fused (hybrid). A caller may override the mode for a single request, so one benchmark run
can compare all three against the same corpus without restarting anything.

**Why this priority**: Card AC #1. The benchmark (TASK-0029) depends on it, and decision-0002
says model and mode choices are settled by measurement.

**Independent Test**: With the deployment default set to each mode in turn, run the same
question. Vector mode returns passages ranked by meaning only. Full-text mode returns passages
ranked by keyword only and makes no model call. A per-request override beats the default.

**Acceptance Scenarios**:

1. **Given** the mode is configured as full-text, **When** retrieval runs, **Then** only the
   keyword search runs and no embedding model is called.
2. **Given** the mode is configured as vector, **When** retrieval runs, **Then** only the meaning
   search runs, using vectors from the same embedding model that embedded the question.
3. **Given** vectors from two embedding models are stored, **When** a vector search runs,
   **Then** only vectors from the question's embedding model are compared.
4. **Given** a configured default mode, **When** a request names a different mode, **Then** the
   request's mode is used for that request only.
5. **Given** an unrecognized mode in configuration, **When** configuration loads, **Then** it
   fails with a message naming the setting and the allowed values.

---

### User Story 3 - Hybrid fuses both lists by a documented method (Priority: P1)

In hybrid mode, retrieval runs both searches and merges their ranked lists into one list using a
named, documented rank-fusion method. A passage both searches agree on ranks above a passage
only one of them found. A passage only one search found is still eligible.

**Why this priority**: Card AC #2. Rules questions often hinge on an exact term ("grappled")
that meaning search can miss, and on paraphrase that keyword search can miss. Hybrid covers both.

**Independent Test**: Arrange a passage found by both searches and passages found by only one.
The shared passage ranks first. Single-list passages still appear. The fused order matches the
documented formula computed by hand.

**Acceptance Scenarios**:

1. **Given** a passage ranked highly by both searches, **When** hybrid runs, **Then** it ranks
   above any passage found by only one search at the same or lower positions.
2. **Given** a passage found only by keyword search, **When** hybrid runs, **Then** it can still
   appear in the results.
3. **Given** two passages with equal fused scores, **When** hybrid runs, **Then** their order is
   the same on every run (deterministic tie-break).
4. **Given** any returned passage, **When** a caller inspects it, **Then** it can see each
   search's rank and score for that passage (or that a search did not find it), so the benchmark
   and the answerer can explain why it ranked where it did.

---

### Edge Cases

- A question made only of stop words ("what is the"): keyword search finds nothing; hybrid still
  returns meaning-search results; full-text mode returns an empty list.
- No vectors stored for the question's embedding model (e.g. the model changed and a re-embed has
  not run): meaning search finds nothing. Hybrid returns keyword results only, and the result
  reports that the meaning search returned zero candidates, so the gap is visible, not silent.
- Vector or hybrid mode with no embedding model configured: the call fails with an error naming
  the missing embedding setting. Retrieval never silently falls back to another mode, because a
  silent fallback would corrupt a benchmark comparison.
- Several books stored: results may come from any book, and each result names its own book.
- Punctuation or search-syntax characters in the question (quotes, `&`, `|`, `!`): treated as
  plain text, never as query syntax, and never an error.
- The same passage returned by both searches appears once in hybrid results, never twice.
- A request for more results than exist: returns all that match, fewer than asked.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Retrieval MUST accept a natural-language question and return an ordered list of at
  most k stored passages, most relevant first.
- **FR-002**: Retrieval MUST support three modes: vector (meaning only), full-text (keyword
  only), and hybrid (both, fused).
- **FR-003**: The default mode and the default result count MUST be set by deployment
  configuration, with documented defaults. A request MAY override either for that request only.
- **FR-004**: Invalid retrieval configuration MUST fail when it is loaded, with a message naming
  the setting.
- **FR-005**: Vector search MUST embed the question through the project's single AI gateway,
  using a configured embedding purpose, and MUST compare it only against stored vectors from the
  same model.
- **FR-006**: Full-text mode MUST NOT call any model.
- **FR-007**: Keyword search MUST match a passage that contains any meaningful term of the
  question (not only passages containing every term), ranked by how well it matches.
- **FR-008**: Hybrid mode MUST fuse the two ranked lists with Reciprocal Rank Fusion, with its
  constant documented, and MUST break ties deterministically.
- **FR-009**: Every returned passage MUST carry: a stable passage id, its document id, the book
  name, its section path, its kind, its exact text, and its start/end span in the book text.
- **FR-010**: Every returned passage MUST carry its fused position, its fused score, and, per
  search, its rank and raw score or an explicit "not found by this search".
- **FR-011**: The result MUST report which mode ran, which embedding model was used (if any),
  and how many candidates each search returned.
- **FR-012**: Retrieval MUST refuse an empty or whitespace-only question as invalid input before
  any search or model call.
- **FR-013**: Retrieval MUST be read-only; it MUST NOT write to the library.
- **FR-014**: The retrieval interface MUST be published as a contract before its internals land,
  so the answerer and the benchmark can build against it.
- **FR-015**: Integration tests MUST run against a real database with the task's own stack and
  MUST NOT silently skip. Tests MUST use the gateway's fake provider, never a network model.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): An agent MUST reach retrieval through the same function the
  answerer and benchmark call; there is no human-only search path.
- **CR-003** (V. Citations): Every returned passage MUST carry book, section path, and exact
  quote span, such that the quoted text is reproducible verbatim from stored data (FR-009).
- **CR-005** (VIII. Operator-owned content): Tests and committed fixtures MUST use original or
  SRD 5.1 text only. Retrieval returns stored text only to the caller serving that operator.
- **CR-006** (III. Three planes): Retrieval MUST live in the library plane and MUST NOT import
  from the codex or session planes. It reads library content and never changes it.
- **CR-007** (IX. Self-hostable): Retrieval MUST work on the existing two-container stack with no
  new service. Every model call MUST pass through the AI gateway.

### Key Entities

- **Retrieval request**: the question, and optional per-request overrides of mode and result
  count.
- **Retrieved passage**: one stored chunk as returned — id, document id, book, section path,
  kind, exact text, span, fused rank and score, and per-search rank and score.
- **Retrieval result**: the mode that ran, the embedding model used (if any), candidate counts
  per search, and the ordered passages.
- **Retrieval configuration**: the default mode, default result count, and which embedding
  purpose embeds questions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For 100% of passages returned in tests, slicing the stored book text by the
  returned span reproduces the returned text exactly.
- **SC-002**: Each of the three modes is selectable by configuration and by per-request
  override, proven by a test per mode.
- **SC-003**: In full-text mode, zero model calls are made (asserted by the fake provider's call
  count).
- **SC-004**: A hand-computed fusion over a fixed pair of ranked lists matches the hybrid output
  order and scores exactly.
- **SC-005**: Running the same question twice against the same data returns the identical
  ordered list.
- **SC-006**: Retrieval's integration tests run (0 skipped) in CI and on the task's own stack.

## Assumptions

- The keyword-search language is English, matching the stored search data (spec 013).
- Distance for meaning search is cosine, matching the existing vector index (spec 013 R2).
- The existing storage (keyword-search data, both indexes, per-model vectors) is sufficient; this
  feature adds no schema change.
- Retrieval is a function inside the server, not an HTTP route. The answerer (TASK-0027) exposes
  the operator-facing route.
- "Nothing relevant" for the answerer's refusal (TASK-0027 AC #3) is judged by the answerer from
  the per-search scores this feature returns. Retrieval itself applies no relevance cut-off
  beyond "matched at all".
- Filtering by book is not required yet. It is added when a caller needs it.
- Recall regression gating in CI belongs to the benchmark (TASK-0029), which calls this feature.
