# DDB Branch Rebase + Archived Webpage Source Viewer

## TL;DR
> **Summary**: Rebase `feat/ddb-import-isolated-5176` onto `main`, re-verify the isolated DDB import stack, then add first-class zipped downloaded-webpage archives as source material with citation iframe viewing scrolled to exact cited content.
> **Deliverables**:
> - Rebasing and post-rebase verification of the isolated DDB branch.
> - ZIP-based archived webpage upload/import stored under app data, not repo paths.
> - Immutable source archive provenance: original ZIP, extracted original files, sanitized served copy, manifest, and citation anchor map.
> - Authenticated archive viewer/assets API with traversal/symlink/size/MIME protections.
> - Citation UI that opens a sandboxed iframe and scrolls/highlights the archived webpage content for archive-backed citations.
> **Effort**: Large
> **Parallel**: YES - 5 waves
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 4 → Task 7 → Task 10 → Task 12 → Final Verification

## Context

### Original Request
- "merge main into this branch (rebase)"
- "test (post rebase)"
- "i want to be able to download html folders that contain the full 'page' (download a webpage from Chrome, for example) and feed that to the stacks as an upload folder. that folder should be grabbed and stashed in the stacks data directory (literally the actual source material... the stacks themselves)."
- "when sourcing material from 'the stacks' you should then be able to literally display an iframe with the SPECIFIC webpage it came from, scrolled to the content."
- "omo style plan, please"

### Interview Summary
- User wants execution planned, not performed here.
- Current worktree: `/home/coda/projects/the-stacks/ddb-import-isolated-5176`.
- Branch: `feat/ddb-import-isolated-5176`.
- This isolated worktree's app files are at the worktree root, despite older instructions mentioning `main/`.
- Isolated stack ports must remain: web `5176`, API `8016`, Postgres `5436`, Qdrant `6336`.
- Current DDB fixture import has completed end-to-end after `.env.ddb-5176` was updated with an OpenAI key.
- `.env.ddb-5176` contains secrets and must never be committed, printed, or copied into evidence.

### Metis Review (gaps addressed)
- Locked initial upload format to ZIP archives of downloaded webpage folders. Direct browser directory upload and live URL crawling are out of scope.
- Required uncommitted-file classification before rebase, especially `.env.ddb-5176` and `HANDOFF_CONTEXT.txt`.
- Required immutable archive provenance under app data and controlled authenticated archive serving.
- Required path traversal, symlink, MIME, file-count, size, and zip-bomb protections.
- Required sandboxed iframe with scripts disabled initially and deterministic scroll/highlight locators.

### Oracle Review
- VERDICT: GO.
- Guardrails: ZIP-only first phase, immutable provenance storage under `UPLOAD_DIR/source-archives/{source_id}/`, authenticated path-safe routes, scripts-disabled sandboxed iframe, and focused rebase/archive/viewer verification.

## Work Objectives

### Core Objective
Safely extend The Stacks from single-file HTML/DDB ingestion to archived webpage source ingestion, preserving complete downloaded source material in app data and letting citations show the exact archived webpage location in a sandboxed iframe.

### Deliverables
- Rebased branch with DDB work preserved.
- Post-rebase green verification for existing DDB saved-HTML import.
- Backend support for `.zip` uploads containing one downloaded webpage HTML entry and assets.
- Archive storage layout: `UPLOAD_DIR/source-archives/{source_id}/original.zip`, `original/`, `served/`, `manifest.json`, `anchor-map.json`.
- New/extended parser path for `source_type="archived_webpage"`.
- Citation metadata for archive-backed chunks: `archive_source_id`, `archive_entry_path`, `viewer_url`, `target_chunk_id`, `target_selector`, `quote`, `section_path`.
- Authenticated archive viewer and asset routes.
- Frontend upload UX and citation iframe viewer.

### Definition of Done (verifiable conditions with commands)
- `git status --short --branch` shows expected branch state and no staged secrets.
- `docker compose --env-file .env.ddb-5176 -f docker-compose.ddb-5176.yml config` preserves isolated ports/volumes.
- Targeted DDB tests pass in isolated Docker compose.
- Backend test suite passes after archive implementation.
- Web build passes.
- A Chrome-style downloaded webpage ZIP uploads, stores archive files under `/data/uploads/source-archives/{source_id}/`, indexes chunks, and returns archive citation metadata.
- Malicious ZIP fixtures for traversal, symlink, missing HTML, too many files, oversize files, and disallowed MIME are rejected.
- Citation iframe loads an authenticated viewer URL, scripts are sandbox-disabled, local assets render, and the cited chunk scrolls/highlights.

