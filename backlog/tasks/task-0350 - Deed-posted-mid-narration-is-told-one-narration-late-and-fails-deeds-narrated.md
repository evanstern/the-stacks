---
id: TASK-0350
title: Deed posted mid-narration is told one narration late and fails deeds-narrated
status: In Progress
assignee: []
created_date: '2026-11-15T04:42:00Z'
updated_date: '2026-11-15T05:55:00Z'
labels:
  - playtest
  - ws:dm
milestone: m-10
dependencies: []
priority: high
ordinal: 334000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Hosted run 2026-11-14 (TASK-0338, docs/playtests/2026-11-14-combat-smoke-hosted.md finding 10; session 8c7d506e). The auditor failed deeds-narrated at seq 80, 239, 242 and dice-lines at 81, 86, 88, 243, 252. Each flagged deed was posted while the previous NPC-turn narration (81, 243) was still streaming; the deed was then told in the next narration (86/88, 252). No deed went untold, but the segment's narration names the wrong deeds and dice. Decide whether the auditor should segment by each narration's facts window, or the runtime should hold a deed posted mid-narration for its own narration.

Spec: specs/115-deed-mid-narration
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A deed posted while a narration is streaming is told by a narration whose segment the auditor assigns it to
- [ ] #2 The 8c7d506e pattern (deed during an in-flight NPC narration) has a test that passes deeds-narrated and dice-lines
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-15 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0350, branch task-0350-deed-mid-narration, cut from origin/main 3525683f. Spec number 115 claimed with a stub.

Spec 115 authored (691721c3): auditor cuts segments at each narration's facts window (option c); runtime unchanged. No C-GATE. OQ-1: talk narrations carry no factsThrough; default leave, card if a run shows it.
Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=cc/claude-opus-5-5

Phase 1 done (bf69abc8): export factsThrough/narrationSeqs, cut-aware segments, contracts amended.
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5

Phase 2 done (a43495cd): 8c7d506e replay test plus control.
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5

Phase 3 wiki (c839c070) and test-suite re-pin (b5b6fcb2). Gates: REQUIRE_DATABASE=1 ci:check exit 0 (latency PASS, ai-round 1121ms OK), boundaries 28/28, freshness OK, plan empty, spec-bridge ok.
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5
Dispatch: tier=haiku pinned=cc/claude-haiku-5-5 served=cc/claude-haiku-5-5
<!-- SECTION:NOTES:END -->
