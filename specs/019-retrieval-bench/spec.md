# Feature Specification: Retrieval benchmark

**Feature Branch**: `task-0029-retrieval-bench`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "Benchmark system: retrieval quality across embedding models and
strategies (TASK-0029). A fixed SRD corpus and question set with expected source passages are
committed. One command runs a matrix over embedding model, dimension, chunking strategy, and
retrieval mode. Each run reports recall@k, MRR, latency, and embedding cost in a comparable
table. Results are stored with config and commit so runs compare over time. A small
fake-provider case runs on every commit and fails on a recall regression; the full matrix runs
on demand." Direction: doc-0001 "Added requirement: benchmarks", decision-0002 (dim 1024; model
choice revisited with these results), decision-0003 (SRD 5.1 CC-BY-4.0 text only).

## User Scenarios & Testing *(mandatory)*

The users are the operator, who picks the embedding model, chunk size, and default retrieval
mode by measurement (decision-0002, doc-0001), and CI, which must catch a change that quietly
makes retrieval worse (constitution V: "a retrieval regression fails the build").

### User Story 1 - Compare configurations on one fixed corpus (Priority: P1)

The operator runs one command. It loads the committed SRD corpus and question set, runs every
cell of a matrix (embedding model × dimension × chunking strategy × retrieval mode), and prints
one table with the same metrics for every cell.

**Why this priority**: this is the requirement itself. Without it, the model and mode choices
stay assumptions.

**Independent Test**: run the command with the committed CI matrix (no network, no key). It
prints one row per cell with recall@1, recall@5, recall@10, MRR, latency p50/p95, embed tokens,
and cost.

**Acceptance Scenarios**:

1. **Given** the committed corpus, questions, and a matrix with two chunking strategies and
   three modes, **When** the operator runs the command, **Then** the table has one row per
   (model, dim, chunking, mode) cell, and `fts` rows appear once per chunking strategy.
2. **Given** a matrix naming an embedding purpose that `AI_PURPOSES` does not declare, **When**
   the command starts, **Then** it exits nonzero before any database write or provider call and
   names the purpose.
3. **Given** a matrix that lists a non-fake provider, **When** the operator runs the command
   without the paid-run flag, **Then** it prints the token and cost estimate and exits nonzero
   without calling the provider.

### User Story 2 - Catch a recall regression on every commit (Priority: P1)

CI runs a small matrix with a deterministic, network-free embedding. It compares recall to a
committed baseline and fails the build when recall drops past the threshold.

