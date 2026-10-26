# Feature Specification: First Scene — SRD 5.2.1 baseline data with attribution

**Feature Branch**: `task-0043-srd-data`

**Feature Directory**: `specs/027-srd-data`

**Board Task**: TASK-0043 (milestone m-2, lane 1 of `docs/design/m2-first-scene-sweep-runbook.md`)

**Created**: 2026-10-25

**Status**: Draft — data source **PENDING OPERATOR APPROVAL** (plan.md, checkpoint C1)

**Input**: TASK-0043 card: "the engine works on day one with no imported book. The repo
ships structured SRD 5.2.1 records (monsters, spells, classes, equipment, conditions), a
loader, and compact lookup records of about 100 tokens each." Grounded in decision-0012
(SRD 5.2.1 baseline), decision-0021 idea 7 (compact lookup records), constitution 2.0.0
Principle VIII, and architecture A9/A10.

## Clarification pass

`speckit-clarify` was **skipped**. The card, decision-0012, decision-0021 and the
constitution settle scope, license duty and record kinds. One genuine open choice remains:
which upstream data source the records come from. That is not a spec ambiguity. It is an
operator checkpoint, researched in `research.md` and recommended in `plan.md` (checkpoint
C1). A second checkpoint (C2) confirms the scope boundary on record kinds the card does not
name. Neither blocks this spec's requirements, which hold for every candidate source.

## Card acceptance criteria (the contract this spec maps to)

| AC | Text |
|---|---|
| AC #1 | The repo ships SRD 5.2.1 monsters, spells, classes, equipment and conditions as Zod-validated records. |
| AC #2 | An attribution file carries the exact SRD 5.2.1 CC-BY-4.0 statement, and the app shows it on an about or legal surface. |
| AC #3 | The spec records the data source and its license. |
| AC #4 | A loader returns typed records by id and by name. |
| AC #5 | Each record has a compact lookup form of about 100 tokens, and a test enforces the size bound. |
| AC #6 | A test fails when the attribution file is missing or a record lacks a source reference. |
| AC #7 | The data contains no content from outside SRD 5.2.1. |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The engine and the DM runtime resolve SRD mechanics with no import (Priority: P1)

A fresh install has no imported book. The DM runtime (TASK-0046) needs a Goblin Warrior's
armor class and attacks, the text of *Fire Bolt*, the Fighter's hit die, a longsword's
damage, and what the Prone condition does. It asks the SRD data package by id or by name and
gets a typed, validated record back.

**Why this priority**: an engine with no data cannot demo (decision-0012). Every later
First Scene card that touches mechanics depends on this.

**Independent Test**: with only this package built, look up one record of each of the five
kinds by id and by name; each returns a typed record whose fields match the SRD 5.2.1 PDF.

**Acceptance Scenarios**:

1. **Given** the package is installed, **When** a caller asks for monster `goblin-warrior`,
   **Then** it gets a validated monster record named "Goblin Warrior" with its armor class,
   hit points, abilities and structured attacks.
2. **Given** the package is installed, **When** a caller asks for the spell named
   "fire bolt" (any letter case), **Then** it gets the *Fire Bolt* record.
3. **Given** a name that is not in the SRD, **When** a caller looks it up, **Then** the
   loader reports "not found" and does not throw.

---

### User Story 2 - Shipped SRD content carries its exact attribution, visibly (Priority: P1)

The operator self-hosts and shares the app with players. The CC-BY-4.0 license requires one
exact attribution statement in the work. Anyone using the app can open an About page and
read that statement. Anyone reading the repository finds it in an attribution file next to
the data.

**Why this priority**: shipping SRD data without its attribution breaks the license and
constitution Principle VIII, which is NON-NEGOTIABLE.

**Independent Test**: open `/about` in the running app; the statement appears exactly. Delete
or alter the attribution file; the test suite fails.

**Acceptance Scenarios**:

1. **Given** a signed-in operator or player, **When** they open About from the app shell,
   **Then** the page shows the exact SRD 5.2.1 attribution statement as a page, not a modal.
2. **Given** the attribution file is missing or its statement differs by one character,
   **When** the test suite runs, **Then** it fails.

---

### User Story 3 - Prompts stay small: compact lookup records (Priority: P2)

