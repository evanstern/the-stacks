---
id: TASK-0272
title: Narration as prose slots; retire the audit loop
status: In Progress
assignee: []
created_date: 2026-11-07 05:13
updated_date: '2026-11-11T16:37:00Z'
labels:
  - ws:narration
  - replan-2026-11
  - ep-1
milestone: m-10
dependencies:
  - TASK-0245
  - TASK-0273
ordinal: 256000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The narrator fills restate, describe and ask slots from the fact sheet. Delete regenerate-then-fallback. Replace the audit with a code leak check (unrevealed ids) and a contradiction check against facts. A failed check appends a correction row and never blocks play.

Parent epic: TASK-0258.

Source: docs/design/replan-2026-11/board-rework-map.md (N-07).

Spec: specs/103-prose-slots
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 No narration path regenerates for audit reasons.
- [x] #2 Narration writes no digits; fact rows carry every number.
- [ ] #3 The R1 playtest shows zero fallback lines.
- [x] #4 `dm/claims.ts` lexical gate is deleted.
- [x] #5 Spec phase: Check module and helper moves
- [x] #6 Spec phase: `why` rows and the digit drop
- [x] #7 Spec phase: Turn pipeline swap and deletions
- [x] #8 Spec phase: Job-record consumers
- [x] #9 Spec phase: C-AUD replay script
- [ ] #10 Spec phase: Wiki re-ground
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From spec 098 OQ-10: TASK-0245 owns the prose slots and the code-composed reply. This card retires the audit loop and renders PlanFact as why rows (spec 098 contract §6).

Claimed 2026-11-11 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0272, branch task-0272-prose-slots, cut from origin/main 0b3c378b. Spec number 103 claimed with a stub.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5
Spec 103 authored (39c9ed24, ~19 min, 57 tool calls) against 098 a370041c, 093 beae54aa, 097 a34d5d39, 102 86d425b6, base 0b3c378b.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Phases 1-2 done in one commit (81fe389c): ci:check green, 2020 server tests with REQUIRE_DATABASE=1. renderWhyRows forms (DC 15 / Difficulty: easy / Opposed by X (rule)) are the implementer's reading of spec 098 contract section 6.

C9 (operator go 2026-11-11, "Go, run export"): ran specs/103-prose-slots/c-aud-export.sql read-only against vm-104 stacks-dev-db-1. Export at ~/.cache/stacks-sweep/c-aud-bb4952dc.json (not committed): 231 events, 48 jobs, 141 calls (33 dm.audit, 34 dm.narrate), matching the B2 log's 141 model calls.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Phases 3-4 done (78eaf138, OQ-1 isolated in 320aee54, 842c0ffc, ded794d3): ci:check green with REQUIRE_DATABASE=1; reverting 320aee54 leaves typecheck and test/dm green. Gap vs spec OQ-8: narrate reads planFacts from resolve.appendedRows only; sent back with Phase 5. Stage 'check' written as 'narrate' (no migration); revisit card at merge.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Phase 5 done (61393c1e). B2 replay: 25 narrated turns; 19 passed -> 18 clean + 1 leak; 3 passed-after-regenerate -> 3 clean; 3 fallback reported, not judged; 0 contradiction hits. The one leak (seq 43, absent-actor 'goblin's') is a false positive: goblin-3 went absent at seq 40 in the same beat (fled) and the narration describes that flight. Sent back to fix: exempt actors whose presence changed in the beat's own rows.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Departed-actor fix (7a36c9e9) and phase 6 wiki (5064cba6). Final B2 replay: 25 narrated turns, 0 leak hits, 0 contradiction hits; 3 fallback turns reported, not judged.
<!-- SECTION:NOTES:END -->
