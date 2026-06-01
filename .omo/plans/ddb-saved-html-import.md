# OMO Plan: D&D Beyond Saved HTML Import

## Objective

Implement a saved-HTML D&D Beyond import path that preserves the original page source, generates a sanitized/renderable citation artifact, produces normalized JSONL, and feeds the same parsed content into the existing app ingestion pipeline.

This plan starts with user-supplied local HTML files. It explicitly does not implement live scraping, D&D Beyond login/session handling, credential storage, browser automation, or assumptions about a public D&D Beyond API.

## Hyperplan Review Status

Reviewed through OMO Hyperplan with category reviewers:

- `unspecified-low`
- `unspecified-high`
- `ultrabrain`
- `artistry`
- `deep`

Critiques incorporated:

- Pinned fixture policy.
- Concrete artifact storage layout.
- Byte-level raw hash semantics.
- Explicit DDB-first/generic-fallback ingestion call chain.
- DOM parser and sanitizer dependency choice.
- Metadata propagation through `ParsedSection`, `ParsedDocument`, and `chunk_document`.
- Exact test files and regression assertions.

## Non-Negotiables

- Preserve raw HTML byte-for-byte before any parsing or sanitization.
- Compute `raw_sha256` from original file bytes, not decoded/re-serialized text.
- Generate sanitized/renderable article HTML for formatted citation display.
- Generate normalized JSONL from the same parsed chunk model used for app ingestion.
- Support direct `ParsedDocument` ingestion through `main/apps/api/app/ingestion.py`.
- Preserve heading IDs, section paths, source file metadata, raw hash, source URL, and `data-content-chunk-id` where available.
- Propagate DDB citation metadata into persisted `DocumentChunk.metadata_json` and RAG citation metadata.
- Preserve existing generic HTML ingestion behavior.
- Do not add live scraping, credential storage, DDB auth/session flows, or browser automation in this phase.

## Current Repo Context

First captured page outside the repo app:

```text
/home/coda/projects/the-stacks/dmg/A World of Your Own - Dungeon Master’s Guide (2014) - Dungeons & Dragons - Sources - D&D Beyond.html
```

Useful article selector:

```css
div.p-article-content.u-typography-format
```

Known headings from fixture:

```text
AWorldofYourOwn
TheBigPicture
CoreAssumptions
```

Existing ingestion model:

```text
main/apps/api/app/ingestion.py
```

Important existing constraints:

- `ParsedSection` currently has only `heading`, `text`, `start_char`, and `end_char`.
- `ParsedDocument` currently has only `parser`, `title`, `sections`, and `warnings`.
- `chunk_document` builds persisted chunk metadata in `main/apps/api/app/ingestion.py`.
- Existing HTML parsing uses Python `html.parser`, not a CSS selector-capable DOM parser.
- `main/apps/api/requirements.txt` currently has no HTML sanitizer or DOM parsing library.

Relevant current tests:

```text
main/apps/api/tests/test_parsers.py
main/apps/api/tests/test_html_parser.py
main/apps/api/tests/test_chunking.py
main/apps/api/tests/test_worker_jobs.py
main/apps/api/tests/test_uploads.py
main/apps/api/tests/test_citations.py
```

## Fixture Policy

Do not commit the full real D&D Beyond saved page as a test fixture.

Reason: the full captured page may contain copyrighted source text and user/account/browser artifacts. It is useful for local/private validation but should not become the committed regression fixture.

Commit a reduced synthetic DDB-like fixture at:

```text
main/apps/api/tests/fixtures/ddb/a-world-of-your-own-ddb.html
```

The synthetic fixture must preserve the relevant DDB structure and selectors while using short synthetic text:

- `<!-- saved from url=(0066)https://www.dndbeyond.com/sources/dnd/dmg-2014/a-world-of-your-own -->`
- `<title>A World of Your Own - Dungeon Master’s Guide (2014) - Dungeons & Dragons - Sources - D&D Beyond</title>`
- A sidebar/nav/footer/script area that must be excluded.
- `div.p-article-content.u-typography-format`.
- `h1#AWorldofYourOwn`.
- `h2#TheBigPicture`.
- `h3#CoreAssumptions`.
- `data-content-chunk-id` attributes.
- At least one paragraph, list, and table inside article content.
- At least one unsafe/event attribute in article content for sanitizer regression, such as `onclick`, that must be stripped.

