---
id: TASK-0321
title: Code Director for turn-mode AI beats
status: In Progress
assignee: []
created_date: '2026-11-12T18:22:00Z'
updated_date: '2026-11-16T02:34:00Z'
labels:
  - ws:intent
  - revisit
milestone: m-10
dependencies:
  - TASK-0299
ordinal: 305000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spec 107 OQ-7. After TASK-0299, monster turns use a stay-put code Director, but companion beats still make a dm.director call. Trigger: the CP-7 hosted 4v4 round breaches 60 s and the Director call is the largest share of round time.

Spec: specs/118-companion-code-director
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Companion beats in turn mode make no dm.director call, with a test.
- [ ] #2 The hosted 4v4 round time is re-measured after the change.
- [x] #3 Before any code change, profile one hosted companion turn: time the companion call, the narrate call and the Director call. If the Director is not the largest share, the card's scope moves to the largest share (runbook amendment 2026-11-15).
- [ ] #4 Spec phase: Runner code Director and its direct tests (FR-001–FR-008; AC #1)
- [ ] #5 Spec phase: Fight segment and the scripts that copy it (FR-009–FR-011)
- [ ] #6 Spec phase: Wiki
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Trigger fired 2026-11-14 (PR #184, session 8c7d506e): rounds took 95-104 s against 60 s, and Kestrel's and Odo's turns took 22-37 s each, about 60 s per round between them.

AC #3 profile (2026-11-15, from the hosted TASK-0338 retest, session 6031b671, vm-104 at 058f831c, round 1; read from the calls ledger, no new paid run):
- Odo turn 25.1 s: dm.companion 8.4 s (sonnet), dm.director 9.9 s (opus, in the commit turn job), dm.adjudicate 4.5 s (opus), dm.chronicle 2.0 s (haiku, overlaps). The commit job waited 2.0 s for the chronicle job before it started.
- Kestrel turn 39.9 s: dm.narrate 11.5 s (sonnet; tail of the previous turn), dm.companion 9.4 s, dm.director 18.7 s (opus, 1325 output tokens).
- Largest share: dm.director in both (Odo 39%, Kestrel 47%). The scope stays on the Director. The Director runs on opus, at $0.056-0.074 per call. Note: Odo also made a dm.adjudicate call (opus, 4.5 s), so the spec should check whether a companion beat needs it.

Claimed 2026-11-15 by the R1 sweep (handoff move 2). Worktree .worktrees/task-0321, branch task-0321-companion-director, cut from origin/main b6a6f683. Spec number 118 claimed in the shared spec-claims notes. Opus spec authoring follows the handoff rule ("Dispatch spec authoring to opus-implementer"), as for every R1 spec.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=cc/claude-opus-5-5

Operator ruling on the spec 118 Phase 2 fixture choice (2026-11-15, in chat): "Yes, (b)". The scene end folds into Tamsin round-1 reply in fight-round.json and the three files that copy it.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5

Build blocker (downed-seat harness case, 2026-11-15), resolved by the orchestrator from spec 118 D2/FR-007: option (2). The scripted hits kill all foes after Tamsin is downed, so the fight ends in code and the run stalls on seat-downed. Rejected: (1) would script the TASK-0354 party-down loop into a CI fixture; (3) leaves the end untested. T015 text gets reworded for ruling (b).
<!-- SECTION:NOTES:END -->
