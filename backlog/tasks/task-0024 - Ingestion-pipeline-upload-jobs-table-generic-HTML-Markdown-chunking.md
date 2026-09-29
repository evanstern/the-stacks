---
id: TASK-0024
title: 'Ingestion pipeline: upload, jobs table, generic HTML/Markdown, chunking'
status: In Progress
assignee: []
created_date: '2026-09-29 02:36'
updated_date: '2026-09-29 15:02'
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
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Operator requirement 2026-09-28: real exports are 40–310 MB zips, some nested zip-of-zips (see TASK-0025 notes for the layout). Ensure no arbitrarily low upload limit.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