### Must Have
- No secret leakage. `.env.ddb-5176` must stay local-only.
- Preserve existing DDB import behavior and isolated compose behavior.
- Store full source archive material under app data, not repo-tracked paths.
- Preserve original ZIP and extracted original files for provenance.
- Serve archived material only through authenticated API routes.
- Use stable generated anchors for citation scrolling.
- Include regression tests for DDB saved HTML import.

### Must NOT Have
- No live web crawler.
- No direct browser directory upload in this phase.
- No script-enabled iframe in this phase.
- No raw filesystem path exposure.
- No committing `.env.ddb-5176`, imported archives, uploads, OpenAI keys, or runtime data.
- No changing default app port `5173` outside the isolated compose file.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: tests-after + existing pytest/build/smoke patterns. Add focused unit/integration tests for archive ingestion and viewer behavior.
- QA policy: Every task has agent-executed scenarios.
- Evidence: `.omo/evidence/task-{N}-{slug}.{ext}`.

## Execution Strategy

### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: Git/rebase safety and architecture inspection.
Wave 2: Rebase verification and archive data model/storage design.
Wave 3: Archive upload/import backend and security tests.
Wave 4: Archive serving API, citation locator metadata, and frontend upload UI.
Wave 5: Citation iframe viewer, end-to-end QA, and regression hardening.

### Dependency Matrix (full, all tasks)
- Task 1 blocks all implementation tasks.
- Task 2 blocked by Task 1; blocks Task 3.
- Task 3 blocked by Task 2; blocks Tasks 4-12.
- Task 4 blocked by Task 3; blocks Tasks 5-8.
- Task 5 blocked by Task 4; blocks Task 7.
- Task 6 blocked by Task 4; blocks Task 7.
- Task 7 blocked by Tasks 5-6; blocks Tasks 8-12.
- Task 8 blocked by Task 7; blocks Tasks 10-12.
- Task 9 blocked by Task 7; can run parallel with Task 8.
- Task 10 blocked by Tasks 8-9; blocks Task 12.
- Task 11 blocked by Task 7; can run parallel with Task 10 after APIs exist.
- Task 12 blocked by Tasks 8-11.

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 3 tasks → quick, deep, unspecified-high.
- Wave 2 → 3 tasks → quick, unspecified-high.
- Wave 3 → 3 tasks → unspecified-high, deep.
- Wave 4 → 3 tasks → unspecified-high, visual-engineering.
- Wave 5 → 2 tasks → visual-engineering, unspecified-high.

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Rebase Safety Preflight

  **What to do**: From `/home/coda/projects/the-stacks/ddb-import-isolated-5176`, inspect branch/status/diff. Classify each uncommitted file before rebase: commit-worthy (`docker-compose.ddb-5176.yml`, `apps/worker/Dockerfile` if still intentional), local-only (`.env.ddb-5176`), workflow scratch (`HANDOFF_CONTEXT.txt`, do not commit unless user explicitly says). Ensure `.env.ddb-5176` is ignored or unstaged. Fetch latest `main`, then prepare a safe rebase plan. Do not rebase until status and secret safety are confirmed.
  **Must NOT do**: Do not print `.env.ddb-5176`; do not commit secrets; do not pop unrelated stashes from the original `main/` worktree.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: focused git safety workflow.
  - Skills: [`git-master`] - Required for git operations.
  - Omitted: [`playwright`] - no browser action needed.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [2,3,4,5,6,7,8,9,10,11,12] | Blocked By: []

  **References**:
  - Worktree: `/home/coda/projects/the-stacks/ddb-import-isolated-5176` - active branch workspace.
  - Secret file: `.env.ddb-5176` - local-only, contains OpenAI key.
  - Compose: `docker-compose.ddb-5176.yml` - isolated stack config.
  - Worker fix: `apps/worker/Dockerfile` - stale `apps/worker/tests` copy removal.

  **Acceptance Criteria**:
  - [ ] `git status --short --branch` evidence captured without staging `.env.ddb-5176`.
  - [ ] Secret check proves `.env.ddb-5176` is not tracked/staged.
  - [ ] Rebase preflight summary identifies every uncommitted file and intended treatment.

  **QA Scenarios**:
  ```
  Scenario: Secret-safe preflight
    Tool: Bash
    Steps: Run `git status --short --branch`; run `git ls-files --error-unmatch .env.ddb-5176` expecting non-zero or documented ignored status; run `git diff --name-only --cached`.
    Expected: `.env.ddb-5176` is not tracked/staged; no secret values are printed.
    Evidence: .omo/evidence/task-1-rebase-preflight.txt

  Scenario: Uncommitted file classification
    Tool: Bash
    Steps: Run git status/diff-name-only and record classification for `docker-compose.ddb-5176.yml`, `.env.ddb-5176`, `HANDOFF_CONTEXT.txt`, and `apps/worker/Dockerfile`.
    Expected: Each file has explicit keep/commit/exclude handling before rebase.
    Evidence: .omo/evidence/task-1-file-classification.md
  ```

  **Commit**: NO | Message: N/A | Files: []

