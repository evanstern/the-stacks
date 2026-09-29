---
id: TASK-0027
title: Rules-answerer agent with source-anchored citations
status: To Do
assignee: []
created_date: '2026-09-29 02:36'
labels:
  - ai
milestone: m-1
dependencies:
  - TASK-0026
priority: high
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Grounded Q&A over the library. SSE transport per decision-0004.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 POST /library/ask streams an answer as text/event-stream
- [ ] #2 Every claim cites a chunk by book, section, and exact quote span
- [ ] #3 The agent refuses to answer when retrieval finds nothing relevant, and says so
- [ ] #4 Tests run against the fake provider
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
