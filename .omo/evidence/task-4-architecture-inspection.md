# Task 4: Architecture Inspection for Archives and Citations

Evidence date: 2026-06-01

## Plan references read

- `.omo/plans/ddb-saved-html-import.md` lines 250-288 define the DDB metadata/chunk contract fields that archive-source ingestion needs to preserve: `source_type`, `book_title`, `document_title`, `section_path`, `heading_level`, `heading_id`, `content_chunk_ids`, `source_url`, `raw_sha256`, `raw_html_path`, `rendered_html_path`, `jsonl_path`, `citation_label`, `citation_anchor`, plus JSONL citation fields with `label`, `source_url`, and anchor.
- No existing `.omo/notepads/ddb-archive-source-viewer/*.md` files were present before this note; the category directory was created for this inspection evidence.

## Exact backend files inspected

API/model/schema surface:

- `main/apps/api/app/models.py`
- `main/apps/api/app/schemas.py`
- `main/apps/api/app/routes_records.py`
- `main/apps/api/app/routes_sessions.py`
- `main/apps/api/app/routes_uploads.py`
- `main/apps/api/app/routes_auth.py`

Ingestion/vector/citation surface:

- `main/apps/api/app/ingestion.py`
- `main/apps/api/app/ddb_import.py`
- `main/apps/api/app/qdrant_index.py`
- `main/apps/api/app/chat_rag.py`

Related migrations/tests:

- `main/apps/api/alembic/versions/20260531_0003_ingestion_worker.py`
- `main/apps/api/alembic/versions/20260531_0004_indexed_chunks.py`
- `main/apps/api/alembic/versions/20260531_0005_chat_rag_records.py`
- `main/apps/api/alembic/versions/20260601_0006_repair_canonical_ingestion_tables.py`
- `main/apps/api/alembic/versions/20260601_0007_retarget_chat_chunk_foreign_keys.py`
- `main/apps/api/tests/test_ddb_import.py`
- `main/apps/api/tests/test_qdrant_indexing.py`
- `main/apps/api/tests/test_citations.py`
- `main/apps/api/tests/test_chat_rag.py`
- `main/apps/api/tests/test_uploads.py`
- `main/apps/api/tests/test_worker_jobs.py`
- `main/apps/api/tests/fakes.py`

Note: matching copies also exist under `ddb-import-isolated-5176/`, but repository instructions in `main/AGENTS.md` say day-to-day app work lives in `main/`, so the implementation map below targets `main/`.

## Current architecture findings

- `ingestion.parse_document()` already recognizes `.html`/`.htm`; DDB saved HTML routes through `_parse_ddb_html()` when `is_ddb_saved_html()` matches, otherwise generic HTML uses `_parse_html()`.
- `ddb_import.py` already extracts and writes archive-like DDB artifacts: raw HTML, sanitized rendered HTML, JSONL chunks, manifest, raw SHA, source URL, section path, heading level/id, content chunk ids, citation label, and citation anchor.
- `ingestion.chunk_document()` merges `ParsedDocument.metadata` and `ParsedSection.metadata` into every `DocumentChunk.metadata_json`, so DDB archive citation metadata can already be persisted without new columns if the parser provides it.
- `Source.metadata_json`, `Document.metadata_json`, `Section.metadata_json`, `DocumentChunk.metadata_json`, `IngestionJob.metadata_json`, `RetrievalHit.metadata_json`, and `Citation.metadata_json` are existing JSON text fields that can carry archive provenance.
- `ingestion._qdrant_points()` currently drops most chunk metadata and only sends a small Qdrant payload: `source_id` (currently `chunk.upload_id`), `chunk_id`, `filename`, `section`, `embedding_model`, `embedding_dimensions`, `chunk_index`, and `ingestion_job_id`.
- `chat_rag._context_from_hit()` reloads `DocumentChunk` by `chunk_id`, parses `chunk.metadata_json`, then overlays Qdrant payload. Because it reloads DB metadata, citation metadata can reach chat/citations even if Qdrant only stores `chunk_id`; however, Qdrant-side filtering/display cannot use archive fields until `_qdrant_points()` includes them.
- `chat_rag._citation_metadata()` is the citation metadata choke point for both `RetrievalHit.metadata_json` and `Citation.metadata_json`; it should be extended if archived source viewer needs typed citation metadata such as archive URL, source URL, anchor, heading path, rendered HTML path, or raw hash.
- `routes_sessions._read_citation()` currently returns `CitationRead` and injects `cited_text` from the associated `DocumentChunk` when absent. This is the best route-level place to guarantee citation display metadata is surfaced from chunk metadata.
- `routes_records.list_sources()`/`list_chunks()` expose source and chunk records for admin browsing. `SourceRead` currently exposes `id`, `upload_id`, `title`, `original_filename`, `extension`, `sha256`, `chunk_count`, `indexed_chunk_count`, and `created_at`; `ChunkRead` exposes arbitrary `metadata`.
- `routes_uploads.create_upload()` is the existing intake path for saved HTML files. It validates extension/content, stores the upload, creates an ingestion job, and does not currently accept separate URL/archive provenance fields outside the uploaded file metadata.

