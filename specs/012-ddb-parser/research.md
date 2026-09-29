# Research: D&D Beyond export parser (spec 012)

## R1 — Where the parser lives

- **Decision**: `apps/server/src/library/ddb/`. Tests in `apps/server/test/library/`.
- **Rationale**: Imported books are library-plane state (A3, constitution III). Biome's
  boundary rule for `apps/server/src/library/**` already forbids codex and session imports,
  so the parser inherits plane discipline with no new rule. The parser is server-only: the
  SPA never parses exports.
- **Alternatives**: `packages/shared` — rejected; it would drag an HTML parser into the web
  bundle's reachable graph, and nothing client-side needs it. A new `packages/library`
  workspace — rejected (YAGNI); one package per plane can come when a second consumer does.

## R2 — HTML parsing approach (NEW DEPENDENCY — operator checkpoint)

- **Decision**: add **`parse5`** (8.x) to `apps/server` dependencies. It is the
  spec-compliant WHATWG HTML parser; its only runtime dependency is `entities`. Walk its
  default tree adapter directly; no DOM layer.
- **Rationale**: Saved browser pages are real-world HTML (unclosed tags, implied `<tbody>`,
  entities, scripts). Parsing it by regex or a hand tokenizer gets tables and nesting wrong
  in exactly the cases FR-006 cares about. Node 22 has no built-in HTML parser. Nothing in
  the repo parses HTML today (`hono`, `ws`, `pg`, `drizzle-orm`, `zod`).
- **Alternatives**:
  - `node-html-parser` — faster and has CSS selectors, but it is not spec-compliant: it does
    not repair malformed markup the way a browser does, and pulls in `css-select`.
  - `cheerio` / `jsdom` — far heavier than a tree walk needs.
  - Hand-rolled tokenizer — no new dependency, but wrong on the real-world edge cases above
    and a maintenance liability. Rejected.
- **Checkpoint**: implementation is not dispatched until the operator approves `parse5`
  (runbook "Operator checkpoints": new runtime dependencies).

## R3 — Identifying D&D Beyond structure

- **Decision**: select content by the export's content container, headings `h1`–`h6`,
  `table`, and class-marked blocks. The mapping from DDB classes to block kinds lives in one
  table in `ddb/selectors.ts` (e.g. content root, stat block, sidebar/callout, chrome to
  strip). Unknown elements fall back to prose.
- **Rationale**: DDB's markup is the one thing likely to change (A9 risk table). Keeping every
  class name in one table makes a format shift a one-file edit, proven by fixtures.
- **Verified against real exports (2026-09-28)**: R3's names were originally guessed from
  memory; they were checked read-only against three real saved exports (never committed) —
  Player's Handbook "23 - Combat.zip", Player's Handbook "19 - Equipment.zip", and Monster
  Manual's "G" chapter (Goblin/Goblin Boss) from `monster_manual.zip`. Confirmed and
  corrected selectors, each tagged with which export it came from:
  - Content root: `.p-article-content` — **confirmed** (Combat, Equipment, MM/G).
  - Page title (chrome, outside the content root): `h1.page-title` — **confirmed** (Combat);
    holds the chapter title, used only as the fallback section heading when the content root
    has no heading of its own.
  - Section headings: any h2-h6 carrying class `heading-anchor` (sometimes combined with
    `compendium-hr` and/or `compendium-header`, order not fixed — match on `heading-anchor`
    alone, not the full class string) — **confirmed, class list corrected** (all three). The
    content root's own top `<h1>` (e.g. `<h1 id="Combat">Chapter 9: Combat</h1>`) carries no
    class at all and is a heading by tag, not class.
  - Tables: plain `<table>` — **simplified**; DDB's table classes
    (`table-compendium`, `table--equipment`, `table--left-all`, `table--generic-dice`,
    `quick-menu-exclude`) are cosmetic variants, not needed to detect a table (Equipment). A
    table's caption, when present, is a heading element inside `<caption>`.
  - Stat block: `.stat-block-background` (always paired with `.Basic-Text-Frame`) —
    **corrected**; no plain `.stat-block` or `.monster-stat-block` class exists (MM/G).
    Internal parts: `.Stat-Block-Styles_Stat-Block-Title` (name),
    `.Stat-Block-Styles_Stat-Block-Metadata` (size/type/alignment),
    `.Stat-Block-Styles_Stat-Block-Data` / `-Data-Last` (labelled lines: Armor Class, Hit
    Points, Speed, Skills, Senses, Languages, Challenge), `.stat-block-ability-scores` with
    one `.stat-block-ability-scores-stat` per ability (`-heading` = STR/DEX/…, `-data` /
    `-score` / `-modifier` = the number and its modifier),
    `.Stat-Block-Styles_Stat-Block-Heading` (a subsection label such as "Actions"), and
    `.Stat-Block-Styles_Stat-Block-Body` (a named trait/action) — all **new, from MM/G**.
  - Sidebar: `aside.text--rules-sidebar` — **confirmed** (Combat); generic `aside` and
    `blockquote` kept as fallbacks, unobserved in the sampled pages.
  - Inline tooltips: class ending in `-tooltip` (`rule-tooltip`, `condition-tooltip`,
    `skill-tooltip`, `sense-tooltip`, `action-tooltip`, `spell-tooltip`, `item-tooltip`,
    `magic-item-tooltip`, `monster-tooltip`, `weapon-properties-tooltip`) — **confirmed,
    enumerated** (Combat, MM/G); kept as inline text, not stripped.
  - Chrome to strip: tags `nav`, `header`, `footer`, `script`, `style`; class prefixes
    `quick-menu*`, `ddb-footer*` — **confirmed** (Combat, MM/G); hashed CSS-module classes
    matching `/^_[a-zA-Z]+_[a-z0-9]+/` (e.g. `_menuNav_1vzu8_31`) — **confirmed, pattern
    added** (Combat). Also new: inside the content root itself, a `select.nav-select`
    ("Jump to..." dropdown) and a hidden `#comp-next-nav` div precede the real content and
    must be stripped too (Combat, MM/G).
  - Not seen in the sampled pages, kept as unvalidated per the fixtures' own construction:
    a table with a true header *column* (`<th>` per row rather than a `<thead>` row) — the
    `equipment.html` fixture synthesizes one per FR-006/spec edge cases; real-export
    confirmation is the private suite's job (R6).

