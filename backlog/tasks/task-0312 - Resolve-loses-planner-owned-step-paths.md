---
id: TASK-0312
title: Resolve loses planner-owned step paths
status: Done
assignee: []
created_date: '2026-11-11T19:50:00Z'
updated_date: '2026-11-13T06:17:00Z'
labels:
  - ws:intent
  - replan-2026-11
  - ep-1
milestone: m-10
dependencies:
  - TASK-0269
  - TASK-0223
ordinal: 296000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Split from TASK-0269 by operator ruling 2026-11-11 (spec 104 size check). After TASK-0269 ships, interpret emits only Intents, so resolve's step paths run only for old resumed checkpoints and the free-retry/autoFail fallback. Delete the code the planner now owns. Spec 104 plan names the files (resolve.ts, plan-gate.ts, nodes/adjudicate.ts, prompts/adjudicate.ts, step-grammar.ts if unused, the encounter-start gathering block). Lands after TASK-0223 (spec 104 OQ-9).

Parent epic: TASK-0258.

Spec: specs/110-resolve-cleanup
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 resolve.ts loses the code paths the planner now owns (moved from TASK-0267 by F1, then from TASK-0269 by the split).
- [ ] #2 An old-shape resumed plan is dropped and re-interpreted (spec 104 OQ-8).
- [x] #3 Spec phase: Throw-stub probe (no deletion)
- [x] #4 Spec phase: Step paths in resolve and the plan gate (AC #1)
- [x] #5 Spec phase: Schemas and old checkpoints (AC #3)
- [x] #6 Spec phase: Wiki
- [x] #7 Spec phase: Adjudicate node (C-GATE approved 2026-11-12)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From spec 109 (TASK-0223): add to the deletion list two items spec 104 D8 omits: the runSteps 'effect' case, and the Step-only loop in presenceTargets.

Claimed 2026-11-12 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0312, branch task-0312-resolve-cleanup, cut from origin/main e0d4ed33. Spec number 110 claimed with a stub.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5
Spec 110 (684d8e1a): 27 tasks, 6 phases, no split. Estimated deletions: about 1500 source lines and 2000-2500 test lines. Phase 1 is a throw-stub probe before any deletion. C-GATE before phase 3: the adjudicate seam in specs/031 node-seam.md and turn-jobs.md. AC #3 is a one-way door: old checkpoint readings are dropped and re-interpreted.

C-GATE ruling (operator, 2026-11-12, in chat): "Approve all". This approves deleting the adjudicate node, with Phase 3 amending specs/031-dm-runtime/contracts/node-seam.md and turn-jobs.md. It also approves the AC #3 one-way door (old checkpoint readings dropped and re-interpreted) and OQ-1..OQ-6 as recommended.

Operator ruling 2026-11-12 (in chat): "Agreed" to keeping gathering for now. Phase 2 (77e74f18) is reverted in 767fed0b. AC #2 and spec 110 phase 2 move to TASK-0327, because the greyhollow seeds put two squeeze edges between the party and reed-camp, so without gathering CP-7 fights would open at range. Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (phases 1-2). Phase 1 probe (9db40e74): every one of 168 stub hits came from a legacy fixture or a direct test of a deleted symbol, so no live path reaches the deletion inventory.

