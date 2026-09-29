# Feature Specification: Library schema

**Feature Branch**: `task-0022-library-schema`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "The library plane's storage (TASK-0022). Imported reference books
(e.g. a D&D Beyond export already parsed into ordered, anchored blocks) must be stored so they
can be searched by meaning and by keyword, and every result can be cited back to its exact
source passage. Migrations create documents, chunks, and embeddings tables with a 1024-dimension
vector column; every embedding stores the model and dimension that produced it; chunks carry a
full-text search column with a GIN index and embeddings carry a vector index; chunks store
source anchors (book, section path, character span). Library is immutable after ingestion; a
re-import replaces a document wholesale. Out of scope: ingestion jobs and upload (TASK-0024),
chunking strategy (TASK-0024), retrieval queries (TASK-0026)."

## User Scenarios & Testing *(mandatory)*

The "users" of this feature are the two components that sit on either side of it: the
ingestion pipeline (TASK-0024), which writes a parsed book into the library, and the retrieval
path (TASK-0026) plus the rules-answerer (TASK-0027), which read it back and cite it. The
operator benefits indirectly: every answer they get can be traced to the page it came from.

### User Story 1 - Store a parsed book with verifiable anchors (Priority: P1)

Ingestion hands the library one parsed book: its full normalized text and an ordered list of
chunks, each with a kind, a section path, and a character span into that text. The library
stores the book once and each chunk once, in order, so that any stored chunk can later be
traced back to the exact passage it came from.

**Why this priority**: Citations (constitution V) are impossible without stored anchors. Every
later M1 task (ingestion, retrieval, answering, the click-through UI) builds on this shape.

**Independent Test**: Store a book built from the parser's synthetic fixtures; read every chunk
back; confirm that slicing the stored book text by each chunk's stored span returns exactly the
chunk's stored text, and that the section path and order match what was written.

**Acceptance Scenarios**:

1. **Given** a parsed book with N blocks, **When** it is stored, **Then** one document and N
   chunks exist, in the original order, each carrying book, section path, start, end, and kind.
2. **Given** a stored chunk, **When** its document's text is sliced from start to end, **Then**
   the result equals the chunk's text exactly.
3. **Given** a chunk whose span is empty, reversed, or reaches past the end of the book text,
   **When** it is stored, **Then** the store is refused and nothing from that book is kept.
4. **Given** a document that already exists under the same book name, **When** the same book is
   stored again, **Then** the new version replaces the old one wholesale — no chunk from the old
   version survives, and no reader ever sees a mix of the two.

---

### User Story 2 - Keyword search is ready on every chunk (Priority: P1)

Every stored chunk is searchable by the words it contains, without a separate indexing step
that ingestion could forget to run.

**Why this priority**: Hybrid retrieval (TASK-0026) needs keyword search from day one; rules
questions often hinge on an exact term ("grappled", "opportunity attack") that meaning-based
search can miss.

**Independent Test**: Store a book; search stored chunks for a term that appears in exactly
one of them; that chunk is found, and the search is served by an index rather than a full scan.

**Acceptance Scenarios**:

1. **Given** a stored chunk containing a word, **When** chunks are searched for that word,
   **Then** the chunk is returned.
2. **Given** a chunk is stored, **When** nothing else runs, **Then** its keyword-search data is
   already populated (derived from its text automatically, never written separately).

---

### User Story 3 - Embeddings from more than one model coexist (Priority: P2)

Each chunk can carry a meaning vector from one or more embedding models. Each vector records
which model made it and how many dimensions it has, so switching models is a re-embed job
rather than a schema change, and the benchmark (TASK-0029) can compare models on the same
chunks.

**Why this priority**: Decision-0002 fixes 1024 dimensions and requires model and dimension per
row. It depends on stored chunks (Story 1) but is independently testable once they exist.

**Independent Test**: Store a book; attach vectors to one chunk from two different model names;
both are kept; a nearest-neighbour search restricted to one model returns only that model's
vectors and is served by an index.

**Acceptance Scenarios**:

1. **Given** a stored chunk, **When** a 1024-dimension vector is attached under model "a" and
   another under model "b", **Then** both are kept, each labelled with its model and dimension.
2. **Given** a vector already stored for a chunk and model, **When** a second vector for the
   same chunk and model is attached, **Then** it is refused (one vector per chunk per model).
3. **Given** a vector whose length is not 1024, **When** it is attached, **Then** it is refused.
4. **Given** a document is replaced or removed, **When** that happens, **Then** its chunks'
   vectors go with it; no vector is left pointing at a chunk that no longer exists.

---

### Edge Cases

- A book whose name differs only in letter case or surrounding spaces from an existing one:
  treated as the same book (names are compared case-insensitively after trimming).
- Two ingestions of the same book racing each other: exactly one version wins; the loser fails
  cleanly; no reader sees a partial or mixed book.
