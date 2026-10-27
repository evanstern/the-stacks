---
id: TASK-0099
title: Retire the uncatalogued WebSocket send path
status: Done
assignee: []
created_date: '2026-10-26 03:48'
updated_date: '2026-10-27 10:08'
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
- [x] #1 The WebSocket send path refuses every uncatalogued event type.
- [x] #2 appendUncataloguedEvent and its write-boundary allow-list entry are removed.
- [x] #3 The load benchmark and any remaining M0 sender use a catalogued type or are retired, and their tests pass.
- [x] #4 Spec phase: Retire the path and migrate its senders (US1, US2, US3; FR-001–FR-007, FR-009)
- [x] #5 Spec phase: Wiki (re-ground)
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

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
(spec authoring resumed after the operator ruling: plan, research, tasks, contracts/frozen-amendments.md; commit eacfd07.)

Phase 1 done (92e0a14): gateway refuses uncatalogued types with UNKNOWN_EVENT_TYPE; appendUncataloguedEvent and allow-list entry removed; frozen amendments applied; bench + M0 WS tests send talk; refusal test added. Finding: gate CONFLICT under back-to-back/concurrent talk sends (MAX_ATTEMPTS=3); retry not widened. Tests await each echo and resend on CONFLICT. concurrency-smoke needed gate.onAppended(publish) wired (it was missing). ci:check green; concurrency-smoke PASS 0 errors wsRtP95 19.0ms.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 1 (merge 6204c23, work 92e0a14): the uncatalogued path is retired; frozen amendments applied exactly as written; bench and M0 WS tests moved to talk; ci:check passed with REQUIRE_DATABASE=1; concurrency-smoke passes. Fixed in scope: concurrencySmoke never wired gate.onAppended to the WS publish. Finding: bursty concurrent talk through the gate can be refused with CONFLICT. The tests resend on CONFLICT, and the problem is carded as TASK-0157 (m-3, before the demo).

Phase 2 done (b77e6e0): wiki re-grounded. websocket-gateway, ws-protocol, proposal-gate, session-model, benchmarks, test-suite re-pinned after prose review; event-log prose updated (pin unchanged, sources untouched); CAPSULES.md regenerated; INDEX.md state paragraph and websocket-gateway entry updated. TASK-0157 CONFLICT behaviour noted in websocket-gateway and proposal-gate. Freshness OK, spec-bridge exit 0, ci:check green.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 2 (merge 1eca063, wiki b77e6e0): six notes amended (NEEDS-REVIEW) and re-pinned; freshness OK; ci:check passed with REQUIRE_DATABASE=1.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Reconcile with main after #67 (merge 4f375f3, re-pin 1fffa98): INDEX state paragraph keeps both clauses; CAPSULES regenerated; dm-failure-and-gates re-pinned (RE-PIN-ONLY). Freshness OK; ci:check passed with REQUIRE_DATABASE=1.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Retire the path and migrate its senders (US1, US2, US3; FR-001–FR-007, FR-009): 11/11 · Wiki (re-ground): 6/6). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
