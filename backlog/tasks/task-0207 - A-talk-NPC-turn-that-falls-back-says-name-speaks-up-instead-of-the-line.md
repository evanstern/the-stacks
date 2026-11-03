---
id: TASK-0207
title: A talk NPC turn that falls back says '<name> speaks up' instead of the line
status: In Progress
assignee: []
created_date: '2026-11-02 23:04'
updated_date: '2026-11-03 03:51'
labels:
  - dm
  - narration
  - playtest
milestone: m-3
dependencies:
  - TASK-0193
references:
  - docs/playtests/2026-11-02-runbook-a-playtest.md
priority: high
ordinal: 193000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: when an NPC's turn is talk and the narration falls back, the player still reads what the NPC said (the planned line), not '<name> speaks up.'

Why: runbook A playtest run 1 (2026-11-02, session 9296c653, seq 124-127). Pell's NPC turn: the Director planned a useful shout (the clapper is tied with a wet slip-knot; four goblins, two hidden left of the fire), and interpret recorded the lines as followUps with step 'none' and reason 'Pell is grappled and can't act physically, but can shout a clue to the party with no roll needed.' The audit refused three narrations (Snag acting in Pell's beat, Pell's feelings decided, the next actor acting, length). The TASK-0193 fallback could not voice the reason (it holds rules language: 'no roll needed'), so it shipped 'Pell Marsh speaks up. Goblin with a pot-helm moves next.' The players never heard the clue. The operator: 'narrated simply as "Pell Marsh speaks up" instead of actually speaking for Pell'.

Where: apps/server/src/dm/fallback.ts plannedSentence (spec 071): for intent talk, voice the planned speech (followUps or a dedicated say field) before the generic line. Interpret could also keep a speakable reason separate from the rules note.

Spec: specs/081-talk-fallback-line
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A talk NPC turn whose narration falls back ships the NPC's planned words in fiction, with a test replaying seq 124-126
- [ ] #2 The plan carries the NPC's line in a field the fallback can voice (not mixed with rules notes like 'no roll needed')
- [ ] #3 Spec phase: The plan carries the line (card AC #2; US2)
- [ ] #4 Spec phase: The fallback voices the line (card AC #1; US1, US3)
- [ ] #5 Spec phase: Wiki re-ground
<!-- AC:END -->







## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-02 by M3 runbook B (docs/design/m3-runbook-b-resolution-quality.md). Worktree .worktrees/task-0207, branch task-0207-talk-fallback-line, cut from origin/main b79489e2. Spec number 081 claimed with a stub. Spine #10.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5 (spec 081 authoring, C1)
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