- [x] 2. Rebase Onto Main

  **What to do**: Fetch latest `main` and rebase `feat/ddb-import-isolated-5176` onto `main`. Resolve conflicts preserving isolated compose ports/volumes, DDB importer behavior, DDB tests, CORS behavior, and worker Dockerfile buildability. If conflicts involve `.env.ddb-5176`, keep it local-only and never stage it. Capture conflict resolutions and final diff summary.
  **Must NOT do**: No destructive git commands; no `push --force`; no committing secrets; no applying the unrelated original worktree stash.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: conflict resolution may span app/backend/docker files.
  - Skills: [`git-master`] - Required for rebase safety.
  - Omitted: [`playwright`] - not needed until QA.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [3,4,5,6,7,8,9,10,11,12] | Blocked By: [1]

  **References**:
  - Branch: `feat/ddb-import-isolated-5176` - current feature branch.
  - Base: `main` - target rebase base.
  - Compose: `docker-compose.ddb-5176.yml` - preserve host ports `5176`, `8016`, `5436`, `6336`.
  - Existing tests: `apps/api/tests/test_ddb_import.py`, `apps/api/tests/test_worker_jobs.py` - DDB behavior must survive.

  **Acceptance Criteria**:
  - [ ] Branch is rebased onto current `main`.
  - [ ] `git status --short --branch` shows no unresolved rebase/conflict state.
  - [ ] Final diff excludes `.env.ddb-5176` and runtime uploads/artifacts.
  - [ ] `docker compose --env-file .env.ddb-5176 -f docker-compose.ddb-5176.yml config` still resolves isolated ports and named volumes.

  **QA Scenarios**:
  ```
  Scenario: Clean rebase state
    Tool: Bash
    Steps: Run `git status --short --branch`; run `git log --oneline --decorate -5`; run compose config.
    Expected: No rebase in progress; branch is based on `main`; isolated compose config resolves.
    Evidence: .omo/evidence/task-2-rebase-state.txt

  Scenario: Secret exclusion after conflict resolution
    Tool: Bash
    Steps: Run `git diff --name-only --cached`; run `git ls-files .env.ddb-5176`.
    Expected: `.env.ddb-5176` is not staged/tracked.
    Evidence: .omo/evidence/task-2-secret-exclusion.txt
  ```

  **Commit**: NO | Message: N/A | Files: []

- [x] 3. Post-Rebase Baseline Verification

  **What to do**: Rebuild/restart isolated compose and run post-rebase tests. Run targeted DDB suite, broader backend tests, web build, and a real DDB fixture upload against isolated API. Confirm latest job completes and indexes chunks in Qdrant collection `thestacks_ddb_5176_chunks`.
  **Must NOT do**: Do not print OpenAI key; do not delete volumes unless explicitly asked.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: integration verification across Docker/API/Qdrant/frontend.
  - Skills: [] - direct command execution sufficient.
  - Omitted: [`git-master`] - no git history work.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [4,5,6,7,8,9,10,11,12] | Blocked By: [2]

  **References**:
  - Targeted DDB tests: `apps/api/tests/test_ddb_import.py`, `apps/api/tests/test_chunking.py`, `apps/api/tests/test_parsers.py`, `apps/api/tests/test_html_parser.py`, `apps/api/tests/test_worker_jobs.py`, `apps/api/tests/test_uploads.py`.
  - Fixture: `apps/api/tests/fixtures/ddb/a-world-of-your-own-ddb.html`.
  - Health endpoints: `http://localhost:8016/health`, `http://localhost:5176`.

  **Acceptance Criteria**:
  - [ ] Targeted DDB Docker pytest suite passes.
  - [ ] `make test` passes or any failure is documented as unrelated with evidence.
  - [ ] Web build passes from `apps/web`.
  - [ ] Isolated DDB fixture upload creates a completed job with `indexed_chunk_count >= 3` and Qdrant points.

  **QA Scenarios**:
  ```
  Scenario: Existing DDB import regression
    Tool: Bash
    Steps: Start isolated stack; login with `admin-password`; upload DDB fixture; poll job; query records/Qdrant.
    Expected: Job completes, artifacts exist, indexed chunks > 0.
    Evidence: .omo/evidence/task-3-ddb-regression.txt

  Scenario: Post-rebase test commands
    Tool: Bash
    Steps: Run targeted pytest, `make test`, and `npm run build` from `apps/web`.
    Expected: Commands exit 0, or failures include exact logs and blocker classification.
    Evidence: .omo/evidence/task-3-post-rebase-tests.txt
  ```

  **Commit**: NO | Message: N/A | Files: []

