---
id: TASK-0050
title: 'The Table: turn-mode floor passing between players'
status: In Progress
assignee: []
created_date: '2026-10-25 20:00'
updated_date: '2026-10-27 15:29'
labels:
  - multiplayer
  - gate
  - ui
milestone: m-3
dependencies:
  - TASK-0048
references:
  - docs/design/architecture.md
priority: medium
ordinal: 40000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: in turn mode, the floor passes between human players in initiative order. Only the active player commits for their turn. Everyone else talks and suggests.

Why: decision-0016, turn-mode row. M2 has one human, so the floor only passes between that human and AI actors. Several humans need visible turn ownership and a clean handoff.

Spec: specs/049-turn-floor
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 In turn mode, only the active player commits an action for their character's turn.
- [ ] #2 Other players comment on the active player's declared action and suggest alternatives.
- [ ] #3 Ending a turn passes the floor to the next actor in initiative order, human or AI.
- [ ] #4 The play route shows whose turn it is to every viewer.
- [ ] #5 The DM passes or reclaims the floor at any time.
- [ ] #6 Tests cover a round with two humans and one AI companion.
- [x] #7 Spec phase: Turn rules and the `floor` kind (card AC #1, #3, #5; User Stories 1, 2, 3 gate half)
- [x] #8 Spec phase: Stall override and the `turn-floor` fixture (TASK-0049 Q5 gate half; card AC #6 fixture)
- [ ] #9 Spec phase: Server wiring — resolve guard, shared rules, follow-ups (card AC #3, #5; User Stories 2, 3)
- [ ] #10 Spec phase: Full round with two humans and one AI companion (card AC #6)
- [ ] #11 Spec phase: The `floor` job kind and migration (TASK-0049 Q5; decision-0024 absent wait; User Story 4)
- [ ] #12 Spec phase: Play route (card AC #2, #4, #5 UI; User Stories 1, 3, 5)
- [ ] #13 Spec phase: Wiki re-ground (runbook expected reviews)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope addition from TASK-0049 Q5 (operator accepted the defaults, 2026-10-27): the AI DM's override of a stalled party sign-off is in scope here.

