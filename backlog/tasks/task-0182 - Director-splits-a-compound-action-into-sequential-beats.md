---
id: TASK-0182
title: Director splits a compound action into sequential beats
status: In Progress
assignee: []
created_date: '2026-10-30 00:56'
updated_date: '2026-10-30 04:22'
labels:
  - dm
  - director
  - rules
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-10-28-two-browser-alpha.md
priority: high
ordinal: 169000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: when a player declares a plan, a movement or approach, and conditional follow-ups in one post, the DM resolves only the first step. It narrates the arrival and returns the floor before any follow-up resolves.

Why: two-browser alpha playtest 2026-10-28, run 2 item 4, session 166b8e59, action act-197dae73. One post held a plan (diplomacy first, force if needed), an approach (Tamsin walks openly to the goblin camp; Kestrel and Odo follow hidden in the reeds), and contingencies (attack on Tamsin's signal). The Director treated it as one beat. It advanced the alarm and dusk trackers, switched to turn mode and opened the reed-camp encounter before the party arrived. The interpret step assumed Tamsin had already been seen and hailed. Nothing resolved the stealth approach as a step that could fail. Players will post this way often. Follow-ups assume earlier steps succeed, so resolving them together removes the chance of failure on the way.

Related: TASK-0085 (Director scene framing and pacing), TASK-0120 (research: exploration, awareness and time), TASK-0180 (reactions to in-character talk).

Spec: specs/064-plan-first-step
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A declaration with a plan, an approach and conditional follow-ups resolves only the approach in its first beat, including any stealth or movement checks
- [ ] #2 The DM narrates the result of the approach and returns the floor before any follow-up resolves
- [ ] #3 A follow-up that assumes an earlier step succeeded is never resolved in the same beat as that step
- [ ] #4 Trackers and table mode change only for the steps that actually resolved
- [ ] #5 A test or playtest fixture covers a plan-approach-contingency declaration
- [ ] #6 Spec phase: The pure core (card AC #1, #3, #4)
- [ ] #7 Spec phase: Runner wiring, prompts, facts (card AC #2, #4)
- [ ] #8 Spec phase: The fixture and the live script (card AC #5)
- [ ] #9 Spec phase: DB suites, mutation guard, live check **[orchestrator]**
- [ ] #10 Spec phase: Contracts and wiki re-ground
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-29 by the M3 sweep, resumed 2026-10-29 (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0182, branch task-0182-plan-first-step, cut from origin/main ef2afdfb. Spec number 064 claimed with a stub. Runbook amendment 06fe2971: TASK-0182 before TASK-0180, both before alpha run 3.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5

Spec set 4460a382 (spec 064): 5 phases, OQ-1 to OQ-7 with (a) defaults; no frozen-contract change (additive 031 and 034 amendments); no migration. The author read for about an hour before writing; the orchestrator told it to write.

Operator ruled 2026-10-29 in the M3 sweep chat, verbatim: "TASK-0182: I accept the recommended defaults OQ-1 to OQ-7 (a), including the interpret-v5, director-v4 and narrate-v6 prompt bumps and the additive 031 and 034 amendments. Card the OQ-5 turn-mode revisit." Carded TASK-0183 (OQ-5 turn-mode revisit).

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5

Phase 1 ccbcfa8f: followUps on InterpretReadingSchema and Ruling; dm/first-stage.ts (firstStage, cutPlans, holdDirector), 12 unit tests. Non-DB gates green.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5

Phase 2 2b19ad0d: runner cut step after adjudicate and before resolve, checkpoint cut:true, reclaim-safe; prompts dm.interpret-v5, dm.director-v4, dm.narrate-v6; follow-ups rendered as "not yet attempted"; refused follow-ups withheld. Runner defaults a missing tableMode to turn (test stubs only). Non-DB gates green.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5

Phase 3 802dc3fe plus fixes 7b9b7583 and a7d49c0f: the plan-approach fixture, a DB test with a control, the greyhollow-plan-approach live script, declare.mjs, and offline schema checks of the script replies in dm-scripts.test.ts. On the stack, the orchestrator found: the Director reply was invalid (fixed); the test used non-existent event types (fixed); assertions were not scoped to the action turn and payloads not unwrapped. The orchestrator fixed the last two inline (two lines of test code). DB test 2/2 passed on stacks-task-0182. The turn ran 2 stealth checks, cut true, overrides turn and tracker, 2 follow-ups held, tableMode stay.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5

Live check 3b15247d (Brave, script mode greyhollow-plan-approach), every step passes: free mode after the turn; two stealth dice lines (Kestrel 8 failure, Odo 15 success vs DC 12); no encounter; narration covers only the approach; debug page shows held turn and tracker overrides; 12 shots, no modal.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