- [x] 4. Architecture Inspection for Archives and Citations

  **What to do**: Inspect current models, schemas, routes, ingestion pipeline, Qdrant payload creation, and frontend citation UI. Produce a short implementation map before code changes. Decide exact touched files and confirm whether Alembic migration is needed. Use existing `Source`, `Document`, `Section`, `DocumentChunk`, `IndexedChunk`, and `Citation` metadata before adding new tables; add a table only if metadata is insufficient for archive manifests.
  **Must NOT do**: Do not implement during inspection; do not invent schema without reading current migrations/routes.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: cross-cutting architecture mapping.
  - Skills: [] - repo inspection sufficient.
  - Omitted: [`git-master`] - no git operation.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [5,6,7,8,9,10,11,12] | Blocked By: [3]

  **References**:
  - Models: `apps/api/app/models.py:80-169` - uploads/sources/documents/sections/chunks/indexed chunks.
  - Upload route: `apps/api/app/routes_uploads.py` - existing upload validation.
  - Ingestion: `apps/api/app/ingestion.py` - parser dispatch and metadata persistence.
  - Web API client: `apps/web/app/lib/api.ts` - current API integration.
  - Citation UI: inspect `apps/web/app/routes/chat.tsx` and related components.

  **Acceptance Criteria**:
  - [ ] Implementation map names exact backend/frontend files to change.
  - [ ] Schema/migration decision is documented with evidence.
  - [ ] Qdrant payload metadata requirements are listed.
  - [ ] DDB compatibility constraints are listed.

  **QA Scenarios**:
  ```
  Scenario: Architecture map completeness
    Tool: Bash/Read/Grep
    Steps: Inspect routes, schemas, ingestion, models, Qdrant, citation rendering files.
    Expected: Map includes exact file paths and no unknown critical dependency remains.
    Evidence: .omo/evidence/task-4-architecture-map.md

  Scenario: Migration decision
    Tool: Bash/Read
    Steps: Inspect Alembic migrations and model metadata capacity.
    Expected: Decision says either metadata-only extension or migration-required with exact fields.
    Evidence: .omo/evidence/task-4-migration-decision.md
  ```

  **Commit**: NO | Message: N/A | Files: []