Keep the uploaded real file in `/home/coda/projects/the-stacks/dmg/` as a local manual/private validation sample only. Do not copy it into committed tests unless the user explicitly approves that legal/privacy tradeoff.

## Dependency Decision

Add explicit API dependencies for the DDB parser/sanitizer:

```text
beautifulsoup4
bleach
```

Update:

```text
main/apps/api/requirements.txt
```

Rationale:

- BeautifulSoup provides reliable DOM traversal and CSS selector support for saved HTML.
- Bleach provides explicit allowlist-based sanitization.
- Existing `html.parser` remains available for the generic parser and should not be replaced wholesale.

Do not use a browser or Playwright in Phase 1.

## Target Artifact Storage Layout

Artifact generation is tied to the existing uploaded file path, not a new global storage system.

For an uploaded file at:

```text
<stored_path>
```

create sibling artifact directory:

```text
<stored_path>.artifacts/
  raw.html
  rendered.html
  chunks.jsonl
  manifest.json
```

Example:

```text
uploads/abc123.html
uploads/abc123.html.artifacts/raw.html
uploads/abc123.html.artifacts/rendered.html
uploads/abc123.html.artifacts/chunks.jsonl
uploads/abc123.html.artifacts/manifest.json
```

Artifact rules:

- `raw.html` is copied from the original uploaded file bytes before any decode or parse step.
- `rendered.html` is sanitized article-only HTML.
- `chunks.jsonl` is generated from the shared parsed chunk model.
- `manifest.json` records source metadata and artifact relative paths.

Manifest shape:

```json
{
  "source_type": "ddb_saved_html",
  "original_filename": "a-world-of-your-own.html",
  "source_url": "https://www.dndbeyond.com/sources/dnd/dmg-2014/a-world-of-your-own",
  "raw_sha256": "...",
  "raw_byte_size": 12345,
  "raw_html_path": "uploads/abc123.html.artifacts/raw.html",
  "rendered_html_path": "uploads/abc123.html.artifacts/rendered.html",
  "jsonl_path": "uploads/abc123.html.artifacts/chunks.jsonl"
}
```

If artifact writing fails, fail the DDB import rather than silently ingesting without citation artifacts.

## Raw Byte and Encoding Semantics

The DDB parse path must read original file bytes first:

```python
raw_bytes = path.read_bytes()
raw_sha256 = hashlib.sha256(raw_bytes).hexdigest()
```

Then decode for parsing:

```python
html = raw_bytes.decode("utf-8")
```

If UTF-8 decode fails, raise the existing `ParserError` style error.

Do not compute `raw_sha256` from `Path.read_text()`, normalized newlines, BeautifulSoup output, sanitized HTML, or any re-serialized string.

The generic HTML parser may keep its existing text read path unless implementation chooses to centralize byte reads without behavior changes.

## Parsed Model Changes

Extend the parsed ingestion model minimally so DDB metadata survives chunking and citation persistence.

Update `ParsedSection` in `main/apps/api/app/ingestion.py` to include optional metadata:

```python
@dataclass(frozen=True)
class ParsedSection:
    heading: str | None
    text: str
    start_char: int
    end_char: int
    metadata: dict[str, object] = field(default_factory=dict)
```

Update `ParsedDocument` to include optional metadata:

```python
@dataclass(frozen=True)
class ParsedDocument:
    parser: str
    title: str | None
    sections: list[ParsedSection]
    warnings: list[str] = field(default_factory=list)
    metadata: dict[str, object] = field(default_factory=dict)
```

Update all existing constructors/tests to tolerate default metadata. Generic parser behavior should remain unchanged.

Update `chunk_document` to merge document and section metadata into chunk metadata without overwriting existing base fields unexpectedly:

```python
metadata = {
    ...existing base fields...
}
metadata.update({"document_metadata": document.metadata})
metadata.update(section.metadata)
```

DDB section metadata must include:

- `source_type`
- `book_title`
- `document_title`
- `section_path`
- `heading_level`
- `heading_id`
- `content_chunk_ids`
- `source_url`
- `raw_sha256`
- `raw_html_path`
- `rendered_html_path`
- `jsonl_path`
- `citation_label`
- `citation_anchor`

## Normalized Chunk Contract

For JSONL, each logical DDB chunk line must include:

```json
{
  "source_type": "ddb_saved_html",
  "book_title": "Dungeon Master’s Guide (2014)",
  "document_title": "A World of Your Own",
  "section_path": ["A World of Your Own", "The Big Picture"],
  "heading_level": 2,
  "heading_id": "TheBigPicture",
  "content_chunk_ids": ["ccc4daa1-ee2f-4197-9e2d-93bc55da77fd"],
  "chunk_index": 1,
  "text": "...",
  "html": "<section id=\"TheBigPicture\">...</section>",
  "citation": {
    "label": "Dungeon Master’s Guide (2014), A World of Your Own > The Big Picture",
    "source_url": "https://www.dndbeyond.com/sources/dnd/dmg-2014/a-world-of-your-own#TheBigPicture",
    "raw_html_path": "uploads/abc123.html.artifacts/raw.html",
    "rendered_html_path": "uploads/abc123.html.artifacts/rendered.html",
    "jsonl_path": "uploads/abc123.html.artifacts/chunks.jsonl",
    "raw_sha256": "...",
    "heading_id": "TheBigPicture",
    "content_chunk_ids": ["ccc4daa1-ee2f-4197-9e2d-93bc55da77fd"]
  }
}
```

Use `content_chunk_ids` as a list because a logical heading section may include multiple descendant elements with `data-content-chunk-id`.

## Ingestion Dispatch Call Chain

DDB detection happens inside `parse_document`, before generic HTML parsing.

Exact precedence in `main/apps/api/app/ingestion.py`:

1. `process_claimed_job` calls `parse_document(Path(upload.stored_path), upload.extension)` as it does today.
2. `parse_document` lowercases the extension.
3. For `.html` or `.htm`, `parse_document` reads original bytes.
4. It decodes UTF-8 to a string.
5. It calls `is_ddb_saved_html(html)`.
6. If true, it calls `parse_ddb_saved_html(path=path, raw_bytes=raw_bytes, source_filename=path.name or upload filename if threaded through)`.
7. If false, it calls existing `_parse_html(raw_text)`.
8. Non-HTML formats keep existing behavior.

Do not put DDB detection in `routes_uploads.py`. Upload routing should continue accepting `.html` normally. The worker/parser decides whether an HTML file is DDB-specific.

If implementation needs `upload.original_filename` for artifact metadata, add an optional `source_filename` argument to `parse_document` and thread it from `process_claimed_job`. Do not block the first implementation on this if `path.name` is sufficient for tests.

## Work Breakdown

### Task 1: Add Dependencies

Where:

```text
main/apps/api/requirements.txt
```

How:

- Add `beautifulsoup4`.
- Add `bleach`.
- Keep existing generic parser intact.

Expected result:

- API environment has DOM selection and HTML sanitization libraries available.

QA:

```bash
cd /home/coda/projects/the-stacks/main/apps/api
python -m pytest tests/test_parsers.py tests/test_html_parser.py
```

### Task 2: Add Synthetic DDB Fixtures

Where:

```text
main/apps/api/tests/fixtures/ddb/a-world-of-your-own-ddb.html
main/apps/api/tests/fixtures/ddb/generic-not-ddb.html
```

How:

- Create committed synthetic DDB fixture per Fixture Policy.
- Add a generic HTML fixture or use existing `tests/fixtures/sample.html` for non-DDB regression.

Expected result:

- DDB tests are reproducible without committing the real DDB page.

QA:

