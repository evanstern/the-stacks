---
id: TASK-0038
title: 'Library management UI: book list, delete, re-import'
status: To Do
assignee: []
created_date: '2026-09-30 01:19'
updated_date: '2026-09-30 02:29'
labels:
  - ui
milestone: m-1
dependencies:
  - TASK-0028
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Placeholder until the TASK-0028 design-rounds decision record lands; the description is then rewritten from it. Needs two new operator-only routes: GET /library/books and DELETE /library/books/:id (constitution VIII).
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