- [x] 5. Archive Storage and ZIP Validation Backend

  **What to do**: Add backend support for ZIP upload validation and archive storage. Accept `.zip` containing exactly one primary `.html`/`.htm` entry plus assets. Reject path traversal, absolute paths, symlinks, missing HTML, multiple ambiguous HTML entries, oversized archives, too many files, disallowed extensions/MIME, and zip bombs. Store under `UPLOAD_DIR/source-archives/{source_id}/` with `original.zip`, `original/`, and initial `manifest.json`. Constants: max ZIP size 50 MB, max extracted size 200 MB, max files 2,000 unless existing app config provides stricter limits.
  **Must NOT do**: Do not support live URL downloads or browser directory upload yet; do not store archive files in repo paths.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: security-sensitive backend implementation.
  - Skills: [] - Python/FastAPI implementation.
  - Omitted: [`playwright`] - backend tests only.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: [7,8,9,10,11,12] | Blocked By: [4]

  **References**:
  - Upload validation: `apps/api/app/routes_uploads.py:15-44` - extend supported types safely.
  - Settings: `apps/api/app/config.py` - add archive size/count settings if needed.
  - Upload model: `apps/api/app/models.py:80-90` - existing upload persistence.
  - Storage root: `UPLOAD_DIR` from settings.

  **Acceptance Criteria**:
  - [ ] `.zip` uploads are accepted only when archive shape is valid.
  - [ ] Stored archive path is under `/data/uploads/source-archives/{source_id}/` in Docker.
  - [ ] `manifest.json` records original filename, entry HTML path, checksums, file count, extracted byte count, source type `archived_webpage`.
  - [ ] Malicious archive tests reject traversal/symlink/absolute/oversize/ambiguous cases.

  **QA Scenarios**:
  ```
  Scenario: Valid Chrome-style archive
    Tool: Bash
    Steps: Create test ZIP with `page.html` and `page_files/style.css`; POST through `/uploads`; inspect stored app data manifest.
    Expected: Upload queued; source archive directory contains original ZIP, extracted files, manifest.
    Evidence: .omo/evidence/task-5-valid-archive-upload.txt

  Scenario: Malicious archive rejection
    Tool: Bash/Pytest
    Steps: Run tests for `../evil`, absolute path, symlink, missing HTML, multiple HTML, zip bomb/oversize, too many files.
    Expected: Each returns 400/415 with safe error and writes no escaped files.
    Evidence: .omo/evidence/task-5-malicious-archive-tests.txt
  ```

  **Commit**: YES | Message: `feat(api): add archived webpage zip storage` | Files: backend upload/storage/tests only

- [x] 6. Archive HTML Sanitization, Asset Rewrite, and Anchor Map

  **What to do**: Parse archive entry HTML and create a served copy under `UPLOAD_DIR/source-archives/{source_id}/served/`. Rewrite relative asset URLs to authenticated archive asset routes. Remove/disable scripts, inline event handlers, dangerous URLs, forms where needed, and external network references unless explicitly safe. Generate stable `data-source-chunk-id` anchors for extracted content and write `anchor-map.json` mapping chunk ids to selectors, heading path, quote, source path, and viewer fragment.
  **Must NOT do**: Do not mutate the extracted original copy; do not allow script execution in served copy.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: parser/security/source fidelity tradeoffs.
  - Skills: [] - backend parsing implementation.
  - Omitted: [`git-master`] - no git operation.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: [7,8,10,12] | Blocked By: [4]

  **References**:
  - DDB sanitizer: `apps/api/app/ddb_import.py` - existing safe HTML/artifact pattern.
  - DDB artifacts: `apps/api/app/ddb_import.py` `write_ddb_artifacts` - manifest/jsonl precedent.
  - Parser dispatch: `apps/api/app/ingestion.py` - connect archived parser.

  **Acceptance Criteria**:
  - [ ] Original extracted archive remains byte-preserved.
  - [ ] Served HTML copy has stable chunk anchors and rewritten local asset URLs.
  - [ ] Scripts and inline handlers are absent from served HTML.
  - [ ] `anchor-map.json` includes target chunk ids used later by citations.

  **QA Scenarios**:
  ```
  Scenario: Asset rewrite and anchor creation
    Tool: Pytest/Bash
    Steps: Import fixture ZIP with CSS/image asset; inspect served HTML and anchor map.
    Expected: Asset URLs point to archive API route; cited text has stable `data-source-chunk-id`.
    Evidence: .omo/evidence/task-6-asset-anchor.txt

  Scenario: Script disabling
    Tool: Pytest
    Steps: Import fixture with `<script>`, `onclick`, `javascript:` URL, and external image.
    Expected: Served copy removes/neutralizes dangerous content; original copy is preserved.
    Evidence: .omo/evidence/task-6-script-sanitization.txt
  ```

  **Commit**: YES | Message: `feat(api): sanitize archived webpage sources` | Files: parser/sanitizer/tests

