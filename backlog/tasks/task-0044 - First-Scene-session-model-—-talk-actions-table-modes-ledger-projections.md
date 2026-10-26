---
id: TASK-0044
title: 'First Scene: session model — talk, actions, table modes, ledger, projections'
status: In Progress
assignee: []
created_date: '2026-10-25 19:59'
updated_date: '2026-10-26 03:05'
labels:
  - first-scene
  - session
milestone: m-2
dependencies:
  - TASK-0042
references:
  - docs/design/architecture.md
priority: high
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the session plane's play vocabulary. Typed, versioned event types and the projections built from them: talk versus action, the action lifecycle, table modes, party, encounter, secret trackers and the roll ledger.

Why: the session event log is the only source of truth; scene, party, encounter and journal are projections (decision-0017 layer 1). Talk never changes state; only a committed action reaches the DM pipeline (decision-0016). The ledger makes every number auditable (decision-0021 ideas 2 and 3).

The event log itself (M0) does not change. This card adds event types and projection code over it. Engine events from TASK-0042 are the mechanical payloads.

Spec: specs/028-session-model
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Zod-typed, versioned event types exist for talk, action declared, action commented, action committed and action resolved.
- [ ] #2 Talk events never change any projection except the transcript.
- [ ] #3 Table-mode events switch a session between free mode and turn mode, and turn mode records the active player.
- [ ] #4 Projections build scene, party, encounter and journal state from the log alone.
- [ ] #5 Secret trackers (named clocks) live in DM-only events, and a test proves player projections never include them.
- [ ] #6 Every roll event records its reason, and every state-change event records before and after values.
- [ ] #7 A test replays the log from seq 0 and rebuilds identical projections.
- [ ] #8 Projections skip unknown event types without failing.
- [x] #9 Spec phase: Setup — package scaffold and boundary rule
- [x] #10 Spec phase: Foundational — event schemas, catalog, decoding, visibility (US1, US2, US4, US5; AC #1, #6, #8)
- [ ] #11 Spec phase: User Stories 1–5 — the fold and every projection (AC #2, #3, #4, #5, #6, #7, #8)
- [ ] #12 Spec phase: User Story 6 — the fixtures contract
- [ ] #13 Spec phase: User Stories 3 and 5 — atomic batch append, server seam, database suite (AC #5, #6, #7)
- [ ] #14 Spec phase: Polish — full gate
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-25 by the M2 First Scene sweep (docs/design/m2-first-scene-sweep-runbook.md, lane 2) after TASK-0042 merged (#43). Worktree .worktrees/task-0044, branch task-0044-session-model, cut from origin/main 9f62664. Spec number 028 claimed with a stub.

Spec authoring by opus-implementer: 252644f, plus amendment 3a56b21; ~257k tokens in total. Clarify was skipped (spec.md records why).
Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
Orchestrator ruling 2026-10-25: mechanics batch append is atomic in this task (decision-0020; TASK-0045 does not own it). The spec's defaults for open questions 1, 2 and 4 stand; question 4 is recorded on the TASK-0045 card.
Implementation dispatch grouping: P1+P2 | P3 | P4 | P5+P6.

Phases 1 and 2 by sonnet-implementer: 447de88 and 1cd5d6b. 119 session-model tests pass; boundaries flag 15/15; ci:check green. Deviation accepted: @types/node as a test-only devDependency.
Note for Phase 5: the server will then import the engine and session-model at runtime, so the Dockerfile must build and copy both packages, as it does for packages/srd.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
