# Feature Specification: SRD 5.2.1 Playing the Game rules text

**Feature Branch**: `task-0123-srd-rules-text`

**Created**: 2026-10-26

**Status**: Draft

**Input**: User description: "TASK-0123: add the SRD 5.2.1 Playing the Game rules text to
packages/srd as validated rule records with heading-path ids, so engine, doctrine and research
cite a repo copy."

**Board card**: TASK-0123 (m-3, sweep track C2). Found by TASK-0115
(`docs/research/DM-Craft-Map/SRD-5.2.1-Rules-Pass.md`, "Scope finding": the package holds no
Playing the Game text; the only adjudication material present is 15 condition records).

**Clarify pass**: skipped. Every open choice below is settled from an existing artifact (the
TASK-0043 package design, `packages/srd/provenance/source.json`, constitution 2.0.0 VIII) or is
listed under Open Questions for the orchestrator. No choice changes scope or user experience.

**TASK-0135 relation**: the runbook asks Track C cards to cite the TASK-0135 decision record
once it merges. TASK-0135 has not merged (card status To Do on 2026-10-26). This card ships
data only. It implements no actor-state rule or gate, so it has no TASK-0135 rule to name.

## Data source and license

- **Text source, first choice**: the Open5e srd-2024 dataset, repository
  `https://github.com/open5e/open5e-api`, directory `data/v2/wizards-of-the-coast/srd-2024`,
  commit `e69ac13b49dae6a9d84abf38fc674fe1db5b392b` (the commit the package already pins).
  Files: `Rule.json` (56 records) and `RuleSet.json` (11 sections). The dataset's
  `Document.json` declares license `cc-by-40`.
- **Text source, fallback and oracle**: the SRD 5.2.1 PDF,
  `https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf`, SHA-256
  `8974902d109d6e63672d7c490bde9ccf052410503d9cfa768237154fbc5e3d87`, licensed CC-BY-4.0.
  The PDF supplies any heading or text the dataset lacks, and every record is checked against
  it. The PDF is never committed.
- **Why both**: the dataset is incomplete for this chapter. Its "Rhythm of Play" section has no
  rule records, and it holds no Rules Glossary entries. The dataset's markdown tables are cleaner
  than PDF text extraction, so the dataset stays first choice where its text verifies.
- **License**: SRD 5.2.1 is CC-BY-4.0. The exact attribution statement in
  `packages/srd/ATTRIBUTION.md` and `SRD_ATTRIBUTION` stays byte-identical.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The engine looks up a rule by id (Priority: P1)

An engine or DM-runtime author (TASK-0104, TASK-0127, TASK-0128) needs the rule text and tables
behind a d20 test. They look up one rule record by its heading-path id and read its tables and
text. They need no PDF and no network.

**Why this priority**: three m-3 cards depend on it. The DC table is the first consumer.

**Independent Test**: load the record
`playing-the-game.d20-tests.ability-checks.difficulty-class` and read the six rows of the
Typical Difficulty Classes table.

**Acceptance Scenarios**:

1. **Given** the package is built, **When** a caller looks up the DC table record by id,
   **Then** it returns a validated record whose table holds exactly the six SRD rows
   (Very easy 5, Easy 10, Medium 15, Hard 20, Very hard 25, Nearly impossible 30).
2. **Given** the package is built, **When** a caller lists the children of
   `playing-the-game.d20-tests`, **Then** each d20-test section record loads and validates.
3. **Given** an unknown id, **When** a caller looks it up, **Then** the lookup returns no record
   and does not throw.

### User Story 2 - A prompt cites a rule in compact form (Priority: P2)

A DM prompt builder needs a short rendering of one rule for a model prompt, with a page anchor.

**Why this priority**: the compact form is how every other SRD kind enters prompts today.

**Independent Test**: render the DC table record in compact form and check it holds all six
rows, the id and the page footer, within the 120-token ceiling.

**Acceptance Scenarios**:

1. **Given** any rule record, **When** a caller asks for its compact form, **Then** the result
   is at or under the 120-token ceiling and ends with `SRD 5.2.1 p.<page>`.
2. **Given** the DC table record, **When** a caller asks for its compact form, **Then** all six
   table rows appear unbroken.

### User Story 3 - A maintainer proves chapter coverage (Priority: P3)

A maintainer needs proof that the repo copy covers the whole chapter and matches the PDF.

**Independent Test**: the coverage test compares the committed heading index with the data file.

**Acceptance Scenarios**:

1. **Given** the committed heading index extracted from the PDF, **When** tests run, **Then**
   every indexed heading maps to exactly one rule record and every rule record maps to one
   indexed heading, with matching pages.
2. **Given** the verification file, **When** tests run, **Then** no rule record has an
   unresolved mismatch against its cited PDF pages.

### Edge Cases

- **Repeated heading names.** "Ability Checks" appears under D20 Tests and under Social
  Interaction. Ids and names carry the full heading path, so they stay unique.
- **A heading with no own text.** A section whose body is only sub-headings is still a record,
  with an empty block list and its children listed.
- **A card-named topic the PDF lacks.** The card names "contests". If SRD 5.2.1 prints no such
  heading, the provenance file lists it under `absentTopics`. No record is invented.
- **Dataset and PDF disagree.** The PDF wins. The repair is named in `provenance/source.json`.
- **A record spans pages.** The record cites its first page and its last page.
- **Sidebars and callouts.** A boxed sidebar with its own heading is a record under the heading
  it sits beside.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `packages/srd` MUST add a sixth record kind, `rule`, with its own validated schema
  and data file.
- **FR-002**: The `rule` kind MUST cover every heading of the SRD 5.2.1 "Playing the Game"
  chapter, at every heading level the PDF prints, including the chapter root.
- **FR-003**: The `rule` kind MUST also cover four Rules Glossary entries: Help [Action],
  Influence [Action], Search [Action] and Study [Action].
- **FR-004**: Each record id MUST be its heading path: the slug of each heading, joined by `.`,
  e.g. `playing-the-game.d20-tests.ability-checks.difficulty-class`.
- **FR-005**: Each record MUST hold its own body only, from its heading to the next heading,
  as ordered blocks: paragraphs, lists and tables.
- **FR-006**: Each table MUST keep its title, column headers and cell text verbatim.
- **FR-007**: Each record MUST cite `SRD 5.2.1`, its chapter as `section`, its first page and its
  last page.
- **FR-008**: Each record MUST name its parent id (or none) and its child ids in document order.
- **FR-009**: The loader MUST serve `rule` through the existing `list`, `getById`, `getByName`
  and `compact` calls. `getByName` takes the full heading path name.
- **FR-010**: The compact form of a rule MUST stay at or under 120 estimated tokens, render
  table rows before prose, and never split a table row.
- **FR-011**: A committed heading index MUST list every covered heading with its path and page,
  extracted from the PDF. A test MUST prove a one-to-one match between index and records.
- **FR-012**: The PDF verification script MUST check every rule record's text and numbers
  against its cited pages, and record the result in `provenance/verification.json`.
- **FR-013**: `provenance/source.json` MUST state how `rule` records were sourced, list every
  repair, and list `absentTopics`.
- **FR-014**: The ids named under "Downstream lookups" MUST exist, guarded by a test.
- **FR-015**: Re-running the provenance scripts MUST leave the five existing data files and their
  index and verification entries unchanged.

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): An agent MUST reach every rule record through the same package
  calls the server uses today (`getById`, `getByName`, `compact`, `list`).
- **CR-003** (V. Citations): Every rule record MUST carry a source anchor (document, section,
  page) that a reader can check against the PDF.
- **CR-004** (VI. 5e engine boundary): The package MUST stay data only. It MUST NOT import the
  engine or compute any game number. Consumers derive numbers in the engine.
- **CR-005** (VIII. Operator-owned content): The package MUST ship only openly licensed SRD 5.2.1
  text. It MUST keep the exact CC-BY-4.0 attribution, guarded by a test. Nothing from
  `/Volumes/evan/dnd-sourcebooks` or `fixtures/private/` is read into, or committed with, this
  feature. The SRD PDF itself is never committed.

### Key Entities

- **Rule record**: one heading of the chapter. Attributes: heading-path id, full path name, own
  heading title, heading path, parent id, child ids, source (document, section, first page),
  last page, ordered blocks.
- **Block**: one paragraph, one list (ordered items), or one table (title, columns, rows).
- **Heading index entry**: path and page of one heading, extracted from the PDF. The coverage
  oracle.

### Downstream lookups (record shape for consumers; not implemented here)

Consumers call `getById("rule", <id>)` for the record and `compact("rule", <id>)` for prompt text.
Ids below are expected from the dataset headings. Phase 1's heading index confirms them. Any id
that changes is corrected in this table in the same PR, and the FR-014 test pins the final list.