- [x] 7. Archive Import Integration and Citation Metadata

  **What to do**: Integrate archived webpage parser into ingestion. Create `Source.source_type="archived_webpage"`, documents/sections/chunks from served HTML text, and chunk metadata containing `archive_source_id`, `archive_entry_path`, `archive_manifest_path`, `archive_served_entry_path`, `target_chunk_id`, `target_selector`, `viewer_fragment`, `quote`, `section_path`, `source_url` if detected. Ensure Qdrant payloads include the same citation locator metadata. Preserve DDB import behavior.
  **Must NOT do**: Do not replace DDB parser; do not index original unsanitized script content.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: ingestion/model/Qdrant integration.
  - Skills: [] - backend implementation.
  - Omitted: [`playwright`] - API tests first.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: [8,9,10,11,12] | Blocked By: [5,6]

  **References**:
  - Ingestion path: `apps/api/app/ingestion.py` - source/document/section/chunk persistence.
  - Metadata precedent: DDB job metadata currently includes `book_title`, `document_title`, `jsonl_path`, `raw_html_path`, `rendered_html_path`, `source_url`.
  - Qdrant collection: isolated `thestacks_ddb_5176_chunks` - payload should carry archive locators.
  - FYI source samples available for import integration validation: `/home/coda/projects/the-stacks/dmg/Chapter 02/` (downloaded D&D Beyond HTML plus `_files/` assets).

  **Acceptance Criteria**:
  - [ ] Valid archive ZIP job completes with indexed chunks.
  - [ ] Source record shows archived webpage source and correct chunk/indexed counts.
  - [ ] Chunk metadata contains archive viewer locator fields.
  - [ ] Qdrant payloads contain archive locator fields.
  - [ ] Existing DDB fixture import still completes.

  **QA Scenarios**:
  ```
  Scenario: Archive source indexing
    Tool: Bash/Pytest
    Steps: Upload archive ZIP; poll job; query DB records and Qdrant collection.
    Expected: Job completed; chunks/indexed_chunks > 0; metadata contains viewer locator fields.
    Evidence: .omo/evidence/task-7-archive-indexing.txt

  Scenario: DDB regression
    Tool: Bash/Pytest
    Steps: Re-run DDB targeted tests and DDB fixture upload.
    Expected: DDB parser/artifacts/indexing unchanged.
    Evidence: .omo/evidence/task-7-ddb-regression.txt
  ```

  **Commit**: YES | Message: `feat(api): index archived webpage sources` | Files: ingestion/tests

- [x] 8. Authenticated Archive Viewer and Asset Routes

  **What to do**: Add API routes to serve sanitized archive viewer HTML and local assets through authenticated endpoints. Routes must validate `source_id`, relative paths, ownership/session auth, path containment, MIME type, and no directory listing. Viewer route should accept `target` and return served HTML capable of scrolling/highlighting the target chunk via fragment or injected safe CSS/markup. Set headers to avoid third-party embedding while allowing same-app iframe.
  **Must NOT do**: Do not serve raw original HTML directly in iframe; do not expose filesystem paths.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: auth/static serving/security.
  - Skills: [] - FastAPI route implementation.
  - Omitted: [`git-master`] - no git operation.

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: [10,12] | Blocked By: [7]

  **References**:
  - Auth dependency: `apps/api/app/auth.py:69-85` - `current_admin_session`.
  - Routes pattern: `apps/api/app/routes_records.py`, `apps/api/app/routes_ingestion.py` - authenticated route style.
  - App registration: `apps/api/app/main.py:25-29` - include new router.

  **Acceptance Criteria**:
  - [ ] Unauthenticated archive viewer/assets return 401.
  - [ ] Authenticated viewer returns sanitized served HTML.
  - [ ] Authenticated asset route serves CSS/images with correct MIME.
  - [ ] Traversal and unknown-source requests return safe 404/400.
  - [ ] Response headers/sandbox strategy support same-app iframe and prevent third-party embedding.

  **QA Scenarios**:
  ```
  Scenario: Authenticated viewer works
    Tool: Bash
    Steps: Login; GET viewer URL for archived source target; GET rewritten CSS/image asset.
    Expected: 200 responses with expected MIME and no raw filesystem path leakage.
    Evidence: .omo/evidence/task-8-viewer-assets.txt

  Scenario: Viewer security rejects bad paths
    Tool: Bash/Pytest
    Steps: Request `../`, encoded traversal, missing source, directory path, original raw HTML path without served route.
    Expected: 400/401/404 as appropriate; no file disclosure.
    Evidence: .omo/evidence/task-8-viewer-security.txt
  ```

  **Commit**: YES | Message: `feat(api): serve archived source viewer` | Files: API routes/tests