- `a-world-of-your-own-ddb.html` contains `p-article-content u-typography-format`, the three known heading IDs, synthetic `data-content-chunk-id` values, nav/sidebar/footer/script noise, and article table/list content.
- Generic fixture does not contain DDB markers.

### Task 3: Add DDB Import Module and Data Model

Where:

```text
main/apps/api/app/ddb_import.py
```

How:

Add a focused module with dataclasses/types for:

- `DdbImport`
- `DdbChunk`
- `DdbCitation`
- `DdbArtifacts`

Add functions:

```python
def is_ddb_saved_html(html: str) -> bool: ...
def parse_ddb_saved_html(path: Path, raw_bytes: bytes, source_filename: str | None = None) -> ParsedDocument: ...
def extract_ddb_chunks(html: str, metadata: DdbArtifacts) -> DdbImport: ...
def sanitize_ddb_article_html(article_soup: object) -> str: ...
def ddb_chunks_to_jsonl(import_result: DdbImport) -> str: ...
def write_ddb_artifacts(import_result: DdbImport, artifact_dir: Path) -> DdbArtifacts: ...
```

Expected result:

- DDB-specific parsing is isolated from generic ingestion.
- JSONL and `ParsedDocument` both derive from the same parsed chunk objects.
- Artifact writing is part of DDB parsing and fails loudly on write errors.

QA:

- Unit tests import `app.ddb_import` without circular import errors.
- Tests can call detection, extraction, sanitization, JSONL generation, and `parse_document` integration.

### Task 4: Implement Conservative Detection

Where:

```text
main/apps/api/app/ddb_import.py
main/apps/api/tests/test_ddb_import.py
main/apps/api/tests/test_parsers.py
```

How:

Implement `is_ddb_saved_html` using multiple signals:

- `p-article-content` and `u-typography-format`.
- `D&D Beyond` or `Dungeons & Dragons - Sources - D&D Beyond`.
- `data-content-chunk-id`.
- `/sources/dnd/` in saved-source URL, metadata, or links.

Require the article selector plus at least one DDB identity/source signal. Do not classify generic HTML as DDB only because it contains a matching phrase.

Expected result:

- The DDB fixture returns true.
- Generic HTML returns false.
- Detection does not fetch remote URLs.

QA assertions:

- `is_ddb_saved_html(ddb_fixture_html) is True`.
- `is_ddb_saved_html(generic_html) is False`.
- `parse_document(generic_html_path, ".html").parser == "html"`.

### Task 5: Preserve Raw Source and Write Artifacts

Where:

```text
main/apps/api/app/ddb_import.py
main/apps/api/tests/test_ddb_import.py
```

How:

During DDB parse:

- Read and hash original bytes before decode.
- Write `<stored_path>.artifacts/raw.html` from exact original bytes.
- Write `manifest.json` with raw metadata and artifact paths.
- Write `rendered.html` and `chunks.jsonl` after extraction.
- Raise `ParserError` on artifact write failure.

Expected result:

- Raw source hash is stable and testable.
- Raw source bytes are preserved exactly.
- Manifest gives the app stable artifact paths for citations.

QA assertions:

- `hashlib.sha256(fixture_path.read_bytes()).hexdigest()` equals parser `raw_sha256`.
- `raw.html.read_bytes() == fixture_path.read_bytes()`.
- `manifest.json` includes `source_type`, `source_url`, `raw_sha256`, `raw_byte_size`, `raw_html_path`, `rendered_html_path`, and `jsonl_path`.

### Task 6: Extract Article Sections and Metadata

Where:

```text
main/apps/api/app/ddb_import.py
main/apps/api/tests/test_ddb_import.py
```

How:

- Locate `div.p-article-content.u-typography-format` using BeautifulSoup selection.
- Extract document title from primary article `h1`.
- Extract book title from page title/metadata.
- Walk article content in document order.
- Build heading hierarchy from `h1` through `h6`.
- Start a logical chunk at each heading.
- Preserve heading ID, heading level, section path, text, HTML fragment, and all `data-content-chunk-id` values under that section.
- Exclude page nav, sidebar, login UI, footer, article social/footer chrome, scripts, and global menus.

