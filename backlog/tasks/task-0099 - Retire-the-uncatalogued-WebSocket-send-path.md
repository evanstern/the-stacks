---
id: TASK-0099
title: Retire the uncatalogued WebSocket send path
status: In Progress
assignee: []
created_date: '2026-10-26 03:48'
updated_date: '2026-10-27 09:30'
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

Spec: specs/043-retire-uncatalogued-send
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The WebSocket send path refuses every uncatalogued event type.
- [ ] #2 appendUncataloguedEvent and its write-boundary allow-list entry are removed.
- [ ] #3 The load benchmark and any remaining M0 sender use a catalogued type or are retired, and their tests pass.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-26 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0099, branch task-0099-retire-uncatalogued-send, cut from origin/main adb4527. Spec number 043 claimed with a stub. Session 2 of the M3 orchestrator (2026-10-27).

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
Spec author (orchestrator session 2) stopped after spec.md (4d0a585): retiring the path changes client-visible send handling and frozen 029 contract text. OPERATOR RULINGS NEEDED before plan.md:
OQ1 refusal for an uncatalogued send (frame shape unchanged): A (default) error{kind:validation, code:UNKNOWN_EVENT_TYPE}; B reuse forbidden/CATALOG_TYPE_REQUIRES_GATE; C validation with no code.
OQ2 amend frozen 029 ws-delivery.md send table row 3 to the OQ1 refusal, plus an 'Amended by spec 043' line.
OQ3 amend frozen 029 write-boundary.md: drop appendUncataloguedEvent from rule 3 and its table row; rule 4 writers become (session/**, gate/**); amendment line.
OQ4 prose amendment note in specs/006-ws-gateway/contracts/ws-protocol.md beneath 'Extended by spec 029'; send example stays 'chat' by default.
Design in spec.md: bench and M0 WS tests move to an out-of-character talk request (characterId null). Blocked until the operator rules; TASK-0049 waits behind it (same hotspots).

OPERATOR RULING 2026-10-27 (in chat): "I accept the defaults on the TASK-0099 and TASK-0049 cards, including the frozen-contract amendments to spec 029 and spec 006." Spec authoring resumes with plan.md and tasks.md.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