Claimed 2026-10-27 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0050, branch task-0050-turn-floor, cut from origin/main 3529df2. Spec number 049 claimed with a stub. Spec 048 is taken by TASK-0141 (PR #73). Scope includes TASK-0049 Q5 (AI DM overrides a stalled party sign-off).

Spec author: spec.md (speckit-specify) at 5df5a4c; stopped before plan.md for rulings. Defaults first:
FT-1 new proposal kind floor {op end|take|return, turn, reason}, one atomic batch (turn.advance, settling, table-mode.changed); amends frozen 029 proposals.md. Alt B no new kind; C request marker + worker trigger.
FT-2 end for active actor or DM; take/return for seated human DM only; policy ask under a human seat, auto under AI; new codes FLOOR_NOT_HELD, TURN_MOVED, NOT_TURN_MODE (amends 029 policy-and-authority.md, gate-api.md). Alt: reuse COMMIT_NOT_ALLOWED, CONFLICT.
FT-3 new code-only job kind floor (absence + stall checks, notBefore, reconcile re-arms), one migration for jobs_kind_valid; amends 031 turn-jobs.md. Alt B turn trigger stall; C in-memory timers.
FT-4 turn-floor fixture row in 029 fixtures.md; replay check covers AI DM overrides.
FT-5 ai:dm action.commit override stall plans signoff marker + commit in one batch (amends 044 gate-api text). Alt: recordPresence first, two batches.
Q1 UI: inline header controls (End turn; Pass / Take / Return floor) plus a turn-order strip; no confirmation, no modals. Alt B Turn order slide-out; C composer + approvals slide-out.
Q2 no new stance; comment labelled Suggest an alternative. Alt B new suggest stance (amends 028).
Q3 AI DM passes only, no take/return. Alt B held-floor flag (amends 028); C lend op.
Q4 AI DM passes a human turn only when absent (30 s past 5 s grace). Alt B also ~5 min idle; C never.
Q5 stalled sign-off: after 120 s no stance change, quorum unmet, no objection, ai:dm commits as dm; an objection blocks. Alt B commit over objection; C nudge only.
Q6 write plan.md after PR #73 merges (both touch resolve.ts turn-advance group and settle.ts). Alt B plan now + reconcile task.
Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5

Operator ruling 2026-10-27 (verbatim): "TASK-0050: I accept the recommended defaults FT-1 to FT-5 and Q1 to Q6, including the frozen-contract amendments to 029, 031 and 044 and the one jobs migration."

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
(Resumed spec author for plan.md, design artifacts and tasks.md: c19179f.)
Orchestrator rulings 2026-10-27, applying the operator rulings (the operator may overturn either one):
- The FT-3 floor job payload gets two nullable fields, holder and stanceSeq. They let the job tell that the absence or stall it was armed for has not changed. They sit inside the ruled 031 amendment.
- Only an ai:dm floor end writes a floor marker. The planner refuses an ai:dm end with NOT_AUTHORIZED unless the active human is absent. This turns ruling Q4 (A) into a gate rule.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(Phase 1, T001-T008: bfd575c, 1cfb2ba, 6c7a9af. session-model 749 pass; ci:check without a DB: only the 5 expected adjudicate.integration failures.) The implementer settled several points the spec left open: TURN_MOVED details are {expected, actual}; an ai:dm end with no present set, or on an ai:* holder, is NOT_AUTHORIZED; the floor marker actor is system. It also added a minimal web case "floor" so the code typechecks; Phase 6 does the full web work. Commits carry the Sonnet trailer, and per the no-rewrite rule they stay as they are.

spec-bridge sync: Turn rules and the `floor` kind (card AC #1, #3, #5; User Stories 1, 2, 3 gate half): 8/8 · Stall override and the `turn-floor` fixture (TASK-0049 Q5 gate half; card AC #6 fixture): 0/5 · Server wiring — resolve guard, shared rules, follow-ups (card AC #3, #5; User Stories 2, 3): 0/8 · Full round with two humans and one AI companion (card AC #6): 0/3 · The `floor` job kind and migration (TASK-0049 Q5; decision-0024 absent wait; User Story 4): 0/9 · Play route (card AC #2, #4, #5 UI; User Stories 1, 3, 5): 0/8 · Wiki re-ground (runbook expected reviews): 0/6

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(Phase 2, T009-T013: 8c501bb, 06f4cd0, c3547d1. session-model 813 pass; ci:check without a DB: only the 5 expected adjudicate.integration failures.) Choices the implementer settled: the stall signoff marker holds exactly the present set, without ai:dm; a missing PlanContext.present is INVALID_PROPOSAL (Phase 3 T020 confirms the gate fills it); an objector outside the present set does not block.

spec-bridge sync: Turn rules and the `floor` kind (card AC #1, #3, #5; User Stories 1, 2, 3 gate half): 8/8 · Stall override and the `turn-floor` fixture (TASK-0049 Q5 gate half; card AC #6 fixture): 5/5 · Server wiring — resolve guard, shared rules, follow-ups (card AC #3, #5; User Stories 2, 3): 0/8 · Full round with two humans and one AI companion (card AC #6): 0/3 · The `floor` job kind and migration (TASK-0049 Q5; decision-0024 absent wait; User Story 4): 0/9 · Play route (card AC #2, #4, #5 UI; User Stories 1, 3, 5): 0/8 · Wiki re-ground (runbook expected reviews): 0/6

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(Phase 3, T014-T021: 27dfd0a, ec5a25a. REQUIRE_DATABASE=1 ci:check green: server 1081 pass; no flakes.) T020 needed no change: the gate fills PlanContext.present for every request. Orchestrator follow-up: the held-floor and crash-reclaim resolve tests were never seen red, so Phase 4 runs a mutation check on the moved and held guards.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
