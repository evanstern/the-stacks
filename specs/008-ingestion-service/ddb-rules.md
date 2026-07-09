# DDB Ingester Rules — ported knowledge from v2 `ddb_import.py`

**Provenance**: distilled 2026-07-07 from v2's `apps/api/app/ddb_import.py` (763
lines, final revision at `d7ae616~1`, recovered via git history per research R3).
This document is the REVIEWABLE port: the v3 plugin
(`packages/ingestion-plugins/src/ddb/`) implements these rules as data tables;
a reviewer can diff this file against the Python original. No code was copied —
rules, selectors, and allowlists were carried; v2 idioms (JSONL artifacts, file
writing, char-offset-by-string-search) were deliberately left behind.

## 1. Detection (v2 `is_ddb_saved_html`)

A source is DDB saved HTML iff BOTH hold:

1. **An article-like body exists** — first match of the selector priority list
   (§2) whose text is non-empty.
2. **At least one identity signal**:
   - a `saved from url=` marker in the first 20,000 chars matching
     `/saved\s+from(?:\s+url=\(\d+\))?\s*(https?:\/\/(?:www\.)?dndbeyond\.com\/\S+)/i`
     (browsers stamp this comment on "Save Page As"), or
   - a canonical-ish URL pointing at `dndbeyond.com`: first of
     `link[rel='canonical']`, `meta[property='og:url']`, `meta[name='twitter:url']`
     whose href/content contains the host and whose path is non-empty and NOT
     under `/forums`, or
   - DDB's own chunk markers inside the article:
     `[data-content-chunk-id]` or `[data-content-chunk]`.

v3 confidence mapping (new — v2 was boolean): article + `saved from` or
canonical URL → 0.95; article + only chunk markers → 0.85; otherwise 0.

## 2. Article selection (v2 `DDB_ARTICLE_SELECTORS`, priority order)

```text
div.p-article-content.u-typography-format
div#p-article-content.u-typography-format
article
main article
main .ddb-statblock
main .mon-stat-block
main .compendium-content
main .more-info-content
main .primary-content
main
```

First selector whose match has non-empty normalized text wins.

## 3. Boilerplate removal (v2 `DDB_BOILERPLATE_SELECTOR`)

Decompose before sanitizing: `script, style, template, iframe, object, embed,
nav, header, footer, aside, form, button, svg, [role='navigation'],
[aria-hidden='true'], .site-bar, .site-footer, .site-header,
.ddb-campaigns-character-card-footer` — plus all HTML comments.

## 4. Sanitization allowlist (v2 `DDB_ALLOWED_TAGS` / `_allow_ddb_attribute`)

- **Tags**: article section div span h1–h6 p ul ol li blockquote strong em b i
  u code pre table thead tbody tr th td a br. Everything else stripped
  (content kept, tag dropped).
- **Attributes**: drop `on*` and `style` always; allow `id`, `class`, `title`,
  `data-content-chunk-id`, `data-citation-id` on any tag; allow `href` on `a`
  only. v3 adds: `data-stacks-anchor` (our own anchor stamp).
- **Protocols**: http/https only.

## 5. Titles

- **Document title**: article `h1` text → `meta[property='og:title']` →
  `<title>`.
- **Book title**: `meta[property='og:site_name']` → `meta[name='ddb:book-title']`
  → `meta[name='book-title']` → split `<title>` on `-`/`—`/`|`, take the first
  part after the page title that is NOT a generic suffix
  (`ddb`, `d&d beyond`, `dungeons & dragons`, `sources`, …).
- v3: document title becomes `NormalizedDocument.title`; book title, when
  found, becomes the root of every section's `path`.

## 6. Sectioning (v2 `_extract_ddb_section_records`)

- Walk `h1`–`h6` in document order.
- Maintain a **heading stack**: entering a heading of level L pops stack items
  with level ≥ L, then pushes; the stack's texts are the section `path`.
- A section's body = the heading's following siblings up to the next heading
  (any level). Headings with an empty-text body are SKIPPED (v2 rule: no
  body, no section).
- Heading id: the DOM `id` if fresh, else a slug of the heading text
  (`[^0-9a-z]+` → `-`), deduplicated with `-2`, `-3`, … suffixes.
- DDB's `data-content-chunk-id` values found within the section are collected
  (order-preserving, deduped) — retained in v3 as section metadata inside the
  display artifact for future viewer use.
- v2 citation anchor `#<heading-id>` maps to v3 `anchor.elementId` — the
  sanitized fragment carries `data-stacks-anchor="<heading-id>"` on the
  heading element, and `charStart/charEnd` cover the section's text within
  the artifact's text content.

## 7. Content-kind classification (NEW in v3 — v2 had no kinds)

v2's selectors tell us what DDB structure looks like; v3 classifies with them:

| kind | rule (checked in order) |
|---|---|
| `stat_block` | section's nodes contain or sit inside `.mon-stat-block` or `.ddb-statblock` |
| `table` | the section body's dominant element is a `<table>` (table text ≥ half the section text) |
| `spell_entry` | ≥ 3 of the labels `Casting Time`, `Range`, `Components`, `Duration`, `Level` appear as leading emphasis/dt text in the section |
| `prose` | default for running text |
| `unclassified` | anything the above rules don't confidently cover — the honest default beats guessing |

## 8. Failure categories (v2 `ValueError` messages → v3 `PluginError`)

| v2 condition | v3 category |
|---|---|
| "HTML does not look like a saved D&D Beyond article" | `unrecognized` |
| "did not contain an article-like body" | `unrecognized` |
| "did not contain extractable article text" | `malformed` |
| undecodable bytes (v2 `utf-8-sig` decode failure) | `malformed` |

## 9. Deliberately NOT ported

- JSONL/manifest/file artifacts (`write_ddb_artifacts`) — v3 persists via the
  pipeline (document_sections/chunks), not plugin-side files.
- `to_parsed_document()` adapter — the NormalizedDocument IS the output now.
- Char offsets computed by `str.find` over raw markup — replaced by v3's
  artifact-relative text offsets (contracts/normalized-document.md).
- `DdbMetadata`'s kitchen-sink dict — v3 keeps only what the contract names.
