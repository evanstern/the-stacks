---
id: TASK-0112
title: Playtest seat stops declaring actions for a downed hero
status: In Progress
assignee: []
created_date: '2026-10-26 20:08'
updated_date: '2026-10-27 10:21'
labels:
  - playtest
  - harness
milestone: m-3
dependencies:
  - TASK-0140
priority: medium
ordinal: 102000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the scripted playtest seat does not declare actions for its character while that character is at 0 HP or unconscious. It waits, or the run ends with a stated reason.

Evidence: TASK-0106 rerun 20261026T192319Z (specs/034-narration-quality/evidence/verify-20261026T192319Z-greyhollow-ford-provider/ classification.md, R2). After Tamsin dropped to 0 HP, the seat kept declaring 'offer a fair trade' and 'ready my sword' (seq 201, 216). The narrator correctly showed she could not act, and the auditor flagged player-agency, forcing the fallback. Also decide whether the engine or gate should refuse a declared action from an unconscious character before narration. Operator ruling 2026-10-26: card it in m-3.

Spec: specs/046-downed-hero-gate
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The driver does not declare a move for a seat character at 0 HP or unconscious, with a test
- [ ] #2 A decision records whether an unconscious character's declared action is refused before narration
- [x] #3 The engine refuses an unconscious, stable or incapacitated attacker or checker, beside the existing dead-actor refusals, with engine tests (decision-0025 §3.2, U6)
- [ ] #4 Death-save turns for unconscious PCs still run (U6)
- [x] #5 The declare gate refuses a character that is not conscious with CHARACTER_UNABLE (details.reason life-state) and a test (decision-0025 §3.1, U6; the absent half is TASK-0141)
- [ ] #6 A plan gate refuses a step whose actor or target is not a combatant in S0, before any step lands, with a test (decision-0025 §3.2, U6; the absent half is TASK-0141)
- [x] #7 Spec phase: Main merge, turn-jobs fix, engine `ACTOR_UNABLE` (card AC #3)
- [x] #8 Spec phase: Declare gate `CHARACTER_UNABLE` (card AC #5)
- [ ] #9 Spec phase: Plan gate against S0 (card AC #6)
- [ ] #10 Spec phase: Death-save turns by settling (card AC #4)
- [ ] #11 Spec phase: Driver and harness (card AC #1)
- [ ] #12 Spec phase: Wiki re-ground (runbook expected reviews)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
OPERATOR RULING 2026-10-26: 'Fold into TASK-0112'. decision-0025 card U6 (able-actor gates) lands here as added ACs; it answers this card's question of whether the engine or gate refuses a declared action from an unconscious character: yes.

Claimed 2026-10-26 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0112, branch task-0112-downed-hero-gate, cut from origin/main 429e865. Spec number 046 claimed with a stub. Session 2 of the M3 orchestrator (2026-10-27). Track C5 (runbook amendment 1), with U6 folded in.

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
The spec author stopped after spec.md (c0f38e9): two refusal codes amend frozen 029 gate-api.md. OPERATOR RULINGS NEEDED (recommended first):
OQ-1, the declare-gate code: (a) new CHARACTER_UNABLE with details.reason (life-state now, absent from TASK-0141) / (b) reuse NOT_AUTHORIZED / (c) two codes.
OQ-2, the engine code: (a) new ACTOR_UNABLE (26 to 27 codes; amends gate-api.md §2, specs/026 refusals.md and the action.resolved payload, additively) / (b) reuse TARGET_DEAD / (c) server-only.
SEQUENCING (amends the runbook across Track C cards): Option A (rec). TASK-0112 takes the life-state declare gate and the S0 plan gate. TASK-0141 takes both absent checks, adding 2 ACs and a dependency on TASK-0112. Option B: TASK-0141 first.
Defaults stated, not blocking: OQ-3 an unable creature's saving throw is allowed; OQ-4 the plan gate accepts ids added by this turn's encounter start; OQ-5 no interpret re-ask.
Finding: death saves today ride on the seat's declaration. AC #6 needs a code-only settling loop in resolve that rolls an engine death-save.roll for an unconscious PC.

OPERATOR RULING 2026-10-27 (in chat): "TASK-0112: I accept OQ-1 (a) CHARACTER_UNABLE, OQ-2 (a) ACTOR_UNABLE, including the frozen-contract amendments to spec 029 gate-api.md and spec 026 refusals.md, the OQ-3 to OQ-5 defaults, and sequencing Option A (absent checks move to TASK-0141)." Orchestrator applied Option A: ACs #3 and #5 replaced by their life-state and S0 halves; dependency on TASK-0141 dropped; TASK-0141 gains the two absent ACs and depends on TASK-0112.

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
(Spec authoring resumed after the operator ruling: plan and tasks, commit 44601a4. Six phases. FR-026 fixes the stale sentence in turn-jobs.md.)

Phase 1 done (45991b9): origin/main merged (9ad8aa9); turn-jobs Resolve order records operator approval; engine ACTOR_UNABLE (attack.roll, ability-check check.roll) with tests; contracts amended (026 row 27, 029 engine count 27, 028 refusalCode note); session-model catalog test. Engine 228 and session-model 600 tests green; ci:check fails only on the 5 adjudicate.integration tests (no stack, TASK-0138).

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 1 (merge 9ad8aa9, work 45991b9): engine ACTOR_UNABLE (27 codes); 026, 029 §2 and 028 amended as ruled; stale turn-jobs.md sentence fixed. Engine 228 and session-model 600 tests pass. Owed: the 028 session-events.md edit still lacks its 'Amended 2026-10-27' line; Phase 2 adds it.

Phase 2 done (be540e0): origin/main merged (fbb8a93); TASK-0117 T039-T041 ticked; 028 session-events.md Amended line added; gate CHARACTER_UNABLE (details.reason life-state, CHARACTER_UNABLE_REASONS exported), 029 gate-api.md §1 and §2 amended. session-model 606 tests and ci:check green with REQUIRE_DATABASE=1 on the task stack (gate.integration 23 tests pass), no re-runs.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 2 (merge fbb8a93, work be540e0): declare gate CHARACTER_UNABLE (details.reason life-state); 029 gate-api.md §1 and §2 amended as ruled. gate.integration passed 23 tests on stacks-task-0112; ci:check passed with REQUIRE_DATABASE=1. This branch also carries the TASK-0117 T039-T041 ticks; sync TASK-0117 to Done after this PR merges.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
