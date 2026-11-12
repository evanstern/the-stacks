---
id: TASK-0300
title: CI latency gate on fixture tables
status: In Progress
assignee: []
created_date: 2026-11-08 19:56
updated_date: '2026-11-12T13:53:00Z'
labels:
  - ws:tooling
  - replan-2026-11
  - ep-1
milestone: m-10
dependencies:
  - TASK-0268
priority: medium
ordinal: 284000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Constitution 3.0.0 requires CI to record the time from a confirmed Intent to fact rows on fixture tables. TASK-0278 measures the hosted run only. This card adds the per-commit gate.

Source: docs/design/r1-fast-table-runbook.md finding F5, CP-5 ruling 2026-11-08. Parent epic: TASK-0258. (gap G3).

Spec: specs/106-latency-gate
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `pnpm ci:check` runs a fixture table and records confirmed-Intent-to-fact-rows time.
- [ ] #2 CI fails when the fixture p95 exceeds the budget in the constitution.
- [ ] #3 The gate uses the fake model and needs no provider key.
- [ ] #4 Spec phase: The latency gate (AC #1, AC #2, AC #3)
- [ ] #5 Spec phase: Wiki re-ground
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-12 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0300, branch task-0300-latency-gate, cut from origin/main fa6b3c11. Spec number 106 claimed with a stub.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5
Spec 106 (bb6d6beb): 7 tasks, 2 phases. Budget: constitution IX, under 1 s p95 (BUDGET_MS=1000, per kind, no retry, no multiplier). 200 measured samples per kind after 20 warm-up; kinds attack (AI seat) and check (through a human-DM ruling). Orchestrator adopts OQ-2..OQ-5 as recommended; OQ-1 (attacks only miss, so the damage path is untimed) is carded as a revisit.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Phases 1-2 (45ecfe33, a87b1c0f). Local p95: attack 18.0 ms, check 31.5 ms, against a 1000 ms budget. Negative proof with BUDGET_MS=0.001 exits 1 and prints FAIL. OQ-5 confirmed: check.resolved and intent.recorded land in one append batch for both kinds (440 samples). The gate adds about 12 s to check:timing. Sent back: the PASS lines were hidden from plain check:timing output, which AC #1 ('records') needs visible.
<!-- SECTION:NOTES:END -->