The DM runtime puts mechanics into prompts. It never loads a whole data file. It asks for
the compact lookup form of one record: about 100 tokens holding the facts a model needs to
narrate and adjudicate, plus a reference to the full record.

**Why this priority**: decision-0021 idea 7. Prompt size drives cost and focus. It is P2
because the full records (US1) are useful without it, but TASK-0046 needs it.

**Independent Test**: render the compact form of every record; a test fails if any exceeds
the size bound.

**Acceptance Scenarios**:

1. **Given** any shipped record, **When** its compact form is rendered, **Then** its
   estimated size is at or below the bound defined in `contracts/compact.md`.
2. **Given** a monster with more actions than fit, **When** its compact form is rendered,
   **Then** it lists what fits and names how many actions it omitted and the record id to
   fetch for the rest.

---

### User Story 4 - Provable provenance: nothing from outside SRD 5.2.1 (Priority: P2)

A reviewer must be able to confirm that every shipped record comes from SRD 5.2.1 and
nothing else: not SRD 5.1, not the 2024 Player's Handbook, not a third-party book.

**Why this priority**: constitution VIII. A single proprietary record in the repo is a
licensing defect, not a bug.

**Independent Test**: the test suite checks every record's name and page against a committed
SRD 5.2.1 index, and the committed verification report shows each record found in the
official PDF.

**Acceptance Scenarios**:

1. **Given** a record whose name is not in the SRD 5.2.1 index for its kind, **When** the
   test suite runs, **Then** it fails and names the record.
2. **Given** a record with no source reference, **When** the test suite runs, **Then** it
   fails and names the record.

### Edge Cases

- **One stat block, several forms.** SRD 5.2.1 gives each lycanthrope and the Vampire one
  stat block with form notes. The data keeps one record per stat block, never one per form.
- **Stat blocks inside other entries.** Some SRD 5.2.1 stat blocks sit inside a magic item
  (for example, Giant Fly in *Figurine of Wondrous Power*). The PDF's printed "Index of Stat
  Blocks" omits them. The committed SRD 5.2.1 index adds each one as an embedded stat block,
  with its page. The record's source section names the containing entry.
- **Name collisions across kinds.** "Shield" is both a spell and armor. Lookups are always
  per kind, so the collision never resolves to the wrong record.
- **Typographic apostrophes.** Names like "Tasha's Hideous Laughter" may use a curly
  apostrophe in the source. Name lookup treats curly and straight apostrophes as equal.
- **Conditional damage.** "plus 2 (1d4) Slashing damage if the attack roll had Advantage"
  keeps its condition. The record never flattens conditional damage into unconditional damage.
- **Very long stat blocks.** Dragons exceed the compact bound if every action is listed. The
  compact form truncates by rule and points to the full record (US3 scenario 2).
- **Invalid data at load.** If a shipped data file fails validation, the loader fails loudly
  at first use with the record id and the failing field. It never returns a half-valid record.

## Requirements *(mandatory)*

### Functional Requirements

