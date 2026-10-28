---
id: TASK-0161
title: 'Actor-state gate: Check model-written roll reasons at the plan gate'
status: In Progress
assignee: []
created_date: '2026-10-27 19:52'
updated_date: '2026-10-28 21:41'
labels:
  - dm
  - rules-gate
milestone: m-3
dependencies:
  - TASK-0143
priority: medium
ordinal: 148000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a roll reason the DM model writes cannot contradict actor state, because the plan gate checks it before resolve logs it.

Why: operator ruling 2026-10-27 on TASK-0143 OQ-1 (a): model-written roll reasons stay out of U3's output gate, and this follow-up card checks them at the plan gate. Resolve logs the reason on the dice line before narrate runs, and the log is append-only. Evidence: M2 seq 221, step reason "shouting that two kin have fallen", shipped on the seq 225 dice line while only one goblin had died. Use the TASK-0143 checker (spec 051).

Spec: specs/058-roll-reason-plan-gate
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The plan gate runs the TASK-0143 actor-state checker on every model-written roll reason before resolve logs it.
- [ ] #2 A refused reason feeds the existing plan refusal path, with a test over M2 seq 221.
- [ ] #3 A reason the checker passes ships unchanged.
- [x] #4 Spec phase: Evidence fixture and failing tests (card AC #2, #3 evidence)
- [x] #5 Spec phase: The reason check in `checkPlan` (card AC #1, #2, #3)
- [x] #6 Spec phase: Resolve wiring, the refusal code, DB tests, contracts (card AC #1, #2, #3)
- [x] #7 Spec phase: DB suites and the mutation guard **[orchestrator]**
- [x] #8 Spec phase: Wiki re-ground
<!-- AC:END -->











## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Operator, 2026-10-28, verbatim: "0161 can be done in M3 if it fits well. If you think it should move to another milestone, I'll leave it to your judgement". Orchestrator ruling: keep in M3. It is the direct follow-up of TASK-0143 (an M3 sweep task), and a dice line that contradicts actor state would show in the TASK-0053 demo. It runs after TASK-0168, because both touch the roll path.

Claimed 2026-10-28 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0161, branch task-0161-roll-reason-plan-gate, cut from origin/main b51f0b42. Spec 058 authored at bbcb1374: checkPlan runs the spec 051 checkClaims on every step reason and autoFail reason against S0 plus a presence-only planned diff; a refused reason refuses the group through the existing path; a resumed plan (spec 057) keeps its id check but does not rerun the reason check. Open questions OQ-1 to OQ-3 go to the operator.
Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5

Operator ruling 2026-10-28, verbatim: "TASK-0161: I accept the recommended defaults OQ-1 to OQ-3 (a): a contradicting reason refuses the whole group, add REASON_CONTRADICTS_STATE to the engine refusal enum (amend 026 refusals.md), and check condition source text in the same walk."

Phase 1 (T001-T008) at 2df57ca0: M2 seq 221 fixture read from the log, the seq 221 case fails as plain it and is marked it.fails, control passes. Without a DB, ci:check shows only the 5 known adjudicate.integration requireDb failures (TASK-0138).
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 2 (T009-T021) at 9bbf9314: checkPlan runs checkClaims on step reasons, autoFail reasons and condition sources against S0 plus the presence-only planned diff; resumed groups skip it; arrivingNpcs exported. plan-gate.test 41 pass; ci:check shows only the 5 known adjudicate.integration requireDb failures (TASK-0138).
Orchestrator rulings: (1) the Phase 1 assertion used field `kind`; ClaimIssue names it `claim`, so the fix to `claim: "count"` stands (the it.fails masked it). (2) T016 example verb "staggers" is not in the spec 051 act lexicon; tests use "steps", which it holds. The lexicon is spec 051 scope and stays unchanged here.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 3 (T022-T030) at c7999f3f: resolve passes arriving and resumed; refusalCode comes from the verdict; REASON_CONTRADICTS_STATE appended to the engine enum (OQ-2 (a)), count 27->28, PLAN_GATE_ONLY exemption in coverage.test; 3 resolve DB tests; 026 refusals.md, 031 resolve.md, 051 claim-gate.md amended additively. Without a DB, ci:check shows only the 5 known adjudicate requireDb failures.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 4 [orchestrator] at c7999f3f on stacks-task-0161 (test DB migrated): REQUIRE_DATABASE=1 resolve.integration, encounter-end-resolves, human-dm-roll-resume, full-turn, duo, script-env, scene.integration, worker, plan-gate and adjudicate.integration: 12 files, 153 tests passed, 0 skipped. No scripted suite hit a refused reason (T032 nothing to triage).
Mutation guard (T033): reason walk disabled at plan-gate.ts:351 -> 7 failed in plan-gate.test + resolve.integration: seq 221, act refusal, autoFail.reason, condition source (OQ-3), first-text-only, T025 NPC group, T026 action group. Pass-direction cases (arriving exemption, resumed skip, T027) stay green as expected. Restored; git diff empty. The app DB was not migrated: spec 058 has no UI change and no live run.

Phase 5 (T034-T039) at 0f13e67f: re-pinned dm-failure-and-gates, output-claim-gate, dm-turn-jobs, dm-runtime, dnd5e-engine, plus seed-npc-presence and turn-floor (flagged by freshness); CAPSULES regenerated, INDEX sentence, runbook row. Freshness OK (55 notes), spec-bridge check exit 0.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
