---
id: TASK-0337
title: Intent settled by an AI-seat ruling is never narrated
status: In Progress
assignee: []
created_date: '2026-11-14T02:22:00Z'
updated_date: '2026-11-14T02:31:00Z'
labels:
  - playtest
  - ws:narration
  - bug
milestone: m-10
dependencies: []
references:
  - docs/playtests/2026-11-13-r1-spine-test-drive.md
priority: high
ordinal: 321000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in the 2026-11-13 R1 spine test drive (session 0106e608). /search #ferry-house went declared (seq 37), then a code confirm row (seq 39), then 👍 to confirmed with needs_ruling (seq 40). A 'ruling' turn (job c10e75d5) answered it: the AI seat accepted at easy, Perception 6 vs DC 10, failure (seq 42-44). The job then ended 'empty-beat' with no narration. Cause: pipeline/runner.ts (around line 216) returns empty-beat for an empty beat unless the trigger is 'scene-start' or 'intent'; 'ruling' is not exempt. Enqueue rule 9 does not catch it either, because the settling ruling row comes from ai:dm inside a job (appendedByJob). Every AI-seat-ruled check or attempt in exploration ends silent. This interacts with TASK-0199 (rule 9), TASK-0269 (narrate window, factsThrough) and spec 102 FR-023 (rulings at the start of each AI-seat turn).

Spec: specs/111-ruling-narration
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A ruling turn that settles Intents narrates their facts through the narrate window, with an integration test built from this flow (declared, suggest, accept, needs_ruling, ruling, narration).
- [ ] #2 No AI-seat-settled Intent ends a job as empty-beat without narration, with a test.
- [ ] #3 The playtest auditor gains a deterministic check that fails when a settled or stopped Intent has no narration segment covering it, run in CI through the scripted harness scenario, with a negative proof.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Knock-on effect (session 0106e608, seq 45-51): the next deed, /move #causeway, settled and queued an intent turn (job c3d842c0). Its narrate window picked up the stranded search facts and narrated only the search (seq 51). The move got no prose and no fact row, so every narration lands one deed late. Add an AC: a window holding several settled Intents narrates each, and the latest deed is never dropped.

Claimed 2026-11-13 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0337, branch task-0337-ruling-narration, cut from origin/main 594dd99a. Spec number 111 claimed with a stub.
<!-- SECTION:NOTES:END -->
