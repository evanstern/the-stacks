# Tasks: D&D Beyond export parser

**Input**: Design documents from `/specs/012-ddb-parser/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/parser.md, quickstart.md

**Tests**: requested — FR-010, FR-011, SC-001–SC-005, and every guarantee in
`contracts/parser.md` are test-verified.

**Gate before Phase 1**: the operator has approved `parse5` (runbook new-dependency
checkpoint). Do not start without that approval recorded on TASK-0025.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

**Purpose**: dependency, ignore rule, and the empty module.

- [x] T001 Add `parse5` (^8) to `apps/server/package.json` dependencies with `pnpm --filter @the-stacks/server add parse5`; commit `pnpm-lock.yaml` with it.
- [x] T002 [P] Append `fixtures/private/` to the root `.gitignore`, under a `# Operator-owned content (constitution VIII)` comment.
- [x] T003 [P] Create `apps/server/src/library/ddb/index.ts` exporting a stub `parseDdbExport` that throws `ValidationError("not implemented")`, so tests can import it.

**Checkpoint**: `pnpm typecheck` and `pnpm lint` pass; `git check-ignore fixtures/private/x` prints the path.

## Phase 2: Foundational — types, selectors, fixtures

**Purpose**: the contract types and the fixture corpus every story tests against.

- [x] T004 In `apps/server/src/library/ddb/index.ts`, define Zod schemas `ParseInputSchema`, `AnchorSchema`, `BlockSchema`, `ParsedBookSchema` exactly per `data-model.md`, and export their inferred types.
- [x] T005 [P] Create `apps/server/src/library/ddb/selectors.ts`: one exported table mapping D&D Beyond selectors to roles — content root, stat block, sidebar, and chrome to strip — using the initial names in research R3. No other file may contain a D&D Beyond class name.
- [x] T006 [P] Create `apps/server/test/fixtures/ddb/basic-rules.html`: a realistic saved page (doctype, head with `<style>` and `<script>`, `nav`, header, footer) whose content root holds nested h1–h4 headings, prose, an ordered and an unordered list, one sidebar, one skipped heading level (h2 → h4), and non-ASCII text (em dash, curly quotes, an accented name). Original text only.
- [x] T007 [P] Create `apps/server/test/fixtures/ddb/equipment.html`: same chrome; three tables — one with a caption and header row, one with a header column, one with a `colspan` merged cell. SRD 5.1 equipment data or original values.
- [x] T008 [P] Create `apps/server/test/fixtures/ddb/bestiary.html`: same chrome; two complete SRD 5.1 stat blocks (e.g. Goblin, Wolf) with name, AC, HP, speed, the six ability scores, traits, and actions; plus one deliberately malformed stat block missing its ability-score row.
- [x] T009 [P] Create `apps/server/test/fixtures/ddb/README.md`: provenance of each fixture (original vs SRD 5.1), the CC-BY-4.0 attribution text for SRD 5.1, and the rule that no proprietary text may be committed here (constitution VIII).

**Checkpoint**: fixtures open in a browser and look like book pages; types compile.

## Phase 3: User Story 1 — anchored sections (Priority: P1) 🎯 MVP

**Goal**: an export becomes ordered blocks with heading paths and round-tripping anchors.

**Independent Test**: `basic-rules.html` parses; every anchor round-trips; no chrome text appears.

- [ ] T010 [US1] Write `apps/server/test/library/ddb.test.ts` US1 cases against `basic-rules.html`: heading paths in document order starting with the book title; the skipped level recorded without an invented h3; every block satisfies `text.slice(start, end) === block.text`; spans strictly increase and never overlap; no block contains any nav/header/footer/script/style text; non-ASCII preserved; two parses are deep-equal. Tests fail against the stub.
- [ ] T011 [US1] Implement `apps/server/src/library/ddb/walk.ts`: parse each page with `parse5`, locate the content root via `selectors.ts` (fall back to `<body>` minus chrome), walk it once, maintain the heading stack, emit `heading`, `prose`, and `list` blocks, and build the normalized text and `[start, end)` UTF-16 offsets in the same pass per research R4. Pages are concatenated in input order.
- [ ] T012 [US1] Wire `parseDdbExport` in `apps/server/src/library/ddb/index.ts`: validate input with `ParseInputSchema`, call the walk, validate output with `ParsedBookSchema`, and throw `ValidationError` (from `apps/server/src/errors.ts`) naming the problem for empty input, no content found, or zero blocks. Never return partial output.
- [ ] T013 [US1] Add error-path cases to `ddb.test.ts`: empty `pages`, a page with no content root and no body text, and a non-DDB HTML page with no content; each throws `ValidationError`.

