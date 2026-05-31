# Importer parity matrix

This matrix defines the #19 Go importer behavior that the TypeScript importer
must preserve. The goal is parity coverage, not implementation. The fixture suite
under `fixtures/` is synthetic/public-domain-style data that later adapter tasks
can use without copying the historical D&D corpus or any copyrighted ebook
content.

## Fixture map

| Fixture | Purpose | Expected later adapter use |
|---|---|---|
| `fixtures/corpus/sample.md` | Markdown with frontmatter, duplicate headings, and body text | Markdown title/metadata extraction, ordered section creation, duplicate heading stability |
| `fixtures/corpus/sample.txt` | Plain UTF-8 text with title-like first line and paragraphs | Text title fallback, paragraph/section normalization |
| `fixtures/corpus/sample.epub` | Tiny generated EPUB 3 container with one chapter | EPUB loader smoke, metadata extraction, spine/chapter ordering |
| `fixtures/corpus/sample.mobi` | Tiny synthetic MOBI-signature payload | MOBI loader smoke and unsupported/minimal-parser behavior |
| `fixtures/mediawiki/simple-page.json` | Single MediaWiki-style page with every required page field | Happy-path page normalization and raw JSON preservation |
| `fixtures/mediawiki/malformed.json` | Intentionally invalid JSON | Failed parse behavior for malformed MediaWiki input |
| `fixtures/mediawiki/approval-manifest.json` | Approval manifest with approved/rejected/deferred arrays and policy | Decision import, counts, missing approved page strict/non-strict behavior |

## #19 behavior matrix

| Parity item | #19 behavior to preserve | TypeScript acceptance target | Fixture coverage |
|---|---|---|---|
| approval manifest decisions | Read approval manifest arrays named `approved`, `rejected`, and `deferred`; preserve each title and rationale/reason as an auditable decision. | Import creates review records or import proposals for all three states without collapsing rejected/deferred into warnings. | `fixtures/mediawiki/approval-manifest.json` |
| policy preservation | Preserve the manifest `policy` field as structured metadata attached to the import run or corpus decision set. | Policy JSON round-trips exactly enough for audit, export, and comparison against the original manifest. | `fixtures/mediawiki/approval-manifest.json` |
| normalized title behavior | Match #19 normalized title behavior when mapping manifest titles to page files/records: trim surrounding whitespace, use underscore/space equivalence for page lookup, and keep the display title from the page JSON when present. | `Sample Page`, `Sample_Page`, and equivalent normalized lookup keys resolve to the same document while preserving the user-visible title. | `fixtures/mediawiki/simple-page.json`, `fixtures/mediawiki/approval-manifest.json` |
| page JSON fields | Read and persist the MediaWiki page JSON fields `title`, `page_id`, `revision_id`, `timestamp`, `dump_date`, `source`, `source_tier`, `source_url`, `categories`, `links`, and `text`. | Normalized document/provenance records expose every listed field, with categories and links kept as ordered arrays. | `fixtures/mediawiki/simple-page.json` |
| raw JSON preservation | Preserve the raw JSON payload for each imported page so later audit/export can compare normalized records against source input. | Storage includes the original page JSON, not only derived fields; malformed JSON creates a parse failure rather than a partial raw payload. | `fixtures/mediawiki/simple-page.json`, `fixtures/mediawiki/malformed.json` |
| missing approved page default | If an approved manifest entry has no matching page artifact, non-strict import records a warning and continues. | Default mode reports the missing approved title, increments `missing`, and still imports available approved pages. | `fixtures/mediawiki/approval-manifest.json` includes `Missing Approved Page` |
| missing approved page strict mode | In strict mode, a missing approved page is a hard error. | Strict mode fails the import with a clear `missing approved page` error and does not mark the run ready. | `fixtures/mediawiki/approval-manifest.json` includes `Missing Approved Page` |
| counts | Report counts for `approved`, `rejected`, `deferred`, imported `pages`, and `missing`. | Fixture import should report `approved=2`, `rejected=1`, `deferred=1`, `pages=1`, `missing=1` when only `simple-page.json` is available. | `fixtures/mediawiki/approval-manifest.json`, `fixtures/mediawiki/simple-page.json` |
| idempotent reimport/upsert behavior | Reimporting the same manifest/page set upserts stable corpus records instead of duplicating decisions, pages, categories, links, or raw JSON blobs. | Running the same import twice produces a new import-run audit entry if desired, but stable source/document/page rows are updated in place or deduplicated by the agreed key. | all MediaWiki fixtures |

## Required later tests

Later adapter tasks should turn this matrix into executable tests:

1. Load `approval-manifest.json` and verify all approval manifest decision arrays
   plus policy preservation.
2. Import `simple-page.json` and assert title normalization, every required page
   JSON field, category/link ordering, text extraction, and raw JSON storage.
3. Import `approval-manifest.json` with only `simple-page.json` available in
   non-strict mode and assert counts plus a warning for the missing approved
   page.
4. Repeat the same run in strict mode and assert the hard error path.
5. Re-run the successful import and assert idempotent reimport/upsert behavior.
6. Load `malformed.json` and assert failed-parse reporting without hidden partial
   success.

## Scope boundary

This task does not implement adapters, database writes, retrieval, review UI, or
LangGraph orchestration. It only creates fixtures and locks the parity contract
that those later tasks must satisfy.
