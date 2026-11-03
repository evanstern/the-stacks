---
id: TASK-0209
title: A clarify question is dropped and the player's turn is spent
status: In Progress
assignee: []
created_date: '2026-11-02 23:13'
updated_date: '2026-11-03 00:38'
labels:
  - dm
  - playtest
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-11-02-runbook-a-playtest.md
priority: high
ordinal: 195000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: when interpret asks the player to clarify, the player sees the question and keeps their turn until they answer.

Why: runbook A playtest run 1 (2026-11-02, session 9296c653, seq 172-182). Tamsin: 'I attack Pell'. Interpret returned no steps and clarify 'Longsword in melee, or the light crossbow at range?'. The action resolved no-effect, but the turn advanced anyway (seq 176) to Pell's NPC turn. The audit refused the narration (an option menu) and the fallback shipped 'Pell Marsh moves next. What does Tamsin Vale do?' (fallback.ts:283). The player never saw the question and lost the turn. The operator read it as 'refused as expected' — the AC-2 rule (no attacks on a non-combatant) was never exercised: Pell is a combatant since Snag's turn pulled him in (seq 97), so the gate passed the plan.

Also: once a pulled non-combatant becomes a combatant, an attack on him is legal. Whether TASK-0194's refusal of attacks on non-combatants should still cover a pulled captive is an open question for the operator.

Where: dm/nodes/resolve.ts (the turn advance after a clarify group), dm/fallback.ts:280-284 (voice the clarify question, not 'What does X do?').

Spec: specs/073-clarify-keeps-turn
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A clarify reading holds the turn (no turn.advance) until the player answers, with a test replaying seq 172-176
- [ ] #2 The narration or fallback shows the clarify question itself, with a test
- [ ] #3 Spec phase: A clarify holds the turn (card AC #1, merge condition; US1)
- [ ] #4 Spec phase: The player sees the question (card AC #2; US2)
- [ ] #5 Spec phase: Wiki upkeep
<!-- AC:END -->







## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Operator ruling 2026-11-02 on the open question: "I actually think that the rule itself is incorrect -- we should be able to attack anyone regardless of combatant state." Carded as TASK-0210. This card stays about the dropped clarify question.

Claimed 2026-11-02 by M3 runbook B (docs/design/m3-runbook-b-resolution-quality.md). Worktree .worktrees/task-0209, branch task-0209-clarify-keeps-turn, cut from origin/main b756b68f. Spec number 073 claimed with a stub. Spine #2.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5 (spec 073 authoring, C1)
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