**Why this priority**: constitution V makes this a gate, and the card names it (AC #5).

**Independent Test**: lower a committed baseline value in a scratch edit; the suite stays green.
Raise it past the tolerance; the suite fails and names the cell and both values.

**Acceptance Scenarios**:

1. **Given** the committed CI matrix and baseline, **When** `pnpm test` runs with
   `REQUIRE_DATABASE=1`, **Then** the case runs (never skips) and passes.
2. **Given** a change that drops any cell's recall@5 by more than one question's worth, **When**
   CI runs, **Then** the case fails with the cell, the baseline, and the measured value.
3. **Given** a change that improves recall, **When** CI runs, **Then** the case passes and prints
   a notice that the baseline can be raised.

### User Story 3 - Compare runs over time (Priority: P2)

Every run writes one results file holding the matrix config, the commit, the corpus and
question hashes, and every row. A report command merges stored runs into one table.

**Why this priority**: decision-0002 says the model choice is revisited with these results.
A result that cannot be traced to its config and commit cannot settle that.

**Independent Test**: run the CI matrix twice at two commits; the report prints both runs'
rows side by side, each with its commit and date.

**Acceptance Scenarios**:

1. **Given** a finished run, **When** the operator lists the results directory, **Then** one new
   JSON file exists, named by date, short commit, and run id, and it validates against the
   results schema.
2. **Given** results files from runs over different corpus hashes, **When** the report runs,
   **Then** it groups rows by corpus hash so rows over different corpora are never mixed.

### Edge Cases

- An expected quote occurs zero times, or more than once, in its corpus document: the loader
  fails before any run and names the question id.
- A chunking strategy splits an expected passage across two chunks: either chunk counts as a
  hit when it overlaps at least half the quote (research R4).
- A question has two acceptable passages: a hit on either counts.
- A dimension below 1024 is requested for a model: the vectors are truncated and renormalized,
  and the row records the method `truncate` (research R5).
- A dimension above 1024 is requested: config validation rejects it (schema is `vector(1024)`).
- The bench database name equals the app database name: the command refuses to run.
- An unpriced model: cost prints `unpriced`, never `0`.
- `fts` mode: zero embed calls, zero question-embed cost.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repo MUST commit a fixed corpus of SRD 5.1 text as Markdown under
  `apps/server/bench/retrieval/corpus/`, with an `ATTRIBUTION.md` carrying the CC-BY-4.0 statement, the
  source URL, and the source PDF's sha-256. Total corpus size MUST stay at or under 400 KB.
- **FR-002**: The repo MUST commit a question set of at least 50 questions. Each question names
  one or more expected passages as an exact quote from one corpus document.
- **FR-003**: At least half the questions MUST be paraphrases that avoid the expected passage's
  key terms, so the set does not favor keyword search.
- **FR-004**: A retrieved passage MUST count as a hit when it comes from the expected document
  and its span overlaps the expected quote's span by at least half the quote's length.
- **FR-005**: One command (`pnpm bench:retrieval run --matrix <file>`) MUST run every cell of the
  matrix: embedding model × dimension × chunking strategy × retrieval mode.
- **FR-006**: Each row MUST report recall@1, recall@5, recall@10, MRR@10, retrieval latency p50
  and p95 in ms, corpus embed tokens and cost, and question embed tokens and cost.
- **FR-007**: Cost MUST come from the gateway's usage records. An unpriced model MUST report
  `null` cost, printed as `unpriced`.
- **FR-008**: Each run MUST write one JSON results file under `apps/server/bench/retrieval/results/` holding
  the schema version, run id, start time, commit sha, dirty flag, corpus hash, question-set
  hash, the full matrix config, and every row.
- **FR-009**: `pnpm bench:retrieval report` MUST print one table over all stored results, grouped
  by corpus hash.
- **FR-010**: The bench MUST store chunks with `storeParsedBook` and vectors with
  `attachEmbeddings` in a dedicated bench database. It MUST NOT enqueue ingestion jobs.
- **FR-011**: The command MUST refuse any matrix with a non-fake provider unless `--allow-paid`
  is passed, and MUST print a token and cost estimate first. `--dry-run` MUST print the
  estimate and exit without a database write or provider call.
- **FR-012**: A per-commit case MUST run inside `pnpm test` with the built-in hash embedding,
  compare to a committed baseline, and fail when any cell's recall@5 falls more than one
  question below baseline.
- **FR-013**: Dimensions MUST be 1024 or lower. Below 1024, vectors MUST be truncated to the
  first d components, L2-renormalized, and zero-padded to 1024.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): An agent MUST drive the bench through the same CLI and the same
  exported `runMatrix` function a human or CI uses.
- **CR-003** (V. Citations): The bench measures whether retrieval returns the passage a citation
  needs. It MUST score on stored anchors, never on generated text.
- **CR-004** (VI. System-agnostic): The harness MUST NOT assume 5e. The SRD corpus is data; the
  code takes any Markdown corpus.
- **CR-005** (VIII. Operator-owned content): The committed corpus MUST be SRD 5.1 text only.
  Nothing from the operator's exports or `fixtures/private/` may be committed. Results files
  MUST NOT carry corpus or passage text; they hold ids, spans, and numbers only.

### Key Entities

- **Corpus document**: one SRD Markdown file, parsed with `parseMarkdown` into a `ParsedBook`.
- **Question**: id, question text, one or more expected passages (document + exact quote).
- **Matrix config**: models (purpose or built-in hash) with their dims, chunking strategies,
  modes, and k values.
- **Bench run**: one execution of a matrix, with provenance and rows.
- **Baseline**: the committed recall floor for the CI matrix.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The CI matrix finishes in under 60 seconds on the CI runner.
- **SC-002**: Two runs of the CI matrix at the same commit produce recall values within one
  question of each other.
- **SC-003**: A results file from any run traces to its exact commit, corpus hash, and config.
- **SC-004**: A paid run never starts without an explicit flag and a printed estimate.
- **SC-005**: No committed file under `bench/` contains non-SRD rulebook text.

## Assumptions

- The CI Postgres role can create a database (it is the `POSTGRES_USER` superuser). Local stacks
  from `pnpm env:up` grant the same.
- Truncation is a fair proxy for a smaller native dimension on Matryoshka-trained models. The
  operator lists sub-1024 dims only for such models.
- The existing chunker (`chunkBook` with `maxChars`) is the only chunking strategy family in
  scope. A new strategy is a later card.
- Latency is comparable only within one run on one host.

## Clarifications

None asked. The card, doc-0001, decisions 0002/0003, and the runbook settle every open point;
each design call is recorded with its rationale in research.md.
