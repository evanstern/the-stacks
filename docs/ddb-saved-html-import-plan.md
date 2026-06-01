# D&D Beyond Saved HTML Import Plan

## Goal

Build a saved-HTML D&D Beyond importer, not a live scraper. Phase 1 operates only on user-supplied local HTML files, preserves the original source, generates a clean renderable citation page, produces normalized JSONL, and feeds the same parsed content into the existing app ingestion pipeline.

This feature should be framed as import of user-provided, locally saved D&D Beyond HTML pages for personal/library processing. It should not initially implement automated live D&D Beyond scraping, login/session handling, credential storage, browser automation, or assumptions about a public D&D Beyond API.

## Current Fixture

The first captured page currently lives at:

```text
/home/coda/projects/the-stacks/dmg/A World of Your Own - Dungeon Master’s Guide (2014) - Dungeons & Dragons - Sources - D&D Beyond.html
```

Useful article content appears inside:

```css
div.p-article-content.u-typography-format
```

Known heading anchors in that fixture include:

```text
AWorldofYourOwn
TheBigPicture
CoreAssumptions
```

The existing ingestion pipeline lives in:

```text
main/apps/api/app/ingestion.py
```

Upload queueing lives in:

```text
main/apps/api/app/routes_uploads.py
```

Tests and fixtures should live under:

```text
main/apps/api/tests
```

## Artifact Contract

For each DDB page, produce three artifacts:

```text
raw/
  dmg-2014/a-world-of-your-own.html

rendered/
  dmg-2014/a-world-of-your-own.html

normalized/
  dmg-2014/a-world-of-your-own.jsonl
```

Raw HTML is byte-for-byte source preservation. Rendered HTML is sanitized/focused article HTML for citation viewing. JSONL is the normalized machine-readable import/debug format.

Each normalized record should carry:

```json
{
  "source_type": "ddb_saved_html",
  "book_title": "Dungeon Master’s Guide (2014)",
  "document_title": "A World of Your Own",
  "section_path": ["A World of Your Own", "The Big Picture"],
  "heading_level": 2,
  "heading_id": "TheBigPicture",
  "content_chunk_id": "ccc4daa1-ee2f-4197-9e2d-93bc55da77fd",
  "chunk_index": 1,
  "text": "...",
  "html": "<section id=\"TheBigPicture\">...</section>",
  "citation": {
    "label": "Dungeon Master’s Guide (2014), A World of Your Own > The Big Picture",
    "source_url": "https://www.dndbeyond.com/sources/dnd/dmg-2014/a-world-of-your-own#TheBigPicture",
    "raw_html_path": "raw/dmg-2014/a-world-of-your-own.html",
    "rendered_html_path": "rendered/dmg-2014/a-world-of-your-own.html",
    "raw_sha256": "...",
    "heading_id": "TheBigPicture",
    "content_chunk_id": "ccc4daa1-ee2f-4197-9e2d-93bc55da77fd"
  }
}
```

## Phase 1: Fixture Setup

Copy the uploaded page into:

```text
main/apps/api/tests/fixtures/ddb/a-world-of-your-own-ddb.html
```

Keep a reduced synthetic DDB-like fixture too if we want tests that avoid relying on full copyrighted text. The synthetic fixture should preserve:

- DDB-like wrapper markup.
- `div.p-article-content.u-typography-format`.
- `h1#AWorldofYourOwn`.
- `h2#TheBigPicture`.
- `h3#CoreAssumptions`.
- Example `data-content-chunk-id` attributes.
- Sample paragraphs, lists, and tables.

## Phase 2: New Parser Module

Add:

```text
main/apps/api/app/ddb_import.py
```

Put DDB-specific logic there, not directly inside the generic parser.

Suggested functions:

```python
def is_ddb_saved_html(html: str) -> bool:
    ...

def parse_ddb_saved_html(html: str, source_filename: str) -> DdbImport:
    ...

def sanitize_ddb_article_html(import_result: DdbImport) -> str:
    ...

def ddb_chunks_to_jsonl(import_result: DdbImport) -> str:
    ...

def ddb_import_to_parsed_document(import_result: DdbImport) -> ParsedDocument:
    ...
```