**Checkpoint**: `pnpm --filter @the-stacks/server test -- library/ddb` passes US1 cases.

## Phase 4: User Story 2 — tables and stat blocks whole (Priority: P2)

**Goal**: tables and stat blocks each become exactly one structured block; sidebars are marked.

**Independent Test**: `equipment.html` and `bestiary.html` produce whole table and stat-block blocks.

- [ ] T014 [US2] Add US2 cases to `ddb.test.ts`: each `<table>` in `equipment.html` → exactly one `table` block with caption, header, and all rows in order, merged cell text kept; each stat block in `bestiary.html` → exactly one `statBlock` block with name and labelled fields as text; the malformed stat block still becomes one block; the sidebar in `basic-rules.html` → one `sidebar` block in its section. Anchors round-trip for all of them.
- [ ] T015 [US2] Implement `apps/server/src/library/ddb/extract.ts`: `extractTable` (caption, header row or header column, rows, `colspan` flattening) and `extractStatBlock` (name plus label/value pairs; unrecognized parts appended as text within the block). Values stay strings (CR-004).
- [ ] T016 [US2] Call the extractors from `walk.ts` when the walk meets a `<table>` or a stat-block/sidebar selector, so those subtrees are never also emitted as prose. Normalized text for tables joins cells with ` | ` and rows with `\n` (research R4).

**Checkpoint**: all US1 and US2 cases pass.

## Phase 5: User Story 3 — private real-export suite (Priority: P3)

**Goal**: a real export can be tested locally; absence skips visibly.

**Independent Test**: with no `fixtures/private/ddb/`, the run shows the skip line; with files, the suite runs.

- [ ] T017 [US3] Create `apps/server/test/library/ddb.private.test.ts`: resolve `fixtures/private/ddb/` from the repo root; if absent or empty, `console.warn("ddb real-export suite SKIPPED: put D&D Beyond export pages in fixtures/private/ddb/ to run it")` and `describe.skipIf(true)`; otherwise read `*.html` sorted by name, parse as one book, and assert: ≥1 block, every anchor round-trips, no empty block text, every path non-empty, spans strictly increasing.
- [ ] T018 [US3] Verify both states by hand: run without the folder and confirm the one skip line; create the folder with a copy of `basic-rules.html`, confirm the suite runs and `git status` shows nothing new; delete the copy. Record both outputs in the PR body.

**Checkpoint**: SC-005 holds.

## Phase 6: Polish & cross-cutting

- [ ] T019 [P] Create `apps/server/test/library/ddb.perf.test.ts`: build a ~300-page book by repeating the three fixtures' content roots, parse it, assert under 10 s (SC-004).
- [ ] T020 [P] Confirm the library boundary rule covers `apps/server/src/library/ddb/**` (it matches `apps/server/src/library/**`); run `pnpm check:boundaries`.
- [ ] T021 Run `pnpm ci:check`; all green. Paste the output summary in the PR body.
- [ ] T022 Run the wiki freshness gate (`node ~/.claude/plugins/cache/praxisflux/grounding-wiki/0.65.3/gates/cli.mjs freshness . docs/wiki`) and write a new `docs/wiki/ddb-parser.md` note via `/grounding-wiki:wiki-update`; any `.gitignore`-sourced note is re-verified.

## Dependencies

- Operator approval of `parse5` → Phase 1.
- Phase 1 → Phase 2 → Phase 3 (MVP) → Phase 4 → Phase 5 → Phase 6.
- US3 (Phase 5) depends only on the public `parseDdbExport`; it could run after Phase 3.
- Within Phase 2, T005–T009 are parallel. T019 and T020 are parallel.

## Parallel example

```text
Phase 2: T005 selectors.ts | T006 basic-rules.html | T007 equipment.html | T008 bestiary.html | T009 README.md
```

## Implementation strategy

MVP is Phase 3: anchored sections from real-shaped HTML. Tables and stat blocks (Phase 4)
make it useful for rules questions; the private suite (Phase 5) proves fidelity to the real
format. One implementer per phase; Phase 1 and 2 may be grouped as one dispatch (small,
mechanical).
