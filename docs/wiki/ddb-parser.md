---
name: ddb-parser
description: How parseDdbExport turns saved D&D Beyond export HTML pages (or, with headings:"all", any generic HTML page) into one ordered, anchored ParsedBook — the single-pass parse5 walk, chrome-stripping, table/stat-block whole-unit extraction, and how the fixture and private-suite carve-outs fit biome.json and .gitignore.
kind: concept
sources:
  - apps/server/src/library/ddb/index.ts
  - apps/server/src/library/ddb/walk.ts
  - apps/server/src/library/ddb/extract.ts
  - apps/server/src/library/ddb/selectors.ts
  - biome.json
  - .gitignore
verified_against: 9c2209b9453d211adf302bd86436ece4c2a23ed7
---

# DDB parser

`parseDdbExport({ book, pages }, options?)` (`apps/server/src/library/ddb/index.ts`) is a pure
function — no database, network, or filesystem access — that turns one or more saved D&D
Beyond export HTML pages into a `ParsedBook`: one continuous normalized `text` string plus an
ordered array of `Block`s (`heading`, `prose`, `list`, `table`, `statBlock`, `sidebar`), each
carrying a heading-path breadcrumb and a `[start, end)` UTF-16 anchor into `text`. Input and
output are both validated with Zod schemas (`ParseInputSchema`, `BlockSchema`,
`ParsedBookSchema`); any validation failure, or zero blocks found across all pages, throws
`ValidationError` before any partial `ParsedBook` is built — the function never returns a
half-parsed result.

`options?.headings` (TASK-0024, specs/017-ingestion-pipeline research R4) is `"ddb"` (default,
unchanged byte-for-byte) or `"all"`: generic HTML from another source rarely carries DDB's
`heading-anchor` class, so [[ingestion]] passes `{ headings: "all" }` for any non-DDB HTML
upload, making every `h1`-`h6` a section heading by tag alone rather than requiring that
class. A saved D&D Beyond export never needs this option.

## How it works

**Selectors are centralized (`selectors.ts`).** Every D&D Beyond class name this parser
depends on lives in one file — `.p-article-content` (content root), `heading-anchor` (section
headings), `.stat-block-background` and its part classes, chrome tags/classes to strip, and
so on. A markup change on DDB's side is a one-file edit; no other file in `ddb/` hardcodes a
class name.

**`walk.ts` does a single-pass parse5 tree walk per page.** For each page it parses the HTML,
finds the content root (falling back to `<body>` if the root selector doesn't match — a page
with neither is skipped entirely), and recursively visits it, building `text` and `blocks`
together in one pass so each block's anchor is correct without a second pass. Chrome
(`<nav>`, `<header>`, `<footer>`, `<script>`, `<style>`, DDB's own chrome classes, and its
hashed CSS-module classes) is skipped entirely, including inside text collection. A block
whose flattened text is empty after chrome-stripping and whitespace collapse is dropped, not
emitted. Headings track a path stack keyed by tag rank (`h1`-`h6`), popped back to the
incoming heading's level before pushing — the content root's own top `h1` (the chapter title)
is a heading by tag alone; every other real section heading carries `heading-anchor`, unless
`headings: "all"` is set, in which case every `h1`-`h6` counts regardless of class.
`<table>` and `.stat-block-background` subtrees are handed to `extract.ts` and emitted as one
whole `table`/`statBlock` block — never also recursed into as prose, so neither is
double-counted. `<p>` becomes `prose`; `<ul>`/`<ol>` becomes one `list` block with flattened
text (no per-item structure — a deliberate ponytail in `walk.ts`, add if a consumer needs
items). Any other container (`div`, `article`, `section`, `aside`, …) just recurses, so a
sidebar's `<p>`s still get their own blocks attached to the section they appear in. Each saved
page starts its heading stack fresh at `[book]` — a new page is a new top-level chapter, not a
nested continuation of the previous page's last heading.

**`extract.ts` builds the two whole-unit block payloads.** `extractTable` returns a caption
(the heading inside `<caption>`, if any), a header row (from `<thead>`, or an all-`<th>` first
row with no `<thead>` wrapper), and data rows — a header *column* (each row starts with a
`<th>`) leaves `header` empty and keeps each row's `<th>` as its first cell. A merged
(`colspan`) cell contributes exactly one entry, never duplicated across columns. `walk.ts`
joins a table's cells with `` | `` and its rows with newlines for the block's flattened
`text`. `extractStatBlock` reads the creature name and every `<strong>Label</strong> value`
line (armor class, hit points, …) plus the six ability scores into `{ label, value }` pairs;
values always stay strings. Metadata, subsection headings ("Actions"), and trait/action
bodies carry no label/value shape — they stay only in the block's flattened `text`.

**Fixtures and CI carve out the DDB test fixtures.** `apps/server/test/fixtures/ddb/` holds
three synthetic, original/SRD-5.1-only HTML fixtures (`basic-rules.html`, `equipment.html`,
`bestiary.html`) shaped like real exports; `biome.json`'s `files.includes` excludes that
directory (`!apps/server/test/fixtures/ddb`) because it's raw export-shaped markup, not app
code, and DDB's own empty anchor-hidden headings would otherwise trip an a11y lint rule that
doesn't apply to a fixture. A separate, real-export private suite
(`apps/server/test/library/ddb.private.test.ts`) reads
`fixtures/private/ddb/<book>/**/*.html` (one subdirectory per book) when that directory
exists and is non-empty, and loud-skips with a `console.warn` otherwise; `.gitignore`'s
`fixtures/private/` entry keeps any real book content out of version control (a later entry, `.playtests/`, ignores playtest run directories and is unrelated to this parser), and the suite
itself only ever logs per-book counts, never book text (constitution VIII). A perf suite
(`ddb.perf.test.ts`) parses a synthetic ~300-page book (the three fixtures repeated) and
asserts it finishes well inside a generous, CI-safe bound.

## Connections

Sits in the `library` plane, so [[monorepo-and-toolchain]]'s Biome `noRestrictedImports`
override for `apps/server/src/library/**` already covers `ddb/` — importing `codex` or
`session` directly from here fails lint with no config change needed
(`pnpm check:boundaries`). See [[test-suite]] for the server's broader test layout; the DDB
suites are `apps/server` unit tests, not database-gated integration suites. [[ingestion]]'s
worker is this function's only caller: it routes DDB-marked HTML through the default, and
every other HTML upload through `{ headings: "all" }`.