Use one shared parsed chunk model as the source for both JSONL and `ParsedDocument`. Do not create divergent parser paths.

## Phase 3: DDB Detection

Detect DDB saved HTML conservatively. Signals should include multiple of:

- `div.p-article-content.u-typography-format`.
- `D&D Beyond`.
- `Sources`.
- `data-content-chunk-id`.
- DDB source URL shape like `/sources/dnd/`.

If detection fails, fall back to the existing generic HTML parser.

Do not fetch remote URLs, authenticate, infer ownership, or require credentials.

## Phase 4: Raw Source Preservation

Before parsing or sanitizing:

- Preserve the original uploaded/saved HTML unchanged.
- Compute `raw_sha256`.
- Record original filename.
- Record raw byte size.
- Detect source URL from `<!-- saved from url=... -->` when present.
- Set source type to `ddb_saved_html`.

Raw HTML must never be overwritten by sanitized/rendered content.

Recommended metadata:

```json
{
  "source_type": "ddb_saved_html",
  "original_filename": "A World of Your Own - Dungeon Master’s Guide (2014) - Dungeons & Dragons - Sources - D&D Beyond.html",
  "raw_sha256": "...",
  "raw_byte_size": 123456,
  "raw_artifact": "raw/dmg-2014/a-world-of-your-own.html",
  "created_from": "user_supplied_saved_html"
}
```

## Phase 5: Article Extraction

Target the content root:

```css
div.p-article-content.u-typography-format
```

Extraction behavior:

- Extract document title from the primary article heading, usually `h1`.
- Build section hierarchy from `h1` through `h6`.
- Preserve heading IDs.
- Preserve `data-content-chunk-id` when attached to relevant elements.
- Preserve meaningful inline HTML for rendered citations.
- Normalize text for ingestion.

Initial chunking strategy:

- Chunk by logical heading section.
- Each heading begins a new logical chunk.
- Include section path in every chunk.
- Let the existing ingestion chunking split further by length if needed.

Example logical chunk:

```json
{
  "section_path": ["A World of Your Own", "The Big Picture", "Core Assumptions"],
  "heading_level": 3,
  "heading_id": "CoreAssumptions",
  "text": "...",
  "html": "..."
}
```

Do not discard heading hierarchy or `data-content-chunk-id`.

## Phase 6: Renderable Citation HTML

Generate a sanitized article-only HTML document.

Preserve meaningful formatting:

- Headings.
- Paragraphs.
- Lists.
- Tables.
- Blockquotes/callouts.
- Inline emphasis.
- Links and anchors where safe.

Strip unsafe/noisy content:

- `script`.
- `style`, unless the app later supports scoped styles safely.
- `iframe`.
- `object`.
- `embed`.
- `form`.
- `input`.
- `button`.
- `nav`.
- `aside`.
- Advertising/sidebar wrappers.
- Tracking.
- Event handlers like `onclick` and `onload`.

Each chunk should have enough metadata for the UI to open a rendered source page at an anchor:

```text
rendered/dmg-2014/a-world-of-your-own.html#TheBigPicture
```

## Phase 7: JSONL Output

Generate JSONL from the same parsed chunk objects used for app ingestion.

Required fields per line:

```json
{
  "source_type": "ddb_saved_html",
  "document_title": "...",
  "book_title": "...",
  "section_path": ["...", "..."],
  "heading_level": 2,
  "heading_id": "...",
  "content_chunk_id": "...",
  "chunk_index": 0,
  "text": "...",
  "html": "...",
  "citation": {
    "label": "...",
    "source_file": "...",
    "source_url": "...",
    "raw_sha256": "...",
    "heading_id": "...",
    "content_chunk_id": "..."
  }
}
```

Every JSONL line must parse independently with `json.loads`.

## Phase 8: ParsedDocument Integration

Integrate into:

```text
main/apps/api/app/ingestion.py
```

When parsing `.html`:

1. Read HTML.
2. Detect DDB saved HTML.
3. If DDB, use the DDB parser and return a `ParsedDocument`.
4. If not DDB, keep the existing generic HTML behavior.

