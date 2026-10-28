---
id: TASK-0157
title: Gate refuses bursty concurrent talk with CONFLICT after its retry bound
status: Done
assignee: []
created_date: '2026-10-27 09:46'
updated_date: '2026-10-28 03:37'
labels:
  - gate
  - ws
  - session
milestone: m-3
dependencies: []
ordinal: 144000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: several humans talking at once never see a CONFLICT refusal for a talk request, or the client retries it transparently. Evidence: TASK-0099 Phase 1 (spec 043, commit 92e0a14) moved the WS integration tests and the load bench from the uncatalogued append to gate talk requests. With 3 concurrent senders (T012), 5 back-to-back sends from one socket (T021), and concurrency-smoke, the gate (MAX_ATTEMPTS = 3) refused some sends with CONFLICT. The tests now await each echo and resend on CONFLICT, as a client would. The old uncatalogued path never hit this. Why it matters for M3: the demo seats three humans at one table (C7). Options: widen or back off the gate's optimistic retry for direct-route kinds; or have the web client resend a talk on CONFLICT. Before the M3 demo (TASK-0053).

Spec: specs/052-talk-conflict-retry
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A test with at least 3 concurrent human talk senders shows no CONFLICT reaches the client, or the play-route client resends and the talk lands once
- [x] #2 The chosen retry policy is documented in the gate contract
- [x] #3 Spec phase: Failing gate-level zero-CONFLICT tests (card AC #1)
- [x] #4 Spec phase: Per-session queue and jittered retry (card AC #1)
- [x] #5 Spec phase: WebSocket burst test, resend workaround removed, client label (card AC #1)
- [x] #6 Spec phase: Gate contract amendment (card AC #2)
- [x] #7 Spec phase: Wiki re-ground and runbook rows (card AC #1, AC #2)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-27 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0157, branch task-0157-talk-conflict-retry, cut from origin/main 88194c8. Spec number 052 claimed with a stub. Spec 051 is held by TASK-0143 (PR #76), so this takes 052.

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
Spec author (spec.md, c158ee2) stopped with open questions Q1-Q6. Root cause: gate attempts fold the whole log then append with expectedLastSeq; concurrent same-process writes race and the immediate 3-try retry refuses CONFLICT (repro 4/15 to 41/100; per-session serial queue 0).

Operator ruling, 2026-10-27, verbatim: "TASK-0157: I accept the recommended defaults Q1 to Q6, including the per-session gate queue, the jittered retry and the 029 gate-api amendment."

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 1 (82593a8): T002-T005 and T008 fail today for the stated reason; T006, T007 pass. T005 fails on the talk side (tasks.md said it may pass).

spec-bridge sync: Failing gate-level zero-CONFLICT tests (card AC #1): 9/9 · Per-session queue and jittered retry (card AC #1): 0/8 · WebSocket burst test, resend workaround removed, client label (card AC #1): 0/6 · Gate contract amendment (card AC #2): 0/4 · Wiki re-ground and runbook rows (card AC #1, AC #2): 0/9

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 2 (a3fb9f4): inOrder per-session queue and retryDelayMs (10-50 ms) in gate.ts. Mutation (inOrder -> fn()): T002, T003, T004, T007 fail; restored, diff empty. REQUIRE_DATABASE=1 pnpm ci:check exit 0.

spec-bridge sync: Failing gate-level zero-CONFLICT tests (card AC #1): 9/9 · Per-session queue and jittered retry (card AC #1): 8/8 · WebSocket burst test, resend workaround removed, client label (card AC #1): 0/6 · Gate contract amendment (card AC #2): 0/4 · Wiki re-ground and runbook rows (card AC #1, AC #2): 0/9

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 3 (fa3d99c): WS resend removed; T012b (3 senders x5 all in flight) 3/3 runs zero CONFLICT; concurrency-smoke PASS wsRtP95 17.8 ms; CONFLICT label "The table was busy, so your line was not sent. Send it again."; ci:check exit 0. T020 was not run red first (tests-first skipped for the label test).

spec-bridge sync: Failing gate-level zero-CONFLICT tests (card AC #1): 9/9 · Per-session queue and jittered retry (card AC #1): 8/8 · WebSocket burst test, resend workaround removed, client label (card AC #1): 6/6 · Gate contract amendment (card AC #2): 0/4 · Wiki re-ground and runbook rows (card AC #1, AC #2): 0/9

spec-bridge sync: Failing gate-level zero-CONFLICT tests (card AC #1): 9/9 · Per-session queue and jittered retry (card AC #1): 8/8 · WebSocket burst test, resend workaround removed, client label (card AC #1): 6/6 · Gate contract amendment (card AC #2): 4/4 · Wiki re-ground and runbook rows (card AC #1, AC #2): 9/9 — status In Progress → Done

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phases 4-5 in one dispatch: amendment 853e726, merge of origin/main dd1f3dc, wiki d5ee5e1, runbook 0ed1d15. ci:check on the merged tree exit 0 (server 1223). Freshness OK (54 notes); spec-bridge ok. AC #1: gate-level and WS T012b tests show zero CONFLICT with 3+ senders. AC #2: specs/029-proposal-gate/contracts/gate-api.md TASK-0157 block.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Failing gate-level zero-CONFLICT tests (card AC #1): 9/9 · Per-session queue and jittered retry (card AC #1): 8/8 · WebSocket burst test, resend workaround removed, client label (card AC #1): 6/6 · Gate contract amendment (card AC #2): 4/4 · Wiki re-ground and runbook rows (card AC #1, AC #2): 9/9). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