## R4 — Anchors and normalized text

- **Decision**: build one normalized text for the whole book while walking: block texts
  joined by `\n\n`, whitespace inside a block collapsed to single spaces, table cells joined
  by ` | ` and rows by `\n`. Record each block's `[start, end)` offsets into that string as
  UTF-16 code-unit offsets (JavaScript string indices).
- **Rationale**: FR-004 requires `text.slice(start, end) === block.text`; building the
  string and the offsets in one pass makes that true by construction, and the round-trip
  test proves it. UTF-16 indices are what `String.prototype.slice` uses in both the server
  and the SPA, so the UI can highlight a quote with no conversion.
- **Spec note**: spec says "count characters, not bytes"; UTF-16 code units satisfy that for
  all BMP text. Astral characters (emoji) count as 2; acceptable and documented in the
  contract.
- **Compatibility**: TASK-0022 stores `(book, section path, char span)` per chunk; TASK-0024's
  chunker splits blocks and derives chunk spans as sub-ranges of block spans. Both consume
  the `Anchor` type exported here.

## R5 — Fixtures (decision-0003)

- **Decision**: hand-built fixtures under `apps/server/test/fixtures/ddb/`, three pages:
  `basic-rules.html` (nested headings, prose, lists, a sidebar, skipped heading level),
  `equipment.html` (tables incl. caption, header column, a merged cell),
  `bestiary.html` (two SRD 5.1 stat blocks, one malformed). Each page wraps content in
  realistic chrome (nav, header, footer, a `<script>`, a `<style>`) that must be stripped.
  Text is original, or SRD 5.1 with the CC-BY-4.0 attribution in a `README.md` beside them.
- **Rationale**: Covers every FR-010 construct in three small files. SRD 5.1 is licensed for
  reuse; original prose is ours. Constitution VIII holds.

## R6 — Private real-export suite

- **Decision**: `apps/server/test/library/ddb.private.test.ts` uses
  `describe.skipIf(!existsSync(dir))` over `fixtures/private/ddb/` at the repo root, and when
  skipping prints one `console.warn` line: `ddb real-export suite SKIPPED: put D&D Beyond
  export pages in fixtures/private/ddb/ to run it`. `.gitignore` gains `fixtures/private/`.
- **Rationale**: Vitest reports the skipped suite; the warn line makes the reason visible in
  CI logs (FR-011, SC-005). The root `fixtures/` already exists (boundary violations), so
  `fixtures/private/` sits beside it.

## R7 — Performance (SC-004)

- **Decision**: no optimization work; a single-pass tree walk over parse5's tree. Add one
  test that parses a generated 300-page synthetic book (fixture repeated) and asserts under
  10 s.
- **Rationale**: parse5 parses megabytes per second; the walk is linear.