## Implementation map for archived webpage source ingestion

Storage/parser:

- Add or extend an archive parser module if archived webpage ingestion is broader than DDB-specific saved HTML. Existing DDB-specific behavior is in `main/apps/api/app/ddb_import.py`; generic ingestion entrypoint is `main/apps/api/app/ingestion.py`.
- Preserve archive provenance in metadata JSON first: `source_type`, `source_url`, `archive_url`/snapshot URL, capture timestamp, canonical URL, raw SHA, raw/rendered artifact paths, JSONL path, citation label, citation anchor, heading path, and content chunk ids.
- If the viewer needs durable queryable columns rather than metadata display only, add explicit columns to `Source` or a new archive-source table; otherwise existing `metadata_json` fields are sufficient for first implementation.

Ingestion/Qdrant:

- Update `main/apps/api/app/ingestion.py::_qdrant_points()` to include selected archive/citation fields from `DocumentChunk.metadata_json` in Qdrant payload if Qdrant filtering or source preview needs them. Tests in `main/apps/api/tests/test_qdrant_indexing.py` will need expected payload updates.
- Keep `chunk_id` in Qdrant payload because `chat_rag._context_from_hit()` depends on it to reload DB chunk metadata.
- Consider correcting/clarifying the Qdrant payload key `source_id`: it currently uses `chunk.upload_id`, not `chunk.source_id`.

Citation metadata/API:

- Update `main/apps/api/app/chat_rag.py::_citation_metadata()` to explicitly carry archive fields into retrieval hits and persisted citations.
- Update `main/apps/api/app/routes_sessions.py::_read_citation()` if citation responses should always include archive provenance from the chunk even when the citation metadata lacks it.
- Update `main/apps/api/app/schemas.py::CitationRead`, `SourceRead`, or `ChunkRead` only if the frontend requires typed top-level fields; otherwise current `metadata: dict[str, object]` passthrough can support the viewer.
- Update `main/apps/api/app/routes_records.py` if the admin/source viewer needs source-level archive fields in `/records/sources` instead of only per-chunk metadata.

Uploads/routes:

- If archived webpage source ingestion remains file-upload based, `main/apps/api/app/routes_uploads.py` may not need a new route; source/archive URL can be parsed from saved HTML metadata where available.
- If ingestion must accept URL + archived snapshot metadata directly, add a new request schema/route rather than overloading multipart upload metadata.

Tests:

- Extend `test_ddb_import.py` for archive metadata extraction/artifact contract.
- Extend `test_qdrant_indexing.py` for payload propagation.
- Extend `test_citations.py` and/or `test_chat_rag.py` for citation metadata exposure and response shape.
- Extend route tests (`test_uploads.py`, `test_worker_jobs.py`, possibly `test_contracts.py`) if API schemas or upload intake change.

## Migration decision

- No schema migration is strictly required for initial archived webpage ingestion if archive/source/citation details are stored in existing `metadata_json` fields on `Source`, `Document`, `Section`, `DocumentChunk`, `IngestionJob`, `RetrievalHit`, and `Citation`.
- A migration is required only if implementation chooses explicit, queryable columns or a dedicated archive-source table. Candidate migration targets would be `sources` (source URL, archive URL, capture timestamp/provider/canonical URL) and possibly `citations` or `chunks` if typed citation fields must be indexed/queryable outside metadata JSON.

## Verification evidence

- LSP diagnostics were attempted on these candidate Python files: `models.py`, `schemas.py`, `routes_records.py`, `routes_sessions.py`, `routes_uploads.py`, `routes_auth.py`, `ingestion.py`, `ddb_import.py`, `qdrant_index.py`, and `chat_rag.py`.
- Every diagnostics call returned the environment issue: `basedpyright` is configured but `basedpyright-langserver` is not installed (`Command not found: basedpyright-langserver`). No file-specific diagnostics were available from this environment.
- No application code was modified during this inspection.

