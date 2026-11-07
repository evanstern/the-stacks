---
id: TASK-0269
title: Interpret emits Intents
status: To Do
assignee: []
created_date: '2026-11-07 05:13'
labels:
  - 'ws:intent'
  - replan-2026-11
  - ep-1
milestone: m-10
dependencies: []
ordinal: 253000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Change `dm.interpret` to output Intents through structured output. Slash-form text bypasses the model. Ambiguous text returns a clarify question.

Parent epic: TASK-0258.

Source: docs/design/replan-2026-11/board-rework-map.md (N-04).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Slash commands produce Intents with zero model calls.
- [ ] #2 Interpret output validates against the Intent schema on attempt 1 in >= 99% of the playtest corpus.
- [ ] #3 A compound declaration yields one Intent per stage, each planned in turn.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
