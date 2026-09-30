---
id: TASK-0039
title: 'Chat sessions: persisted, switchable conversation history'
status: To Do
assignee: []
created_date: '2026-09-30 02:01'
labels:
  - ui
milestone: m-1
dependencies:
  - TASK-0028
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Operator request 2026-09-29 (TASK-0028 design rounds): the operator keeps multiple chat sessions, switches between them, and resumes earlier ones. POST /library/ask is stateless ({question} only), so this needs new operator-only server state and routes (list, create, rename, delete sessions; persisted turns with their citations) and a decision on whether follow-up questions carry prior turns into the answerer (an ask-sse contract change owned by this card, not TASK-0028). Constitution VIII: sessions and their quoted citations are operator-only. Layout comes from the TASK-0028 decision record; the spec comes later through a sweep.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