## Frontend architecture inspection evidence

Evidence date: 2026-06-01

Required plan/notepad reads:

- Read `.omo/plans/ddb-saved-html-import.md` lines 250-294. The frontend-facing citation/viewer contract needs to account for `source_type`, `book_title`, `document_title`, `section_path`, `heading_level`, `heading_id`, `content_chunk_ids`, `source_url`, `raw_sha256`, `raw_html_path`, `rendered_html_path`, `jsonl_path`, `citation_label`, and `citation_anchor`; JSONL citation entries also include `label`, `source_url`, artifact paths, raw hash, heading id, and content chunk ids.
- Tried to read `.omo/notepads/ddb-archive-source-viewer/decisions.md`, but it does not exist in this category. The only current file in `.omo/notepads/ddb-archive-source-viewer/` is this append-only `task-4-architecture-inspection.md` evidence note.
- Read `.omo/notepads/ddb-saved-html-import/decisions.md`; it currently contains only `# Decisions` and no additional frontend constraints.

Exact frontend files inspected:

- `main/AGENTS.md` and `main/README.md` for repo target and local run constraints. Day-to-day app work targets `main/`; documented Dockerized web host port is `5173`. Inherited task context also says the isolated stack uses web port `5176`; preserve that contract in future notes even though inspected package scripts in both app copies currently say `5173`.
- `main/apps/web/package.json` for web scripts/dependencies: Vite React app, React Router, `react-markdown`, `remark-gfm`, Tailwind utility classes, `npm run build` for web verification.
- `main/apps/web/src/main.tsx` for app bootstrap through `app/router.tsx` and global `src/styles.css`.
- `main/apps/web/app/router.tsx` for current routes: `/chat/:sessionId`, `/upload`, `/records` under `AppShell`; no source-viewer route exists today.
- `main/apps/web/app/lib/api.ts` for frontend API types and client functions: `UploadQueued`, `UploadRecord`, `IngestionJob`, `IngestionEvent`, `SourceRecord`, `ChunkRecord`, `RetrievalRun`, `RecordsStats`, `Citation`, `ChatMessage`, upload/session/records fetch functions.
- `main/apps/web/app/routes/upload.tsx` for file-upload UI, selected-file state, `uploadFile(file)`, job/event polling, supported extension copy, and file input `accept` list.
- `main/apps/web/app/routes/records.tsx` for records observability tabs, source/chunk browsing, `SourceMeta`, `ChunksSection`, `PreviewStack`, relationships between upload/source/chunk/job/retrieval records.
- `main/apps/web/app/routes/chat.tsx` for markdown rendering, citation label detection, inline `CitationMarker`, appended citation group, citation drawer/rail, `CitationCard`, and `citationMetadata()` fallback behavior.
- `main/apps/web/src/styles.css` for design tokens, themes, chat/citation classes, records classes, upload-adjacent shared primitives, responsive rail behavior, and visual constraints.
- `main/apps/web/app/components/ui/button.tsx`, `card.tsx`, `input.tsx`, `main/apps/web/app/components/app/app-shell.tsx`, and `top-nav.tsx` for shared composition patterns and navigation.

Frontend implementation map:

Upload/archive intake UI:

- Extend in place in `main/apps/web/app/routes/upload.tsx` if archive ingestion remains file-upload based. The route already accepts `.html/.htm`, queues `/uploads`, polls job/events, and shows status. Update the supported-types copy and, if needed, add archive-specific helper text or metadata display beside the existing file chooser; no new page is needed for simple saved HTML archive upload.
- If archive ingestion needs direct URL/snapshot metadata input instead of only a file, add new frontend API function/type(s) in `main/apps/web/app/lib/api.ts` and add a distinct form section or new component under `upload.tsx` rather than overloading `uploadFile(file)`. This would likely need a backend route/schema first.
- Shared visual primitives should remain `Button`, `Card`, and existing token classes. Future upload UI should use `src/styles.css` tokens/classes (`--cream`, `--card`, `--border`, `--clay`, `--clay-dark`, `--amber`, `--foreground`, `--muted`) rather than hardcoded colors.

Records/source browsing:

