---
id: TASK-0099
title: Retire the uncatalogued WebSocket send path
status: To Do
assignee: []
created_date: '2026-10-26 03:48'
labels:
  - ws
  - session
milestone: m-3
dependencies:
  - TASK-0045
  - TASK-0047
priority: medium
ordinal: 89000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the WebSocket send path accepts only catalogued session-model requests, which go through the proposal gate. The inert legacy append for uncatalogued event types (the M0 chat event, the bench ping) is removed.

Why: TASK-0045 (specs/029-proposal-gate, contracts/write-boundary.md) keeps an inert append for uncatalogued types, so existing M0 senders keep working while the gate lands. decision-0020 requires a card for that deferral. TASK-0047's play route replaces the M0 chat sender. Carded 2026-10-26 by the M2 First Scene sweep orchestrator, at the TASK-0045 spec author's request.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The WebSocket send path refuses every uncatalogued event type.
- [ ] #2 appendUncataloguedEvent and its write-boundary allow-list entry are removed.
- [ ] #3 The load benchmark and any remaining M0 sender use a catalogued type or are retired, and their tests pass.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
