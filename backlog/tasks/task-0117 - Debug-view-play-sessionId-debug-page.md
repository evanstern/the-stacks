---
id: TASK-0117
title: 'Debug view: play/:sessionId/debug page'
status: In Progress
assignee: []
created_date: '2026-10-27 01:47'
updated_date: '2026-10-27 09:24'
labels:
  - debug-view
  - web
  - play-route
milestone: m-3
dependencies:
  - TASK-0116
documentation:
  - docs/design/debug-view.md
priority: high
ordinal: 38600
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: an operator opens play/:sessionId/debug beside the table and sees, live, why the table is waiting, what each DM job did, every event, and the state at any seq.

Why: the M2 demo showed a companion hold as a frozen table and narration fallbacks only by SQL. Design: docs/design/debug-view.md (card B, decisions D1, D2, D5 to D8). Spoilers are accepted: the page shows everything (D2).

Scope: web only, over the debug API card. Layout: a pinned 'why waiting?' strip over three linked columns (job timeline, event log, state). Tabs stay in reserve (D5).

Spec: specs/041-debug-page
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The play/:sessionId/debug route renders for an operator and renders OperatorOnly for anyone else; /play shows a Debug link to operators.
- [ ] #2 The page polls the debug API about every 2 s and advances the event log by seq cursor.
- [x] #3 The strip shows queued and running jobs with stage and heartbeat age, uncommitted actions, table mode and turn, pending proposals, companion holds, and the latest failed turn.
- [x] #4 The job timeline shows one card per DM job; an expanded turn card shows each pipeline node's output, submissions with linked seqs, audit attempts split blocking and advisory, the fallback flag, the failure record, and per-call usage.
- [x] #5 The event log shows every event with seq, time, actor name, type, visibility and payload, filtered by type, actor and visibility.
- [x] #6 Selecting a job highlights the events it wrote; selecting an event highlights the job that wrote it.
- [ ] #7 Clicking an event pins the state column to that seq; a back-to-live control unpins it.
- [ ] #8 Seed, ledger, journal and cost-total panels open as slide-out Panels; the page uses no modals.
- [ ] #9 A retry control calls POST /dm/sessions/:id/turn and shows only when a turn failed or the table is stuck.
- [ ] #10 The PR carries Brave screenshots of the page during a live session.
- [x] #11 Spec phase: Data layer — types, readers, client, snapshot, poller — DISPATCH (sonnet)
- [x] #12 Spec phase: Derivations — waiting summary, job view, links, filters, scrub — DISPATCH (sonnet)
- [x] #13 Spec phase: Route, hook, strip, retry and the Debug link (US6, US1; AC #1, #2, #3, #9) — DISPATCH (sonnet)
- [x] #14 Spec phase: Job timeline, event log and cross-links (US2, US3; AC #4, #5, #6) — DISPATCH (sonnet)
- [ ] #15 Spec phase: State column, seq pin and panels (US4, US5; AC #7, #8) — DISPATCH (sonnet)
- [ ] #16 Spec phase: Live check in Brave (AC #10; runbook merge condition) — DISPATCH (sonnet)
- [ ] #17 Spec phase: Wiki re-ground and full gate — DISPATCH (sonnet)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-26 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0117, branch task-0117-debug-page, cut from origin/main 1de90d3. Spec number 041 claimed with a stub. Track B4. Depends on TASK-0116 (PR #62): draft-held until it merges.

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
(spec authoring, spec 041, commit 8939e2c.)

ORCHESTRATOR NOTES 2026-10-27 on spec open questions: Q1 the page ships wherever the app runs behind the operator role, following the operator's TASK-0116 ruling 'Ship everywhere' (to confirm with the operator at PR). Q2 Phase 6 decides the fake-gateway config; if neither outcome gives a useful turn, the Phase 6 implementer scripts one in the test harness style. Q3 carded as revisit (windowed fetch). Q4/Q5: TASK-0116 merged (#62, 654ad7b) — merge origin/main before Phase 1. Brave screenshots (Phase 6) are taken by the operator (ruling 2026-10-27).

OPERATOR RULING 2026-10-27 (in chat): 'I take them in Brave'. Agents cannot drive Brave; the operator takes the merge-condition screenshots (light and dark) from steps the orchestrator gives. Gate unchanged.

Phase 1 done (86a9b63): debug data layer.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 1 (orchestrator session 2): merge a4cf579, code 86a9b63. Local ci:check without a stack fails only on adjudicate.integration (pre-existing, TASK-0138); the rest of ci:check passes. ReadAttempt is derived from the stored audit shape (deterministic/llm issues, proseSha256); data-model.md clarification rides Phase 2.

Phase 2 done (39a5822): debug derivations.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 2 (39a5822): derivations. Orchestrator accepts the implementer's open choices: fallback badge from result.audit.final; a held turn leaves the strip once its companion job succeeds; scrub folds directly for non-ascending logs.

Phase 3 done (a02fd74): route play-debug.tsx, DebugGate, useDebugSession hook (first load, poller + visibilitychange, seed refetch on scene change, retry, loadOlderJobs), WaitingStrip, Debug link via debugHref. AC #1 and #3 proven by route-gate, waiting-strip and table-view tests. AC #2 (polling) and #9 (POST wiring) left unticked: the hook has no test that exercises polling or the POST; Phase 6 live check proves them.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 3 (a02fd74): route, strip, retry, Debug link; AC #1, #3 ticked. AC #2 (polling) and #9 (retry POST) are left for Phase 6's live check: no hook-level test exists. Next: Phase 4. The orchestrator paused after opening PR #66 (TASK-0140), per the operator's overnight instruction.

Phase 4 done (1379857): job-card, job-timeline, type-filter (ARIA combobox), event-log, DebugBoard selection wiring (job <-> seq highlight via buildSeqIndex). 19 new vitest cases (job-card, event-log, cross-link). Gates: web tests, typecheck, lint green; ci:check fails only adjudicate.integration (TASK-0138). Pin state is held (data-pinned-seq) for Phase 5 to render.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 4 (1379857): job timeline, event log, cross-links; AC #4-#6 ticked. Phase 6's live check covers the untested interactions: follow-bottom, scroll-into-view, combobox keys.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
