---
id: TASK-0117
title: 'Debug view: play/:sessionId/debug page'
status: To Do
assignee: []
created_date: '2026-10-27 01:47'
updated_date: '2026-10-27 04:27'
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
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The play/:sessionId/debug route renders for an operator and renders OperatorOnly for anyone else; /play shows a Debug link to operators.
- [ ] #2 The page polls the debug API about every 2 s and advances the event log by seq cursor.
- [ ] #3 The strip shows queued and running jobs with stage and heartbeat age, uncommitted actions, table mode and turn, pending proposals, companion holds, and the latest failed turn.
- [ ] #4 The job timeline shows one card per DM job; an expanded turn card shows each pipeline node's output, submissions with linked seqs, audit attempts split blocking and advisory, the fallback flag, the failure record, and per-call usage.
- [ ] #5 The event log shows every event with seq, time, actor name, type, visibility and payload, filtered by type, actor and visibility.
- [ ] #6 Selecting a job highlights the events it wrote; selecting an event highlights the job that wrote it.
- [ ] #7 Clicking an event pins the state column to that seq; a back-to-live control unpins it.
- [ ] #8 Seed, ledger, journal and cost-total panels open as slide-out Panels; the page uses no modals.
- [ ] #9 A retry control calls POST /dm/sessions/:id/turn and shows only when a turn failed or the table is stuck.
- [ ] #10 The PR carries Brave screenshots of the page during a live session.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
OPERATOR RULING 2026-10-27 (in chat): 'I take them in Brave'. Agents cannot drive Brave; the operator takes the merge-condition screenshots (light and dark) from steps the orchestrator gives. Gate unchanged.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