The resulting `ParsedDocument` should preserve:

- Title.
- Normalized text.
- Source type.
- Raw source hash.
- Rendered artifact reference where possible.
- JSONL artifact reference where possible.
- Citation metadata.
- Section path and heading IDs.
- `data-content-chunk-id` where present.

Generic HTML ingestion must remain unchanged.

## Phase 9: Upload Flow

Keep using existing upload queueing in:

```text
main/apps/api/app/routes_uploads.py
```

No new live scrape endpoint in Phase 1.

Expected flow:

1. User uploads saved `.html`.
2. Worker detects DDB page during ingestion.
3. Worker imports with DDB-specific parser.
4. Generic HTML still imports normally when DDB detection does not match.

## Phase 10: Tests

Add:

```text
main/apps/api/tests/test_ddb_import.py
```

Test cases:

1. `test_detects_ddb_saved_html_fixture`
   - DDB fixture returns true.
   - Generic HTML fixture returns false.

2. `test_preserves_raw_html_hash`
   - Raw fixture hash equals preserved artifact hash.
   - Sanitized/rendered HTML does not overwrite raw.

3. `test_extracts_article_content_root`
   - Main article root is found.
   - Document title is `A World of Your Own`.
   - Extracted content excludes DDB nav/sidebar/login/footer chrome.

4. `test_extracts_heading_section_paths`
   - Expected paths exist:
     - `["A World of Your Own"]`
     - `["A World of Your Own", "The Big Picture"]`
     - `["A World of Your Own", "The Big Picture", "Core Assumptions"]`

5. `test_preserves_citation_metadata`
   - Heading IDs exist:
     - `AWorldofYourOwn`
     - `TheBigPicture`
     - `CoreAssumptions`
   - `data-content-chunk-id` is preserved where present.
   - Citation label contains book/document/section information.

6. `test_generates_sanitized_renderable_html`
   - Sanitized HTML contains headings and paragraphs.
   - Sanitized HTML preserves IDs.
   - Sanitized HTML does not contain `script`, `iframe`, `onclick`, or `onload`.

7. `test_writes_normalized_jsonl_chunks`
   - Every line parses as JSON.
   - At least one chunk has heading ID `CoreAssumptions`.
   - Every chunk includes `source_type`, `text`, `html`, `section_path`, `citation`, and `raw_sha256`.

8. `test_ddb_html_ingests_as_parsed_document`
   - Existing ingestion entrypoint returns a `ParsedDocument`.
   - Parsed text includes expected fixture phrases.
   - Metadata includes `source_type=ddb_saved_html`, `raw_sha256`, and citation fields where supported.

9. `test_generic_html_still_uses_existing_ingestion`
   - Generic HTML does not use the DDB parser.
   - Existing generic HTML behavior is unchanged.

## Verification

Targeted test run:

```bash
cd /home/coda/projects/the-stacks/main/apps/api
python -m pytest tests/test_ddb_import.py
```

Full API test run:

```bash
cd /home/coda/projects/the-stacks/main/apps/api
python -m pytest tests
```

Completion requires evidence that:

- Targeted DDB parser tests pass.
- Full API tests pass.
- Raw HTML hash equals fixture hash.
- Sanitized HTML strips unsafe tags/attributes.
- JSONL lines parse cleanly.
- `ParsedDocument` ingestion returns expected metadata.
- Generic HTML regression still passes.

## Constraints

- Must preserve raw HTML source before any parser/sanitizer mutation.
- Must generate sanitized/renderable HTML for formatted citation display.
- Must generate normalized JSONL chunks from the same parsed chunk model used for app ingestion.
- Must support direct `ParsedDocument` ingestion through `main/apps/api/app/ingestion.py`.
- Must include citation metadata with heading IDs, section paths, source file metadata, raw hash, and `data-content-chunk-id` where available.
- Must preserve existing generic HTML ingestion behavior.
- Must not implement live scraping in Phase 1.
- Must not store D&D Beyond credentials.
- Must not assume a public D&D Beyond API.
- Must not implement browser automation or login flows in Phase 1.
