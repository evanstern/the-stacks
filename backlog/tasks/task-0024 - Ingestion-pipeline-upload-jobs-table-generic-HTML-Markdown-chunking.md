---
id: TASK-0024
title: 'Ingestion pipeline: upload, jobs table, generic HTML/Markdown, chunking'
status: In Progress
assignee: []
created_date: '2026-09-29 02:36'
updated_date: '2026-09-29 17:26'
labels:
  - library
milestone: m-1
dependencies:
  - TASK-0022
  - TASK-0023
documentation:
  - backlog/docs/doc-0001 - M1-open-decisions-—-proposals.md
priority: high
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A9 pipeline minus the D&D Beyond parser, on the jobs table per decision-0005.

Spec: specs/017-ingestion-pipeline
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An operator upload route accepts HTML and Markdown and enqueues a job
- [ ] #2 An in-process worker claims jobs with FOR UPDATE SKIP LOCKED
- [ ] #3 Chunking keeps headings and tables intact and records source anchors
- [ ] #4 Re-running a document's job replaces its chunks without duplicates
- [ ] #5 Job status is visible to the operator
- [ ] #6 Upload accepts D&D Beyond exports as delivered: a zip of chapter pages, a zip of zips, or a single HTML page; __MACOSX and .DS_Store entries are ignored; assets other than HTML are skipped
- [ ] #7 No arbitrarily low upload size limit: a 310 MB export (Monster Manual) uploads; the body is streamed to disk, never buffered whole in memory; the configured ceiling defaults to at least 1 GB and is documented
- [ ] #8 Spec phase: Foundational — config, error kind, jobs table, job store
- [ ] #9 Spec phase: User Story 2 — stream uploads to disk under a 1 GiB ceiling (Priority: P1)
- [ ] #10 Spec phase: User Story 3 — structure-preserving chunker (Priority: P1)
- [ ] #11 Spec phase: User Story 1 — ingest D&D Beyond exports as delivered (Priority: P1) 🎯 MVP
- [ ] #12 Spec phase: User Stories 4 and 5 — generic HTML, Markdown, job status, crash recovery (Priority: P2)
- [ ] #13 Spec phase: Polish, merge condition, re-grounding, and gates
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Operator requirement 2026-09-28: real exports are 40–310 MB zips, some nested zip-of-zips (see TASK-0025 notes for the layout). Ensure no arbitrarily low upload limit.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5
(spec authoring; standing escalation sign-off 2026-09-28). Plan checkpoint open: zip reader (stdlib node:zlib vs yauzl@3), upload transport (raw body + query params vs multipart/busboy), requestTimeout 300s->1h, merge-condition embeddings on fake provider unless paid run approved.

Operator rulings 2026-09-29 (plan checkpoint): (1) zip reading uses yauzl@3 (approved runtime dependency), not the stdlib reader; (2) upload transport is multipart via busboy (approved runtime dependency), not raw body + query params; (3) requestTimeout 300s -> 1h approved; (4) merge-condition real-export run embeds with the fake provider. Spec revision (plan/contracts/tasks) dispatched to opus before implementation.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5
(spec revision for operator rulings: yauzl@^3.4.0, busboy@^1.6.0 + @types; commit 0e09134; ~136k tokens). Phase grouping: P1 alone; P2+P3 together; P4 alone; P5 alone; P6 (gates + real-export merge condition) alone.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5
(phase 1 Foundational; deps yauzl/busboy + @types; migration 0003_dazzling_cargill; 188 pass under REQUIRE_DATABASE=1)

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5
(phases 2-3: busboy streaming upload + chunker; 25 new tests incl. 320 MB streaming RSS<64MB; 213 pass under REQUIRE_DATABASE=1)

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5
(phase 4: yauzl zip walk, collectPages, ingest worker; 241 pass under REQUIRE_DATABASE=1). Deviation accepted by orchestrator: apps/server/vitest.config.ts fileParallelism:false — background worker polling the shared jobs table raced jobs.integration drainQueue across files; serializes test files only, no gate softened. Reviewer note: suite wall-time cost.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5
(phase 5: generic HTML, Markdown, job-status routes, crash recovery; 262 pass under REQUIRE_DATABASE=1; fixed abandonment path leaking the upload file)

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5
(phase 6 T031-T033: merged origin/main; shared isUniqueViolation; 301 pass under REQUIRE_DATABASE=1). T034/T035 (real exports) run by the orchestrator.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
