---
id: TASK-0038
title: 'Library management UI: book list, delete, re-import'
status: To Do
assignee: []
created_date: '2026-09-30 01:19'
updated_date: '2026-09-30 02:55'
labels:
  - ui
milestone: m-1
dependencies:
  - TASK-0028
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Operator library management, designed in the TASK-0028 design rounds. Decision record: docs/design/chat-ui/decision.md on branch task-0028-chat-ui (lands on main with TASK-0028). Layout: round-2/a2-daylight.html states 4b and 4c, and round-3/p-sources-panel.html states 5 and 7.

Scope:
- Books table on the Library page: name, pages, chunks, embedding model, ingest date, status (ingesting, failed, ready, search-only).
- Delete with an inline confirm row beneath the book ("Delete <book>? This removes all pages, chunks and embeddings for the book and cannot be undone."). No modal.
- Re-import: the upload form prefilled with the book title.
- Embed now on a search-only book whenever an embedding model is available, with progress; never forced. The book stays keyword-searchable meanwhile.
- The Sources panel (TASK-0028) switches its book source from GET /library/jobs to GET /library/books and gains Embed now in its overflow.
- Reuse the TASK-0028 slide-out panel component; no modals.

Contract needs (new, operator-only, constitution VIII):
- GET /library/books
- DELETE /library/books/:id (library rows are immutable; delete cascades through the foreign keys)
- an embed route for Embed now.

The spec comes later, through a sweep.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Operator ruling 2026-09-29 (TASK-0028 round 2): a book without embeddings stays keyword-searchable (hybrid retrieval already runs FTS over every chunk; retrieve.ts). When an embedding model is available, offer 'Embed now' on that book at any time; never force a re-import or re-embed. Needs an operator-only embed route. No modals: confirmations go in slide-out panels or inline.
<!-- SECTION:NOTES:END -->