**Data (AC #1, AC #7)**

- **FR-001**: The repository MUST ship SRD 5.2.1 records of five kinds: monsters, spells,
  classes (with their SRD subclass), equipment, and conditions. *(AC #1)*
- **FR-002**: Every record MUST validate against its kind's Zod schema
  (`contracts/records.md`). A test MUST validate every shipped record. *(AC #1)*
- **FR-003**: The data MUST be complete for each kind: every monster and animal stat block,
  every spell, all 12 classes and their 12 subclasses, every weapon, armor, adventuring gear,
  tool, mount and vehicle entry in the Equipment chapter, and all 15 conditions. The count
  per kind MUST equal the committed SRD 5.2.1 index count. *(AC #1)*
- **FR-004**: Monster attacks MUST be structured (attack bonus, reach or range, damage dice,
  damage type, and any condition on extra damage), so the engine can resolve them without
  reading prose. *(AC #1)*
- **FR-005**: The data MUST contain no content from outside SRD 5.2.1. Every record's name
  MUST appear in the committed SRD 5.2.1 index for its kind. Every record's page MUST fall in
  its kind's chapter page range. *(AC #7)*
- **FR-006**: A committed verification report MUST show, per record, that its name and its
  key numbers were found on its cited page of the official SRD 5.2.1 PDF, identified by the
  PDF's SHA-256. *(AC #7)*

**Source reference and attribution (AC #2, AC #3, AC #6)**

- **FR-007**: Every record MUST carry a source reference: document `SRD 5.2.1`, the SRD
  section it comes from, and its page number. *(AC #6)*
- **FR-008**: The data package MUST ship an attribution file holding the exact SRD 5.2.1
  attribution statement, character for character, as quoted under "Attribution statement"
  below. *(AC #2)*
- **FR-009**: The attribution MUST add no other attribution to Wizards of the Coast or its
  parent or affiliates. The SRD's legal page asks for none. *(AC #2)*
- **FR-010**: The attribution file MUST state that the records were restructured from the
  SRD text (CC-BY-4.0 asks for an indication of changes). It MUST name the upstream dataset
  and that dataset's license, if checkpoint C1 selects one. *(AC #2, AC #3)*
- **FR-011**: A test MUST fail when the attribution file is missing, when its statement
  differs from the exact text, or when any record lacks a source reference. *(AC #6)*
- **FR-012**: The web app MUST show the exact attribution statement on an About page, at
  route `/about`, reachable from the app shell by every signed-in role. It MUST be a route,
  never a modal or dialog. *(AC #2)*
- **FR-013**: The attribution text MUST have one source in code. The About page and the test
  MUST read that one source; neither may hold its own copy. *(AC #2, AC #6)*
- **FR-014**: This spec MUST record the data source and its license. See "Data source"
  below. *(AC #3)*

**Loader (AC #4)**

- **FR-015**: A loader MUST return a typed record by kind and id. *(AC #4)*
- **FR-016**: A loader MUST return a typed record by kind and name. Name matching MUST ignore
  letter case, surrounding whitespace, repeated inner whitespace, and the curly/straight
  apostrophe difference. *(AC #4)*
- **FR-017**: An unknown id or name MUST yield "not found" (no throw). Invalid shipped data
  MUST throw at first use, naming the record and field. *(AC #4)*
- **FR-018**: The loader MUST list all records of a kind, so a caller can enumerate without
  reading data files directly. *(AC #4)*

**Compact lookup form (AC #5)**

- **FR-019**: Every record MUST have a compact lookup form: a plain-text rendering derived
  from the record by a pure function, never stored separately. *(AC #5)*
- **FR-020**: The compact form's size MUST be measured by a deterministic token estimator in
  the package, with no model, network or vendor tokenizer. *(AC #5)*
- **FR-021**: A test MUST render the compact form of every shipped record and fail if any
  exceeds the hard bound in `contracts/compact.md` (target about 100, hard ceiling 120
  estimated tokens). *(AC #5)*
- **FR-022**: The compact renderer and the estimator MUST be exported, so TASK-0064 can hold
  imported records to the same bound. *(AC #5)*

### Constitution-Driven Requirements *(mandatory)*

- **CR-001** (I. Agent-operable): An agent MUST reach SRD records through the same loader
  API the engine and the DM runtime use (`contracts/loader.md`). The About page is a
  human-facing view of the attribution constant, which an agent reads from the same export.
- **CR-004** (VI. 5e engine boundary): The SRD package MUST hold data and lookup only. It
  MUST NOT roll dice or compute a game number. It MUST NOT import the engine package
  (`packages/dnd5e-engine`, TASK-0042) or any app. The engine may import this package later;
  this package never imports the engine.
- **CR-005** (VIII. Operator-owned content): The package MUST ship only SRD 5.2.1 content
  under CC-BY-4.0, with its exact attribution guarded by a test. Nothing from
  `/Volumes/evan/dnd-sourcebooks` or `fixtures/private/` may be read, used or committed.

CR-002 (content contract) does not apply: SRD records are mechanics data, not codex entities;
they become codex `identity` sections later (architecture A5). CR-003 (citations) does not
apply: the SRD baseline is not library content; its provenance is FR-005 to FR-007.

### Key Entities

- **SRD record**: one entry of one kind, with a stable id (kebab-case, unique per kind), a
  display name, kind-specific mechanical fields, the SRD text it needs, and a source reference.
- **Source reference**: document `SRD 5.2.1`, SRD section name, page number.
- **Monster**: one stat block — size, type, alignment, armor class, initiative, hit points,
  speeds, ability scores, saves, skills, defenses, senses, languages, challenge rating,
  traits, and actions (with structured attacks), bonus actions, reactions, legendary actions.
- **Spell**: level, school, class lists, casting time, ritual flag, range, components,
  concentration flag, duration, description, and higher-level text.
- **Class**: hit die, primary ability, saving throws, proficiencies, level table (proficiency
  bonus, features, spell slots), features, and its one SRD subclass.
- **Equipment item**: one item in a category — weapon, armor, adventuring gear, tool, or mount
  and vehicle — with cost, weight, and category-specific fields.
- **Condition**: name and its list of effects.
- **SRD 5.2.1 index**: the committed list of names and pages per kind, extracted from the
  official PDF; the allowlist FR-005 checks against.
- **Attribution**: the exact statement, the change notice, and any upstream dataset credit.

## Data source (AC #3)

**Recommendation — PENDING OPERATOR APPROVAL (plan.md, checkpoint C1):** derive the records
from the Open5e `srd-2024` dataset
(https://github.com/open5e/open5e-api, `data/v2/wizards-of-the-coast/srd-2024/`), pinned to
one commit, and verify every record against the official SRD 5.2.1 PDF.

- **Content license:** CC-BY-4.0. The SRD text is Wizards of the Coast's, licensed CC-BY-4.0.
  Open5e's dataset tags this document `cc-by-40`. Open5e's repository license (a modified
  MIT) expressly excludes "SRD content provided by 3rd-parties".
- **Ground truth:** the official SRD 5.2.1 PDF,
  https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf, 364 pages,
  SHA-256 `8974902d109d6e63672d7c490bde9ccf052410503d9cfa768237154fbc5e3d87` as fetched on
  2026-10-25.

Alternatives (own transcription from the PDF; the 5e-bits `5e-srd-api` 2024 data) and the
reasons for the ranking are in `research.md`. If the operator picks an alternative, this
section and FR-010 change; no other requirement changes.

## Attribution statement (AC #2)

Source: SRD 5.2.1 PDF, page 1, "Legal Information" (URL and SHA-256 above), extracted on
2026-10-25. Typographic quotes are part of the statement:

> This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

The same page asks: "Please do not include any other attribution to Wizards or its parent or
affiliates other than that provided above." It permits a "compatible with fifth edition" or
"5E compatible" statement. (The PDF's line break inside the license URL is layout, not text.)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For each of the five kinds, the shipped record count equals the SRD 5.2.1 index
  count (about 330 indexed stat blocks plus embedded ones, 339 spells, 12 classes with 12 subclasses, 15 conditions, and
  every Equipment-chapter item).
- **SC-002**: 100% of shipped records validate, carry a source reference, and appear in the
  SRD 5.2.1 index.
- **SC-003**: 100% of records' compact forms are at or under 120 estimated tokens (the "about
  100" target with a hard ceiling); the per-kind median and maximum are reported in the PR.
- **SC-004**: The verification report shows 100% of records found on their cited PDF page,
  with zero unresolved mismatches.
- **SC-005**: Any signed-in user reaches the attribution statement in one click from the app
  shell.
- **SC-006**: Removing or altering one character of the attribution makes the test suite fail.

## Assumptions

- Magic items, species, backgrounds, feats, and rules-glossary entries other than conditions
  are out of scope: the card and decision-0012 name five kinds. Checkpoint C2 asks the
  operator to confirm. If any is wanted, it gets its own board card (decision-0020); this spec
  does not defer it as prose.
- The SRD baseline is static, read-only package data. It is not state, so it lives in no data
  plane (constitution III) and needs no database table.
- Signed-out visitors see the sign-in gate on every route (root.tsx). The attribution shown to
  signed-in users satisfies "the app shows it"; the attribution file covers the repository and
  the container image.
- TASK-0042 builds `packages/dnd5e-engine` in parallel. This feature neither imports nor
  modifies it. Wiring engine or DM-runtime callers to the loader belongs to TASK-0046.
- TASK-0064 layers imported records over this baseline. It reuses the exported schemas,
  compact renderer and estimator; it is not built here.
