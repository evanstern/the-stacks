---
id: TASK-0061
title: 'The Codex: NPC-smith agent'
status: To Do
assignee: []
created_date: '2026-10-25 20:16'
labels:
  - codex
  - ai
  - agent
milestone: m-4
dependencies:
  - TASK-0057
  - TASK-0054
references:
  - docs/design/architecture.md
priority: medium
ordinal: 51000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the operator asks for an NPC in plain words and gets a complete, linked, editable codex NPC, grounded in the campaign and the library.

Why: operator goal 2 and vision use case 2. This is the codex milestone's first agent card. Its landing is the LangGraph revisit trigger (decision-0019), so it waits on TASK-0054's decision and follows it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The operator requests an NPC in plain words, and the agent returns a contract-valid NPC.
- [ ] #2 The NPC passes the portrayal-completeness lint.
- [ ] #3 The agent links the NPC to existing campaign entities it references.
- [ ] #4 Library claims in the NPC carry citations (constitution V).
- [ ] #5 The agent's output is a proposal that the operator accepts, edits or rejects.
- [ ] #6 The agent is built as TASK-0054's decision record directs.
- [ ] #7 Every model call names a gateway purpose.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
