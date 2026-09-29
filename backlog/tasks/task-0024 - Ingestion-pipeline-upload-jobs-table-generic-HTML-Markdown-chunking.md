---
id: TASK-0024
title: 'Ingestion pipeline: upload, jobs table, generic HTML/Markdown, chunking'
status: To Do
assignee: []
created_date: '2026-09-29 02:36'
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
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An operator upload route accepts HTML and Markdown and enqueues a job
- [ ] #2 An in-process worker claims jobs with FOR UPDATE SKIP LOCKED
- [ ] #3 Chunking keeps headings and tables intact and records source anchors
- [ ] #4 Re-running a document's job replaces its chunks without duplicates
- [ ] #5 Job status is visible to the operator
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