- An attempt to edit a stored chunk's text or span in place (by app code or by an operator in a
  database shell): refused. The only way to change library content is to replace the document.
- A chunk with non-ASCII text (curly quotes, em dashes, accented names): spans still round-trip,
  because spans are counted the same way the parser counts them.
- Very large books (the Monster Manual export parses to ~2,900 chunks; the PHB to ~8,000):
  storing one completes in a single all-or-nothing step.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The library MUST store each imported book as one document holding the book name,
  its full normalized text, and when it was imported. Source-file metadata (original file
  names, size, a content hash) MUST be storable so a re-import of identical content is
  detectable.
- **FR-002**: The library MUST store each chunk with: its document, its position in the book,
  its kind (the parser's block kinds), its section path (ordered list of headings), its text,
  and its character span (start inclusive, end exclusive) into the document text.
- **FR-003**: The library MUST refuse any chunk whose span is not a non-empty, in-bounds range,
  and MUST refuse two chunks with the same position in the same document.
- **FR-004**: The library MUST guarantee that the stored document text sliced by a chunk's span
  equals that chunk's stored text; a store that would break this MUST be refused.
- **FR-005**: Every chunk MUST carry keyword-search data derived automatically from its text,
  backed by an index suited to full-text search.
- **FR-006**: The library MUST store embeddings separately from chunks, one row per chunk per
  model, each holding a 1024-dimension vector, the model name, and the dimension.
- **FR-007**: The library MUST refuse an embedding whose dimension is not 1024, and a second
  embedding for the same chunk and model.
- **FR-008**: Embeddings MUST be searchable by nearest-neighbour similarity through an index,
  restricted to one model at a time.
- **FR-009**: Library content MUST be immutable after ingestion: updates to stored documents,
  chunks, or embeddings MUST be refused at the database level. Deleting a document (as part of
  a wholesale replace or an operator removing a book) MUST remove its chunks and their
  embeddings with it.
- **FR-010**: Replacing a book MUST be all-or-nothing: readers see either the complete old
  version or the complete new version, never a mix.
- **FR-011**: The library MUST expose one write operation that stores a parsed book (document
  plus chunks) and one that attaches embeddings, both usable by ingestion code and by agents
  through the same interface.
- **FR-012**: Schema changes MUST ship as committed, generated migrations applied by the
  existing migration command; integration tests for this feature MUST run against a real
  database with the vector extension and MUST NOT silently skip.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): An agent MUST be able to store a parsed book and attach
  embeddings through the same library write functions ingestion uses (FR-011); there is no
  human-only path.
- **CR-003** (V. Citations): Every stored chunk MUST carry book, section path, and exact
  character span such that the quoted passage can be reproduced verbatim from stored data
  (FR-002, FR-004).
- **CR-005** (VIII. Operator-owned content): Imported text MUST live only in the operator's own
  database volume; tests and committed fixtures MUST use original or SRD 5.1 text only.
- **CR-006** (III. Three planes): Library tables and code MUST live in the library plane and
  MUST NOT import from the codex or session planes; library content is immutable after
  ingestion (FR-009).
- **CR-007** (IX. Self-hostable): The feature MUST work on the existing two-container compose
  stack with no new service.

### Key Entities

- **Document**: one imported book. Name (unique, case-insensitive), full normalized text,
  import time, optional source metadata (file names, byte size, content hash).
- **Chunk**: one retrievable unit of a document. Position, kind, section path, text, character
  span; carries derived keyword-search data. Belongs to exactly one document.
- **Embedding**: one meaning vector for one chunk from one model. Model name, dimension (1024),
  vector. Belongs to exactly one chunk; at most one per chunk per model.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For 100% of chunks stored from the synthetic parser fixtures, slicing the stored
  book text by the stored span reproduces the stored chunk text exactly.
- **SC-002**: A keyword search for a term present in one stored chunk returns that chunk, and
  the query plan shows an index being used.
- **SC-003**: A nearest-neighbour search restricted to one model returns only that model's
  vectors, and the query plan shows the vector index being used.
- **SC-004**: 100% of attempts to edit stored library content in place are refused, including
  from a direct database session.
- **SC-005**: Storing a book of ~8,000 chunks completes as one all-or-nothing operation; a
  failure midway leaves the previous version (or nothing) and no partial book.
- **SC-006**: The feature's integration tests run (0 skipped) in CI and against the task's own
  local stack.

## Assumptions

- Chunking strategy is TASK-0024's call; this feature stores whatever chunks it is handed. For
  now a chunk corresponds to one parser block, and the schema does not prevent a chunk from
  spanning several blocks later.
- The keyword-search language configuration is English; the library holds English rulebooks.
- Import status and job tracking belong to the ingestion jobs table (TASK-0024, decision-0005),
  not to documents.
- Retrieval ranking and fusion (TASK-0026) are out of scope; this feature only guarantees the
  indexes those queries need exist and are used.
- The existing `pgvector/pgvector:pg17` image provides the vector extension; no new container.
