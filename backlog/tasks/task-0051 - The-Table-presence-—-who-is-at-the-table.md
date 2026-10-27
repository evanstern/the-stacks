---
id: TASK-0051
title: 'The Table: presence — who is at the table'
status: In Progress
assignee: []
created_date: '2026-10-25 20:00'
updated_date: '2026-10-27 05:14'
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
- [ ] #6 Spec phase: Session model — the marker event (Foundational; FR-018, FR-021)
- [ ] #7 Spec phase: Live presence and the protocol amendment (US1, US2; FR-002–FR-005, FR-008–FR-013)
- [ ] #8 Spec phase: The marker writer and the Director (US3; FR-012–FR-016, FR-019–FR-023)
- [ ] #9 Spec phase: The presence strip (US1; FR-005–FR-007, FR-024; merge condition)
- [ ] #10 Spec phase: Wiki (re-ground)
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

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
(spec authoring after C2: decision-0024, spec/plan/tasks, commits d50a41a 8aa013c 6838967; ~183k tokens; served verified from transcript.)

ORCHESTRATOR RULINGS 2026-10-26 on spec open questions: Q1 one presence.recorded marker per DM turn stands (the operator's ruling: whenever presence feeds a decision; the Director reads it every turn). Q2 the Phase 3 implementer extends the failure-record node type with 'presence' if needed. Q3 no Director prompt change here (TASK-0050 owns it). Q4 the playtest harness static reader is accepted. NOTE: decision-0024 exists only on this branch; TASK-0135 reserves decision-0025.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(implementation Phase 1, T001-T007, commit d3cd2d5; served verified from transcript.)

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(implementation Phase 2, T008-T015, commit cf378f6; ws-protocol amended per decision-0024; playtest harness integration test hit the 5 s load timeout once, passed on re-run.)

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(implementation Phase 3, T016-T026, commit 5734a49; gate.recordPresence, worker marker per turn, presenceSeq, assemble presence; scripted playtest pass. scene.integration 'plays Greyhollow Ford' timed out at 5 s even solo once (5090 ms): Phase 4 baselines it against main.)

OPERATOR RULING 2026-10-27 (in chat): 'I take them in Brave'. The operator takes the two-session join/leave screenshots from specs/035-presence/evidence/OPERATOR-STEPS.md. Gate unchanged.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(Phase 4, T027-T036, commits 2b09a07 (recordPresence no longer replays the log: scene.integration ~2.8 s -> ~2.0 s, main ~2.2 s) and 5987a21 (presence strip); ci:check exit 0. T037 Brave screenshots await the operator per specs/035-presence/evidence/OPERATOR-STEPS.md.)

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(Phase 5 wiki, merge a10626b + f125c0e; 18 stale notes classified (11 amended, 4 small additions, 3 re-pin-only), new note presence; ci:check exit 0.) Remaining: T037 operator Brave screenshots per specs/035-presence/evidence/OPERATOR-STEPS.md.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(reconcile after #63/#64: merge 7698263, re-pins 0f90916; catalog 18 session / 36 total; ci:check exit 0, server 935 passed.) Orchestrator rebuilt the stacks-task-0051 app image from 0f90916 for the operator's screenshots.

Dispatch: tier=haiku pinned=claude-haiku-5-5 served=claude-haiku-5-5
(evidence commit e00f2e4: operator Brave screenshots join-a.png / leave-a.png, T037 ticked, OPERATOR-STEPS create-operator fix.) Merge condition met: window A lists AI DM, Ben and op on join; Ben gone after window B closed.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
