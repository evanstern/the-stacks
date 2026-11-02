---
id: TASK-0194
title: >-
  Acting on anyone or anything outside the turn order pulls it into the
  encounter
status: In Progress
assignee: []
created_date: '2026-11-02 04:31'
updated_date: '2026-11-02 06:16'
labels:
  - dm
  - gate
  - playtest
milestone: m-3
dependencies: []
priority: high
ordinal: 181000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: during an encounter a PC can act on a non-combatant NPC (free a captive, hand them something, drag them clear); the plan gate does not refuse the whole action because the target is not in the initiative order.

Why: alpha run 3 (2026-11-02, seq 118-133). Tamsin: 'I run to Pell and attempt to free him.' Pell is a captive seed NPC, present but not a combatant. After interpret was fixed the action resolved refused, UNKNOWN_COMBATANT (plan gate: not-a-combatant). The narration still showed Tamsin reaching the post, so the fiction and the ledger disagree, and the player lost the turn for a reasonable move.

Where: dm/gates/plan-gate.ts checkPlan id check (docs/wiki/dm-failure-and-gates.md); which step kinds may target a present non-combatant actor.

Related: TASK-0141 (absent actors), TASK-0142 (seed aliases), TASK-0182.

References: docs/playtests/2026-11-01-two-browser-alpha-run-3.md (run 3, session e8e8326d)

Spec: specs/068-noncombatant-targets
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A plan step may name a present non-combatant NPC as its target for non-attack steps (check, presence, condition) without UNKNOWN_COMBATANT
- [ ] #2 An attack or damage step on a non-combatant is still refused
- [ ] #3 A test replays run 3 seq 118 and resolves the free-Pell action
- [ ] #4 A step that targets a present actor outside the order adds that actor as a combatant with its own initiative roll, when it can act
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Operator, 2026-11-02, verbatim: "Not only that, but acting on anyone or anything not \"in combat turn order\" should be fine -- they or it just gets pulled into turn order and rolls their own initiative (if applicable)". Read as: widen this card. A step that targets a present actor or object outside the order is legal; an actor who can act joins the encounter (combatant.added plus its own initiative roll) instead of the plan gate refusing UNKNOWN_COMBATANT. Objects join without initiative. The spec decides which actors are 'applicable'. Evidence of the cost: free-Pell was finally done by Odo's later free-mode action (seq 214-218), after the encounter ended.

Claimed 2026-11-02 by M3 runbook A (docs/design/m3-runbook-a-run3-fixes.md). Worktree .worktrees/task-0194, branch task-0194-noncombatant-targets, cut from origin/main 7e252840. Spec number 068 claimed with a stub. Lane A2.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5

Operator ruling 2026-11-02 (in chat, answering 'How should the remaining lanes get write access to .worktrees/?'): "Allow edits via Bash". The harness edit guard blocks Write/Edit outside the session worktree; dispatched agents edit worktree files through Bash (heredocs, sed, scripts) instead.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
