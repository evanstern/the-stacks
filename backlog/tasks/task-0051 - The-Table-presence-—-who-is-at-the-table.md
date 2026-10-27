---
id: TASK-0051
title: 'The Table: presence — who is at the table'
status: In Progress
assignee: []
created_date: '2026-10-25 20:00'
updated_date: '2026-10-27 03:37'
labels:
  - multiplayer
  - realtime
milestone: m-3
dependencies:
  - TASK-0048
references:
  - docs/wiki/ws-protocol.md
priority: medium
ordinal: 41000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: every client sees who is at the table, and the gate and the Director know which players are present.

Why: group sign-off (TASK-0049) needs the set of present players, and the Director should not wait on an absent one. The WebSocket protocol omits presence by design today (docs/wiki/ws-protocol.md), and its frame shapes are a frozen contract. Changing them is an operator checkpoint, so this card records a decision first.

Spec: specs/035-presence
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A decision record states how presence is carried (protocol frame or session event) and why.
- [ ] #2 Every connected client sees the list of present players and the DM.
- [ ] #3 A disconnect updates presence within a stated timeout.
- [ ] #4 The gate and the Director read presence through one server-side interface.
- [ ] #5 Tests cover join, leave and reconnect.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-26 by the M3 sweep (docs/design/m3-table-sweep-runbook.md, Track A1). Worktree .worktrees/task-0051, branch task-0051-presence, cut from origin/main a4aab3c. Spec number 035 claimed with a stub. Checkpoint C2: stop after spec.md for the ws-protocol frame ruling.

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
(spec authoring to checkpoint C2: spec.md + decision-draft.md, commit 1d2f809; served verified from transcript.) Note: .specify/feature.json was committed pointing at 035; revert it before PR.

OPERATOR RULINGS 2026-10-26 (checkpoint C2, answered in chat to the orchestrator's four questions):
- Carriage: 'D: frame + log marker'. Opt-in subscribe.presence flag and a full-snapshot presence frame for the UI, as in draft option A, PLUS a log event recording who was present whenever presence feeds a decision (sign-off quorum, floor, Director). Reason: Constitution IV ('Client state and agent context MUST both be projections of the log').
- Observers: 'Show as observer'.
- Timings: 'Timings stand' (5 s reload grace, 10 s ping, clean leave within 10 s, silent loss within 30 s).
- Multi-process: 'Card the revisit' (trigger: a second server process is planned). An absent human DM gets no new behaviour beyond the strip.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