Expected result:

- Logical chunks exist for `AWorldofYourOwn`, `TheBigPicture`, and `CoreAssumptions`.
- Section paths are correct.
- Text is clean enough for ingestion.
- HTML fragments remain useful for citation rendering.

QA assertions:

- Expected heading IDs exist.
- Expected section paths exist:
  - `["A World of Your Own"]`
  - `["A World of Your Own", "The Big Picture"]`
  - `["A World of Your Own", "The Big Picture", "Core Assumptions"]`
- Extracted text includes synthetic fixture article phrases.
- Extracted text excludes synthetic nav/sidebar/footer phrases.
- `content_chunk_ids` includes fixture values.

### Task 7: Generate Sanitized Renderable HTML

Where:

```text
main/apps/api/app/ddb_import.py
main/apps/api/tests/test_ddb_import.py
```

How:

Generate article-only HTML from parsed content and sanitize with Bleach.

Allowed tags:

```text
article section div span h1 h2 h3 h4 h5 h6 p br strong em b i u ul ol li table thead tbody tr th td blockquote code pre a
```

Allowed attributes:

```text
id class href title data-content-chunk-id data-citation-id
```

Allowed protocols:

```text
http https
```

Strip:

- `script`, `style`, `iframe`, `object`, `embed`.
- `form`, `input`, `button`.
- `nav`, `aside`.
- Event handlers like `onclick` and `onload`.
- External tracking/chrome wrappers.

Expected result:

- `rendered.html` can be displayed for citations using stable anchors like `#TheBigPicture`.
- Rendered HTML is article-focused and safe enough for app display.

QA assertions:

- Rendered HTML contains `h1`, `h2`, `h3`, `p`, `ul`, and `table` from fixture.
- Rendered HTML preserves `AWorldofYourOwn`, `TheBigPicture`, and `CoreAssumptions` IDs.
- Rendered HTML does not contain `script`, `iframe`, `onclick`, `onload`, `<nav`, or `<aside`.

### Task 8: Generate Normalized JSONL

Where:

```text
main/apps/api/app/ddb_import.py
main/apps/api/tests/test_ddb_import.py
```

How:

Implement `ddb_chunks_to_jsonl(import_result)` from the shared parsed chunks.

Expected result:

- JSONL is valid line-delimited JSON.
- Every line independently parses with `json.loads`.
- JSONL and `ParsedDocument` cannot drift because both use the same parsed chunks.

QA assertions:

- Every JSONL line parses.
- At least one line has `heading_id == "CoreAssumptions"`.
- Every line includes `source_type`, `text`, `html`, `section_path`, `citation`, `raw_sha256`, and `content_chunk_ids`.

### Task 9: Propagate Metadata Through ParsedDocument and Chunking

Where:

```text
main/apps/api/app/ingestion.py
main/apps/api/tests/test_chunking.py
main/apps/api/tests/test_ddb_import.py
main/apps/api/tests/test_worker_jobs.py
```

How:

- Extend `ParsedSection` and `ParsedDocument` with optional metadata fields.
- Ensure existing tests still pass because defaults are empty dictionaries.
- Update `chunk_document` to include DDB section metadata in each persisted chunk metadata.
- Update worker job metadata to include DDB parser/document metadata when DDB parser is used.

Expected result:

- DDB citation metadata is present in `DocumentChunk.metadata_json`.
- RAG citation metadata can surface rendered artifact paths and anchors.
- Generic chunking metadata remains unchanged aside from an empty/default document metadata field only if unavoidable.

QA assertions:

- `test_chunk_document_adds_retrieval_metadata` still passes or is updated to assert existing base fields plus empty/default metadata behavior.
- DDB chunk metadata includes `source_type=ddb_saved_html`, `section_path`, `heading_id`, `content_chunk_ids`, `raw_sha256`, `rendered_html_path`, and `citation_anchor`.
- `test_worker_jobs.py` DDB worker test verifies persisted `DocumentChunk.metadata_json` contains citation metadata.