- Extend in place in `main/apps/web/app/routes/records.tsx`. The `sources` and `chunks` tabs already support selecting a source/chunk, showing metadata relationships, and previewing chunk content.
- Update `SourceRecord` in `app/lib/api.ts` only if backend exposes typed source-level archive fields. Current `SourceRecord` has no `metadata` field, so source-level archive details cannot be displayed unless backend expands `/records/sources` or frontend derives them from chunks.
- `ChunkRecord.metadata` already passes arbitrary metadata, so archive fields from chunk metadata can be shown in `ChunksSection`, `PreviewStack`, or a new small `ArchiveMetadataGrid` helper inside `records.tsx` without a new route.
- If a future source viewer route is added, wire it in `app/router.tsx` and `top-nav.tsx` only if it should be primary navigation. For admin-only deep links from records, a route can be added without a nav pill.

Chat citation rendering and future iframe viewer:

- Extend in place in `main/apps/web/app/routes/chat.tsx` for first implementation. `MessageText`, `renderCitationMarkers()`, `CitationMarker`, `CitationRail`, `CitationCard`, and `citationMetadata()` are the citation choke points.
- `Citation` in `app/lib/api.ts` currently exposes `metadata: Record<string, unknown>`, which is enough for a first iframe-linking implementation if backend includes `rendered_html_path`, `raw_html_path`, `source_url`, `citation_anchor`/`heading_id`, `section_path`, and `content_chunk_ids` in citation metadata. Add typed metadata helpers in `chat.tsx` before adding top-level API fields.
- `citationMetadata()` currently recognizes `source_filename`, `filename`, `title`, `source_title`, section/page/locator fields, and excerpt-like fields. It should be extended to prefer DDB/archive fields: `book_title`, `document_title`, `section_path`, `citation_label`, `citation_anchor`, `heading_id`, `source_url`, and rendered artifact path.
- For iframe viewing, add a new component rather than bloating `CitationCard`; likely `ArchiveCitationViewer` or `CitationSourceFrame` colocated in `chat.tsx` initially, then extracted if it grows. It should be opened from `CitationCard` when metadata indicates an archive-backed citation.
- The iframe must be sandboxed without `allow-scripts`. Future implementation should explicitly render `sandbox` with no `allow-scripts`; if additional allowances are required, keep them minimal and document why. Do not assume the rendered archived HTML can execute scripts.
- `ReactMarkdown` already uses `skipHtml`, and markdown links are restricted by `safeMarkdownHref()` to `#`, `/`, `http:`, `https:`, and `mailto:`. Preserve that safety posture for source-viewer links.

API/types map:

- `main/apps/web/app/lib/api.ts` is the only frontend API client/type file. Add archive/source/citation types here when backend response shapes become typed.
- Current functions to extend/reference: `uploadFile()`, `listSources()`, `listChunks()`, `getSessionMessages()`, and `sendSessionMessage()`.
- Current types to extend/reference: `SourceRecord`, `ChunkRecord`, `Citation`, and `ChatMessage`.

Styles/design constraints:

- `main/apps/web/src/styles.css` is the design-system source. Citation styles are concentrated around `.citation-rail`, `.citation-card`, `.citation-summary`, `.citation-body`, `.citation-excerpt`, `.citation-marker`, and large-screen rail behavior at `@media (min-width: 1280px)`.
- Records styles are concentrated around `.records-page`, `.records-shell`, `.records-tabs`, `.records-split`, `.records-panel`, `.records-detail`, `.records-row`, `.records-metadata-grid`, and `.records-relationship-rail`.
- Future iframe viewer styles should extend this file with tokenized classes, not inline hardcoded visual values. Keep responsive behavior compatible with the existing mobile drawer / desktop sticky citation rail split.
- Existing `chat.tsx` contains a few inline styles for layout-only values (`marginBottom`, table scroll max width, citation summary flex child, loading phase CSS variable). Future viewer work should avoid adding more inline visual styling unless it is a component-local CSS variable like `--phase-index`.

Extend-in-place decision:

- Archive upload UI can be extended in place in `upload.tsx` for file-backed saved HTML/DDB archive ingestion. New components are only warranted if URL/snapshot metadata capture becomes a separate intake mode.
- Records/source browsing can be extended in place in `records.tsx`; a new component helper for archive metadata display is useful, but a new route is not required unless a full source viewer is needed outside chat.
- Chat citation viewing should extend existing citation marker/rail flow, but the actual iframe should be a new dedicated component because sandbox, loading/error state, and artifact URL handling are distinct from the current compact `CitationCard` metadata display.

Verification evidence:

- No application code was modified during this frontend inspection.
- No LSP diagnostics were run because this task only inspected code and did not surface file-specific frontend diagnostics that matter to the architecture map.
