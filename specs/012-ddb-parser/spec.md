# Feature Specification: D&D Beyond export parser

**Feature Branch**: `task-0025-ddb-parser`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: "D&D Beyond HTML export parser (TASK-0025). The operator uploads D&D Beyond HTML exports of books they own; the parser turns one export into structured content — ordered sections with a heading path, tables kept whole, and stat blocks recognized as units — each carrying a source anchor (book, section path, character span into the normalized text) so later citations can point at an exact quote. Committed test fixtures are synthetic, holding only original or SRD 5.1 text. A local-only suite runs against a real export in a gitignored folder and skips with a visible notice when absent. Out of scope: upload route, chunking, embeddings, database writes, generic HTML/Markdown."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Turn an export into anchored sections (Priority: P1)

The operator owns a book on D&D Beyond and has saved its pages as an HTML export. They want
the library to understand that book's structure, so that every later answer can cite the
exact chapter, heading, and passage it came from. The parser reads one export and produces
an ordered list of sections. Each section knows its full heading path (for example
"Chapter 9: Combat › Actions in Combat › Grapple") and its text, and each piece of text
carries an anchor that can be followed back to the exact characters it came from.

**Why this priority**: Without anchored sections nothing downstream can cite a source.
This is the minimum that makes an export usable by the library.

**Independent Test**: Parse the committed synthetic "basic rules" fixture and check the
section list: the heading paths match the fixture's headings in order, and every anchor's
character span, applied to the normalized book text, returns exactly that section's text.

**Acceptance Scenarios**:

1. **Given** an export with nested headings, **When** it is parsed, **Then** sections come
   out in document order, each with its full heading path from the book title down.
2. **Given** any parsed block, **When** its anchor span is applied to the normalized book
   text, **Then** the result equals the block's text character for character.
3. **Given** an export page that contains navigation, site chrome, or scripts, **When** it
   is parsed, **Then** none of that text appears in any section.

---

### User Story 2 - Keep tables and stat blocks whole (Priority: P2)

Rules books are full of tables (weapons, spell slots, experience) and creature stat blocks.
Split mid-row or mid-block, they become useless to a question like "what's a goblin's AC".
The parser recognizes a table as one unit with its caption, header row, and data rows, and a
stat block as one unit with its creature name and its labelled fields.

**Why this priority**: Rules questions depend on tables and stat blocks, but the plain
section flow of Story 1 is still useful without them.

**Independent Test**: Parse the synthetic "bestiary" and "equipment" fixtures; check that
each table comes out as one block with its rows intact, and each stat block comes out as one
block with its name and fields.

**Acceptance Scenarios**:

1. **Given** a table in the export, **When** it is parsed, **Then** it becomes exactly one
   table block holding its caption (if any), header cells, and every data row in order.
2. **Given** a creature stat block, **When** it is parsed, **Then** it becomes exactly one
   stat-block block holding the creature name and its labelled fields (armor class, hit
   points, speed, ability scores, and named traits and actions).
3. **Given** a sidebar or callout box, **When** it is parsed, **Then** it becomes one block
   marked as a sidebar, attached to the section it appears in.

---

### User Story 3 - Prove it against a real export without committing one (Priority: P3)

The operator wants confidence that the parser works on their actual purchased book, but that
book cannot be committed to the repository. They drop a real export into a private folder
that git ignores. A local-only test suite then parses it and checks structural invariants.
When the folder is empty or absent, that suite reports plainly that it was skipped, and why.

**Why this priority**: Synthetic fixtures can drift from the real format; this closes that
gap without ever shipping proprietary text.

**Independent Test**: Run the test suite with no private folder and see a visible skip
notice; add a real export and see the suite run and report its checks.

**Acceptance Scenarios**:

1. **Given** no private fixture folder, **When** the tests run, **Then** the real-export
   suite is skipped with a notice that names the folder to populate.
2. **Given** a real export in the private folder, **When** the tests run, **Then** the suite
   parses it and checks: at least one section; every anchor span round-trips; no empty
   blocks; every heading path is non-empty.
3. **Given** a file placed in the private folder, **When** the repository status is checked,
   **Then** git does not list it as a change.

### Edge Cases

- A page with no headings at all: its text still becomes a section, headed by the page
  title.