Phase 4 (spec 110) test migration, D6. DELETED, covered elsewhere: derived-numbers.integration (STAT_UNDEFINED, derived modifiers: planner checks/combat tests); opposition-and-help.integration (opposition DC, help grant: planner combat/checks tests, engine assist.granted/ended replay test); plan-gate.test checkPlan describes for stat, spell, absent, presence, pull, actor, opposition and help rules (planner refusals/legality tests); spells.integration bless SPELL_UNRESOLVED and no-such-spell SPELL_UNKNOWN (planner combat.test cast refusals); resolve.integration 'a retry that names a new risk rolls' (stakes.test isFreeRetry newRisk case); companion-own-turn.integration whole file (held-cast replay and R3 mixed actors: the off-turn hold now keys on the declarer, which the gate refuses to commit off turn for an Odo party action; TURN_HELD unit cases live in plan-gate.test 'checkPlan turn hold'; R3 mixed-actor refusal is a plain deletion per D4). DELETED, no Intent-path replacement yet, carded as TASK-0328: TASK-0213 Pell-pull initiative-line tests (3) and 'an adjudicate ruling effect step with a presence effect lands'. PORTED to stage fixtures: resolve.integration (check, band, free-retry, reveal, attack hit/miss/crit, refusal TARGET_NOT_PRESENT, seqs, commit order, marker via autoFail, reclaim/in-flight marker, order, settling, S1/diff, presence effects via beside onSuccess/onFailure, turn-moved guard); resolve.human-seat (autoFail check.roll held pending); spells.integration (sacred-flame, cure-wounds, slot spend, run-1 revive replay; declared by Odo); opportunity-attack.integration (move+check replay, second-move reaction once per attacker, reaction reset; run-1 STEP_ACTOR_MISMATCH plan deleted per D4); encounter-auto-end and fled-combatant (NPC surrender/flee as an attempt stage with a presence effect in beside, one scripted dm.adjudicate accept); first-stage.test, reveal-waits.test, runner.test, narrate.test, plan-gate askUndeclared and turn-hold.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (phases 3-4). Phase 3 86d090a4, phase 4 972a2b42; ci:check green with REQUIRE_DATABASE=1 on each. A stray root edit by the implementer was reverted by the orchestrator and the patch was re-applied in the worktree.

Phase 5 (5bcd2671) test migration. DELETED (no sibling needed; schema deleted): interpret.test.ts 'step schema (AC #5)' (check/attack step parse, no-total, circumstance default) and 'check stakes contract' (stakes.failure/success/cost/severe, reveals/newRisk defaults, opposition and help refinements, spell step); interpret-capture.test.ts legacy-schema parse of attempt 2 (kept the InterpretOutput failure assertion); presence-effect 'effect step'/'onHit' cases. Stakes rules are covered by InterpretStageSchema tests in interpret-intents.test.ts. PORTED to stage/Intent fixtures: presence-effect (presence in beside onSuccess/onFailure), rules-terms (skill/ability/condition rejection via InterpretReadingSchema check stage), clarify-keeps-turn (stages/stage/checkBeside), runner.test.ts reading(), assemble.test.ts pausedJob reading, npc-turn-narration reading. REPLACED: resume.test.ts old-shape skip case now proves FR-010; NEW dropLegacyPlan tests (clears interpret/cut/resumed, keeps lastSeq/submissions; new-shape unchanged). world.ts: removed checkStep, attackStep, spellStep, helpStep, reading().

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (phase 5). Phase 5 5bcd2671; ci:check green with REQUIRE_DATABASE=1. SC-001 grep is empty with a \bStepSchema word boundary. Unbounded, it matches only the unrelated IngestStepSchema and ConcurrencyStepSchema in bench/load/results.ts.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (phase 6 wiki). Final gates on merge of origin/main: ci:check REQUIRE_DATABASE=1 exit 0 (server 1789 passed; latency gate PASS; ai-round 4v4 851 ms); boundaries 28/28; wiki plan empty, freshness OK 65 notes; spec-bridge check exit 0.

spec-bridge sync: Throw-stub probe (no deletion): 4/4 · Adjudicate node (C-GATE approved 2026-11-12): 7/7 · Step paths in resolve and the plan gate (AC #1): 7/7 · Schemas and old checkpoints (AC #3): 5/5 · Wiki: 2/2 — status In Progress → Done
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Throw-stub probe (no deletion): 4/4 · Adjudicate node (C-GATE approved 2026-11-12): 7/7 · Step paths in resolve and the plan gate (AC #1): 7/7 · Schemas and old checkpoints (AC #3): 5/5 · Wiki: 2/2). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->
