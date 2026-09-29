---
id: TASK-0030
title: 'Benchmark system: ingest scaling, concurrency, and stress limits'
status: In Progress
assignee: []
created_date: '2026-09-29 02:36'
updated_date: '2026-09-29 23:02'
labels:
  - bench
milestone: m-1
dependencies:
  - TASK-0024
  - TASK-0021
  - TASK-0033
priority: high
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Operator requirement (doc-0001, 2026-09-28): find growing-pain limits before hosting. Produces the recorded measurement decision-0005 requires before any worker split or queue.

Spec: specs/021-load-bench
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An ingest benchmark measures jobs-table throughput and latency as queued volume grows, and reports where it degrades
- [ ] #2 A concurrency benchmark measures HTTP and WebSocket latency and errors as simulated users grow
- [ ] #3 Stress cases cover database connection exhaustion and app restart mid-ingest
- [ ] #4 Each case declares its tier: every commit, on demand, or against dev only; out-of-tier cases skip with a visible reason
- [ ] #5 Results are stored with config and commit
- [x] #6 Spec phase: Setup
- [ ] #7 Spec phase: Foundational (blocks every story)
- [ ] #8 Spec phase: User Story 1 — find where ingest degrades (P1, AC #1)
- [ ] #9 Spec phase: User Story 2 — find where concurrent users degrade (P1, AC #2)
- [ ] #10 Spec phase: User Story 4 — tiers, visible skips, and the CLI (P1, AC #4)
- [ ] #11 Spec phase: User Story 3 — stress cases (P2, AC #3)
- [ ] #12 Spec phase: User Story 5 — compare runs over time (P2, AC #5)
- [ ] #13 Spec phase: Polish, gates, re-grounding, and the dev run
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-09-29: now also depends on TASK-0033 (operator ruling): the ingest benchmark polls the jobs queue, so it needs the DB-only test stack to avoid the app worker stealing jobs.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5
(spec authoring; standing escalation sign-off 2026-09-29; ~196k tokens). No blocking checkpoint: no new dependency (fetch + existing ws); isolated <base>_load DB on the TASK-0033 test stack; generated original-word Markdown. Checkpoint T026: dev run from the Mac with --allow-dev, operator go on the exact command, operator supplies credentials; one sign-in session row, signed out in finally; no vm-104 command. Phase grouping: P1+P2; P3+P4; P5+P6+P7; P8.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5
(phases 1-2: profile/stats/synth/db/cases/results; 25 unit + 1 live-guard integration test; 378 pass under REQUIRE_DATABASE=1). Deviation accepted: extra load-db.integration.test.ts for the live DB-in-use guard.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5
(phases 3-4: ingest-scaling/smoke, concurrency local/smoke/dev-impl; small proof runs only — 0 failures; the small-scale knee reflects the worker's 2s POLL_MS floor, not a verdict; concurrency 1/5/10 users 0 errors, http p95 12-13ms, ws p95 6-12ms). decision-0005 verdict awaits the full demand.json run (T024).

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5
(phases 6-7: both stress cases pass live; restart-mid-ingest fix = bench fork timeout 15s->30s after 3 instrumented runs showed correct claim order, no product change; decision-0005 demand run committed). decision-0005 measurement: 1 worker 1.75 jobs/s, knee 100-250 queued; 2 workers 3.25 jobs/s, knee 250-500. Recorded measurement only; any worker split needs its own decision record (operator).

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5[1m] served=claude-sonnet-5
(phase 8 minus T026: merged main twice incl. #35; filled benchmarks.md 'Load and stress' (size_budget_exempt, two benches in one note by orchestrator instruction); 8 wiki notes reviewed; freshness OK 36; env down, prune clean). T026 dev run: operator checkpoint, pending.

T026 deferred by operator 2026-09-29 (option A): dev has no operator account (users table empty) and the runtime image does not ship scripts/create-operator.ts. Carded TASK-0036; the dev load run happens after it merges. The PR does not wait on T026 (spec).
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