### Task 10: Integrate DDB-First HTML Dispatch

Where:

```text
main/apps/api/app/ingestion.py
main/apps/api/tests/test_parsers.py
main/apps/api/tests/test_html_parser.py
main/apps/api/tests/test_worker_jobs.py
```

How:

- Modify `parse_document` so `.html`/`.htm` reads bytes first.
- Decode UTF-8.
- Call `is_ddb_saved_html` before `_parse_html`.
- Use DDB parser on match.
- Use existing `_parse_html` fallback otherwise.
- Do not change upload route detection.

Expected result:

- DDB fixture parsed via `parse_document(..., ".html")` returns `parser == "ddb_saved_html"` or equivalent.
- Generic fixture parsed via `parse_document(..., ".html")` returns `parser == "html"` as before.

QA assertions:

- Add `test_ddb_html_dispatches_before_generic_html` in `tests/test_ddb_import.py`.
- Existing `test_html_parser_extracts_title_headings_and_blocks` in `tests/test_parsers.py` still passes.
- Existing `test_html_fixture_strips_boilerplate_and_preserves_metadata` in `tests/test_html_parser.py` still passes.

### Task 11: Preserve Upload Flow Without New Scraper

Where:

```text
main/apps/api/app/routes_uploads.py
main/apps/api/app/ingestion.py
main/apps/api/tests/test_uploads.py
main/apps/api/tests/test_worker_jobs.py
```

How:

- Keep existing upload route accepting `.html` and `.htm`.
- Do not add DDB-specific upload endpoint.
- Worker/parser decides whether saved HTML is DDB-specific.
- Add worker integration coverage for DDB fixture upload processing.

Expected result:

- A saved DDB `.html` upload flows through existing queueing and ingestion.
- Existing generic `.html` uploads remain supported.

QA assertions:

- Existing `tests/test_uploads.py` HTML acceptance tests still pass.
- New worker test creates an upload/job for synthetic DDB fixture, processes it, and asserts:
  - job parser metadata is DDB-specific
  - artifacts directory exists
  - persisted chunks include citation metadata
  - generic HTML worker test remains green

## Verification Commands

Install/update API dependencies if the environment is not already current:

```bash
cd /home/coda/projects/the-stacks/main/apps/api
python -m pip install -r requirements.txt
```

Targeted DDB importer tests:

```bash
cd /home/coda/projects/the-stacks/main/apps/api
python -m pytest tests/test_ddb_import.py
```

Regression tests around changed ingestion behavior:

```bash
cd /home/coda/projects/the-stacks/main/apps/api
python -m pytest tests/test_parsers.py tests/test_html_parser.py tests/test_chunking.py tests/test_worker_jobs.py tests/test_uploads.py tests/test_citations.py
```

Full API tests:

```bash
cd /home/coda/projects/the-stacks/main/apps/api
python -m pytest tests
```

Project-level test command, if applicable:

```bash
cd /home/coda/projects/the-stacks/main
make test
```

## Completion Criteria

- Targeted DDB parser tests pass.
- Ingestion/parser/chunking/upload/citation regression tests pass.
- Full API tests pass or unrelated pre-existing failures are explicitly documented.
- `raw_sha256` is computed from original fixture bytes.
- `raw.html` bytes equal original fixture bytes.
- Sanitized HTML strips unsafe tags/attributes.
- Rendered HTML preserves citation anchors.
- JSONL lines parse cleanly and match shared chunk model metadata.
- `ParsedDocument` ingestion returns expected text and metadata.
- Persisted `DocumentChunk.metadata_json` contains DDB citation metadata.
- Generic HTML regression still passes.
- No live scraping, DDB credentials, login/session handling, or browser automation is introduced.

## Deferred Decisions

These are intentionally deferred beyond Phase 1:

1. Whether to add a UI route for viewing `rendered.html` citation artifacts.
2. Whether to implement local Playwright capture automation.
3. Whether to support multi-page/book-level import manifests.
4. Whether to allow users to opt into committing/private-storing full real DDB captured pages.