| Consumer | Needs | Expected id |
|----------|-------|-------------|
| TASK-0104 (DCs, modifiers) | Typical Difficulty Classes table | `playing-the-game.d20-tests.ability-checks.difficulty-class` |
| TASK-0104 | Ability modifier table | `playing-the-game.the-six-abilities.ability-modifiers` |
| TASK-0104 | Proficiency on checks | `playing-the-game.d20-tests.ability-checks.proficiency-bonus` |
| TASK-0127 (d20 tests) | The d20 Test overview | `playing-the-game.d20-tests` |
| TASK-0127 | Ability checks | `playing-the-game.d20-tests.ability-checks` |
| TASK-0127 | Saving throws | `playing-the-game.d20-tests.saving-throws` |
| TASK-0127 | Attack rolls | `playing-the-game.d20-tests.attack-rolls` |
| TASK-0127 | Advantage and Disadvantage | `playing-the-game.d20-tests.advantage-disadvantage` |
| TASK-0128 (opposition, Help) | Help action | `rules-glossary.help-action` |
| TASK-0128 | Opposed checks or contests, where printed | the heading index decides; else listed in `absentTopics` |
| Social and exploration rules | Influence, Search, Study actions | `rules-glossary.influence-action`, `rules-glossary.search-action`, `rules-glossary.study-action` |

Record shape a consumer reads (illustrative):

```json
{
  "id": "playing-the-game.d20-tests.ability-checks.difficulty-class",
  "name": "Playing the Game › D20 Tests › Ability Checks › Difficulty Class",
  "title": "Difficulty Class",
  "path": ["Playing the Game", "D20 Tests", "Ability Checks", "Difficulty Class"],
  "parent": "playing-the-game.d20-tests.ability-checks",
  "children": [],
  "source": { "document": "SRD 5.2.1", "section": "Playing the Game", "page": 0 },
  "pageEnd": 0,
  "blocks": [
    { "type": "text", "text": "The Difficulty Class of an ability check represents …" },
    { "type": "table", "title": "Typical Difficulty Classes",
      "columns": ["Task Difficulty", "DC"],
      "rows": [["Very easy", "5"], ["Easy", "10"], ["Medium", "15"],
               ["Hard", "20"], ["Very hard", "25"], ["Nearly impossible", "30"]] }
  ]
}
```

Pages shown as `0` are placeholders. The heading index supplies the real pages. Table cells are
strings. Parsing a DC to a number is the consumer's work, in the engine.

### Acceptance criteria mapping

| Card AC | Covered by |
|---------|------------|
| #1 Playing the Game sections as validated records with heading-path ids | FR-001, FR-002, FR-004, FR-005, FR-009, FR-011 |
| #2 The CC-BY-4.0 attribution covers the new records | FR-013, CR-005, SC-005 |
| #3 A test proves the DC table and each d20-test section load | User Story 1, FR-014, SC-002 |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of headings in the committed heading index map to exactly one rule record, and
  the reverse holds.
- **SC-002**: The DC table record and every d20-test section record load in a test, and the DC
  table holds exactly six rows equal to the SRD values.
- **SC-003**: Zero rule records carry an unresolved mismatch in `provenance/verification.json`.
- **SC-004**: Every rule record's compact form is at or under 120 estimated tokens.
- **SC-005**: The attribution tests pass unchanged, and a new test proves `ATTRIBUTION.md` names
  the `rule` kind among the records it covers.
- **SC-006**: The five existing data files are byte-identical before and after this feature.
- **SC-007**: A reader can check any rule record against the PDF from its id and page alone,
  verified by a hand spot-check of at least 10 records.

## Assumptions

- The chapter's heading levels can be read from the PDF's font sizes with the poppler tools the
  provenance scripts already use. No new tool is needed.
- The Rules Glossary entries beyond Help, Influence, Search and Study are out of scope. See Open
  Questions.
- Adding `rule` to `SrdKind` widens the server's adjudicate citation schema, which reuses
  `SrdKind`. The model prompt still names five kinds, so no model behaviour changes. No server
  file changes in this card.
- The PDF is fetched from its public URL for dev-time scripts only, checked against its pinned
  hash, and stored outside the repository.

## Open Questions

- **OQ-1 (orchestrator)**: The rest of the Rules Glossary (other actions, hazards, terms) is not
  covered. Card it as a follow-up task, or rule it out of scope.
- **OQ-2 (orchestrator)**: Offering `rule` citations in the adjudicate prompt is a server change
  for TASK-0104 or TASK-0128, not this card. Confirm which card owns it.
- **OQ-3 (operator)**: The implementer needs the SRD PDF on disk. Confirm the operator supplies a
  local copy or approves the download from the pinned public URL.