- [x] 9. Frontend Archived Webpage Upload UI

  **What to do**: Extend upload UI/client to allow `.zip` archive upload for downloaded webpage folders. Show accepted format text: "Upload a ZIP containing one saved webpage HTML file and its asset folder." Show progress/status using existing job polling. Display validation errors from API. Ensure records/source list distinguishes archived webpages from DDB/plain HTML sources.
  **Must NOT do**: Do not add live URL download or direct folder picker in this phase.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: frontend UX/API integration.
  - Skills: [`frontend-ui-ux`] - UI clarity and error states.
  - Omitted: [`git-master`] - no git operation.

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: [11,12] | Blocked By: [7]

  **References**:
  - API client: `apps/web/app/lib/api.ts` - upload and records calls.
  - Login/API base handling: `apps/web/app/lib/api.ts:1-23` - preserve `VITE_API_URL` behavior.
  - Upload/records routes: inspect `apps/web/app/routes/records.tsx` and related upload components.

  **Acceptance Criteria**:
  - [ ] `.zip` can be selected/uploaded from UI.
  - [ ] Unsupported file errors are visible and specific.
  - [ ] Job status shows completion/failure.
  - [ ] Source list displays archived webpage source type and indexed count.

  **QA Scenarios**:
  ```
  Scenario: Upload valid archive via UI
    Tool: Playwright
    Steps: Open `http://localhost:5176`; login; upload valid archive ZIP; wait for job completion in UI.
    Expected: Source appears with archived webpage type and indexed chunks.
    Evidence: .omo/evidence/task-9-ui-archive-upload.png

  Scenario: Upload invalid archive via UI
    Tool: Playwright
    Steps: Upload ZIP with missing HTML or traversal fixture.
    Expected: User sees API validation error; no source appears.
    Evidence: .omo/evidence/task-9-ui-invalid-archive.png
  ```

  **Commit**: YES | Message: `feat(web): add archived webpage upload UI` | Files: web API/UI/tests

- [x] 10. Citation API Payloads for Archive Viewer

  **What to do**: Extend citation creation/serialization so archive-backed chunks produce citation objects with viewer data: `source_type`, `source_title`, `viewer_url`, `target_chunk_id`, `target_selector`, `quote`, `section_path`, and fallback fields. Preserve existing citation payloads for DDB/plain HTML. Add tests that a chat/RAG response citation against an archive chunk includes iframe-ready metadata.
  **Must NOT do**: Do not break existing `Citation` schema consumers; keep backward-compatible fields.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: backend chat/citation contract changes.
  - Skills: [] - API/schema tests.
  - Omitted: [`playwright`] - browser work comes later.

  **Parallelization**: Can Parallel: NO | Wave 4 | Blocks: [11,12] | Blocked By: [8]

  **References**:
  - Citation model: `apps/api/app/models.py:68-77`.
  - Web Citation type: `apps/web/app/lib/api.ts:115-120`.
  - Retrieval/citation tests: `apps/api/tests/test_chat_rag.py`, `apps/api/tests/test_citations.py` if present.

  **Acceptance Criteria**:
  - [ ] Archive-backed citation JSON includes iframe-ready viewer metadata.
  - [ ] Non-archive citations remain compatible.
  - [ ] Citation metadata never exposes filesystem paths or original unsanitized route.

  **QA Scenarios**:
  ```
  Scenario: Archive citation payload
    Tool: Pytest/Bash
    Steps: Seed/archive import; create retrieval/citation; fetch chat messages/citations.
    Expected: Citation contains viewer URL and target chunk locator, no filesystem path.
    Evidence: .omo/evidence/task-10-citation-payload.txt

  Scenario: Existing citation compatibility
    Tool: Pytest
    Steps: Run existing chat/citation tests for non-archive sources.
    Expected: Existing assertions continue to pass.
    Evidence: .omo/evidence/task-10-citation-regression.txt
  ```

  **Commit**: YES | Message: `feat(api): expose archive citation viewer metadata` | Files: schemas/citation/chat tests

- [x] 11. Frontend Citation Iframe Viewer

  **What to do**: Add citation detail UI that detects archive-backed citations and renders a sandboxed iframe using `viewer_url`. Use `sandbox` without `allow-scripts` initially. On open, iframe should load the sanitized served page and scroll/highlight target via fragment/anchor. Provide fallback UI if viewer URL is missing or target not found. Keep current citation display for other source types.
  **Must NOT do**: Do not enable scripts; do not render raw HTML in parent React DOM.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: UI state, iframe, accessibility.
  - Skills: [`frontend-ui-ux`, `playwright`] - browser QA required.
  - Omitted: [`git-master`] - no git operation.

  **Parallelization**: Can Parallel: NO | Wave 5 | Blocks: [12] | Blocked By: [9,10]

  **References**:
  - Citation type: `apps/web/app/lib/api.ts:115-120` - extend with viewer metadata.
  - Chat route: `apps/web/app/routes/chat.tsx` - citation rendering location.
  - Styles: `apps/web/src/styles.css` - iframe panel styling.

  **Acceptance Criteria**:
  - [ ] Archive citation opens iframe panel.
  - [ ] iframe URL is the authenticated API viewer route.
  - [ ] iframe sandbox omits `allow-scripts`.
  - [ ] Target chunk scrolls into view and is highlighted.
  - [ ] Missing target displays fallback citation text and opens page top.

  **QA Scenarios**:
  ```
  Scenario: Citation iframe scrolls to content
    Tool: Playwright
    Steps: Login; use archive-backed chat/citation fixture; click citation; inspect iframe URL; verify target text visible/highlighted.
    Expected: iframe shows archived webpage and cited content is in viewport.
    Evidence: .omo/evidence/task-11-iframe-scroll.png

  Scenario: Iframe sandbox blocks scripts
    Tool: Playwright
    Steps: Upload archive with script attempting to set parent/window marker; open citation iframe.
    Expected: Script does not execute; parent page unchanged; citation still displays sanitized content.
    Evidence: .omo/evidence/task-11-iframe-sandbox.png
  ```

  **Commit**: YES | Message: `feat(web): show archived source citations in iframe` | Files: web UI/API tests

- [x] 12. End-to-End Archive Source QA and Hardening

  **What to do**: Run full verification across rebase branch, DDB regression, archive ingestion, API routes, frontend upload, and iframe citation. Fix any defects. Capture evidence and ensure no secrets/runtime archives are staged. Include final diff review.
  **Must NOT do**: Do not mark final verification tasks complete until user explicitly approves final results after review wave.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: cross-stack QA and hardening.
  - Skills: [`playwright`] - browser evidence required.
  - Omitted: [`git-master`] - use only if committing final changes.

  **Parallelization**: Can Parallel: NO | Wave 5 | Blocks: [Final Verification] | Blocked By: [8,9,10,11]

  **References**:
  - Isolated compose: `docker-compose.ddb-5176.yml`.
  - Env: `.env.ddb-5176` - local-only; do not print/commit.
  - Evidence dir: `.omo/evidence/`.
  - Existing verification commands from Task 3.

  **Acceptance Criteria**:
  - [ ] Full backend tests pass.
  - [ ] Web build passes.
  - [ ] Archive upload/index/viewer E2E passes in isolated stack.
  - [ ] DDB saved HTML import still passes and indexes.
  - [ ] Security negative tests pass.
  - [ ] `git status --short` excludes secrets/runtime data from staged changes.

  **QA Scenarios**:
  ```
  Scenario: Full isolated archive E2E
    Tool: Playwright + Bash
    Steps: Start isolated stack; login; upload archive ZIP; wait for completed job; trigger citation; open iframe; verify scrolled highlight and records counts.
    Expected: End-to-end archive source workflow succeeds on `5176`/`8016`.
    Evidence: .omo/evidence/task-12-archive-e2e.png

  Scenario: Final secret/runtime safety
    Tool: Bash
    Steps: Run `git status --short`; inspect staged diff names; verify `.env.ddb-5176`, uploads, archive fixtures with real data, and OpenAI key are absent.
    Expected: No secrets or runtime archive data staged.
    Evidence: .omo/evidence/task-12-secret-safety.txt
  ```

  **Commit**: YES | Message: `feat: add archived webpage source viewer` | Files: all implementation files, tests, safe fixtures only

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ playwright)
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
- Do not commit `.env.ddb-5176`, uploaded archives, runtime data, or evidence containing secrets.
- Commit in logical groups if implementation is long:
  1. `chore: rebase ddb archive branch onto main` only if needed for conflict-resolution checkpoint; otherwise no rebase commit.
  2. `feat(api): add archived webpage zip storage`.
  3. `feat(api): index archived webpage sources`.
  4. `feat(api): serve archived source viewer`.
  5. `feat(web): add archived source upload and citation viewer`.
- Final squashing is optional and requires user direction.

## Success Criteria
- Rebased branch is current with `main`.
- Isolated DDB stack remains functional on `5176/8016/5436/6336`.
- Existing DDB saved-HTML import remains green.
- ZIP archived webpage upload stores immutable source material under app data.
- Archive ingestion indexes chunks with viewer/citation metadata.
- Archive viewer/assets are authenticated and path-safe.
- Citation iframe displays the exact archived page and scrolls/highlights cited content.
- Security negative tests prevent traversal, symlinks, scripts, oversize archives, and raw path disclosure.