- Headings that skip levels (an h2 followed directly by an h4): the path records the levels
  present and does not invent missing ones.
- A table with merged cells or a header column: cell text is kept; the layout is flattened
  to rows without losing any cell.
- A stat block the parser does not fully recognize: it still becomes one block, with the
  fields it could label and the rest kept as text. It is never split.
- Empty input, or HTML that is not a D&D Beyond export: the parser returns a clear error
  naming the problem and produces no partial output.
- Non-ASCII text (dashes, curly quotes, accented names): preserved exactly, and anchor spans
  count characters, not bytes.
- Several export pages that make up one book: parsed as one book with one continuous
  normalized text, in the order the pages are given.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The parser MUST accept one or more HTML pages from a D&D Beyond export, plus a
  book title, and return one parsed book or a clear error.
- **FR-002**: The parsed book MUST contain the book title, the full normalized text, and an
  ordered list of blocks.
- **FR-003**: Every block MUST carry a kind (prose, heading, table, stat block, sidebar,
  list), its heading path, its text, and an anchor.
- **FR-004**: Every anchor MUST name the book, the heading path, and a start and end
  character offset into the normalized text, such that slicing the normalized text by those
  offsets returns the block's text exactly.
- **FR-005**: The parser MUST drop site chrome (navigation, scripts, styles, footers, ads)
  and keep only book content.
- **FR-006**: A table MUST become exactly one block and keep its caption, header cells, and
  every data row in order.
- **FR-007**: A stat block MUST become exactly one block and keep the creature name plus
  whatever labelled fields it can identify; unrecognized parts stay as text within the same
  block.
- **FR-008**: The parser MUST be deterministic: the same input produces identical output.
- **FR-009**: The parser MUST NOT read or write the database, the network, or the file
  system. It takes text in and returns data out.
- **FR-010**: The repository MUST contain committed synthetic fixtures covering headings,
  prose, tables, stat blocks, sidebars, and lists, in D&D Beyond's export structure, using
  only original text or SRD 5.1 text with attribution.
- **FR-011**: The repository MUST ignore a private fixture folder; a test suite MUST run
  against its contents when present and MUST report a visible skip when absent.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): The parser MUST be a plain callable with typed input and
  output, so an agent tool and the future upload route (TASK-0024) call the same thing.
- **CR-003** (V. Citations): Every block MUST carry an anchor precise enough to quote the
  exact span it came from (FR-004).
- **CR-004** (VI. System-agnostic): The parser MUST NOT interpret game mechanics. A stat
  block's fields are kept as labelled text, not as typed 5e values; interpretation belongs
  to the 5e system module (M3).
- **CR-005** (VIII. Operator-owned content): Committed fixtures MUST contain no proprietary
  text. Real exports stay in the ignored private folder and in the operator's own database.

### Key Entities

- **Parsed book**: one imported book — its title, its full normalized text, and its blocks.
- **Block**: one unit of content — kind, heading path, text, anchor, and for tables and stat
  blocks their structured parts.
- **Anchor**: where a block came from — book, heading path, start and end character offset.
- **Heading path**: the ordered headings above a block, from the book title down.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every committed fixture, 100% of block anchors round-trip: slicing the
  normalized text by the anchor returns the block's text exactly.
- **SC-002**: For every committed fixture, 100% of tables and stat blocks come out as single
  whole blocks, and 0 blocks contain site-chrome text.
- **SC-003**: Parsing the same fixture twice yields identical output every time.
- **SC-004**: A full-length book export (on the order of 300 pages of content) parses in
  under 10 seconds on the operator's machine.
- **SC-005**: With no private folder present, the test run shows exactly one visible skip
  notice for the real-export suite, and the rest of the suite passes.

## Assumptions

- The operator obtains exports by saving D&D Beyond book pages from their browser; the parser
  targets that saved-page structure. No scraping or login is involved (constitution VIII).
- Committed fixtures are hand-built to mirror that structure. Their fidelity is checked once
  against a real export by the operator via the private suite (runbook checkpoint).
- Chunking these blocks for retrieval is TASK-0024's job; the parser does not split for size.
- Storing blocks and anchors is TASK-0022's and TASK-0024's job; the anchor's shape here is
  what they store.
- PDF import is out of scope for M1.
