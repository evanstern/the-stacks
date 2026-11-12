---
id: TASK-0299
title: Companion and monster turns emit Intents
status: In Progress
assignee: []
created_date: 2026-11-08 19:56
updated_date: '2026-11-12T19:18:00Z'
labels:
  - ws:intent
  - replan-2026-11
  - ep-1
milestone: m-10
dependencies:
  - TASK-0269
priority: high
ordinal: 283000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`dm/companion.ts` submits `action.declare` text, so each companion turn costs a companion call plus an interpret call. Monster turns run through the Director. R1 exit criterion 3 (a 4v4 round under 60 s) needs AI actors to emit typed Intents straight to the planner.

Source: docs/design/r1-fast-table-runbook.md finding F5, CP-5 ruling 2026-11-08. Parent epic: TASK-0258. (gap G2).

Spec: specs/107-ai-turn-intents
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An AI companion turn emits a typed Intent and makes no interpret call.
- [x] #2 A monster turn emits typed Intents from its stat block and tactics with no Director prose call on the mechanics path.
- [x] #3 AI-actor Intents pass the same gate and planner as player Intents, with a test.
- [x] #4 A fixture 4v4 round with three companions and four monsters completes under 60 s with the fake model.
- [x] #5 Spec phase: Monster turns emit Intents in code (AC #2, AC #3 monster half)
- [x] #6 Spec phase: Companion turns emit Intents (AC #1, card note)
- [x] #7 Spec phase: AI-actor parity tests (AC #3)
- [x] #8 Spec phase: 4v4 round under 60 s (AC #4)
- [ ] #9 Spec phase: Wiki re-ground
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From spec 096 OQ1 (TASK-0302): prompts/companion.ts still renders a human commenter's user id. Fix it here when companion turns emit Intents.

Claimed 2026-11-12 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0299, branch task-0299-ai-turn-intents, cut from origin/main 348afe1c. Spec number 107 claimed with a stub.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5
Spec 107 (98014bc2): 36 tasks, 5 phases, no split, no C-GATE or C-CON. Monster turns are code-only (monster-policy.ts plus a stay-put code Director); companions get a typed 'turn' field, which skips interpret. Awaiting the operator's call on the play-behavior OQs (OQ-3, OQ-7, OQ-8) before implementation.

Operator ruling 2026-11-12 (in chat): "Accept all". This approves the spec 107 design (code-only monster turns; a typed companion turn field) and OQ-1..OQ-8 as recommended. OQ-3 extends TASK-0313. OQ-5 and OQ-7 are carded.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Phases 1-2 (e29142ea, a74b03fc): ci:check exit 0 on each commit; full server suite REQUIRE_DATABASE=1: 1862 passed. Measured model calls: a monster turn makes 1 (narrate); a companion's own turn makes 2 (companion, narrate), down from 3 plus Director.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Phases 3-5 plus a missing-turn log fix (7f65fa7d, 8854bbfa, a13be04e, ad13f3d4). 4v4 bench: 'ai-round 4v4 ms=874 budget=60000ms OK model-calls: companion=3 director=4 narrate=8 interpret=0'. Negative proof with BUDGET_MS=1 fails. Gap: monster move-then-attack is covered by unit tests only, because every seed monster has a ranged attack; carded.
<!-- SECTION:NOTES:END -->
