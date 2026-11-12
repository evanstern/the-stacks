---
id: TASK-0269
title: Interpret emits Intents
status: In Progress
assignee: []
created_date: 2026-11-07 05:13
updated_date: '2026-11-12T00:44:00Z'
labels:
  - ws:intent
  - replan-2026-11
  - ep-1
milestone: m-10
dependencies:
  - TASK-0266
  - TASK-0268
ordinal: 253000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Change `dm.interpret` to output Intents through structured output. Slash-form text bypasses the model. Ambiguous text returns a clarify question.

Parent epic: TASK-0258.

Source: docs/design/replan-2026-11/board-rework-map.md (N-04).

Spec: specs/104-interpret-intents
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Slash commands produce Intents with zero model calls.
- [ ] #2 Interpret output validates against the Intent schema on attempt 1 in >= 99% of the playtest corpus.
- [x] #3 A compound declaration yields one Intent per stage, each planned in turn.
- [x] #4 Band effects and the free retry (autoSuccess) keep working beside the Intent path until a card puts stakes on Intents (spec 097 OQ-5).
- [x] #5 A beat narrates the facts of every intent.recorded row it covers, including rows the gate settled before the turn job ran, as why rows (spec 102 OQ-4; spec 103 OQ-8 window: the job input carries only triggerSeq and intent.recorded has no action link).
- [ ] #6 Spec phase: Schema and slash parse
- [ ] #7 Spec phase: Prompt v17 and interpret node
- [ ] #8 Spec phase: Resolve Intent runner and beside data
- [ ] #9 Spec phase: Narrate window
- [ ] #10 Spec phase: Test and script migration
- [ ] #11 Spec phase: Wiki
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
CP-5 ruling 2026-11-08 (docs/design/r1-fast-table-runbook.md) F1: takes AC #4 from TASK-0267.

Operator ruling 2026-11-09 (R1 lane specs 097-100): spec 097 OQ-5 and spec 100 OQ-13 added as AC.

Claimed 2026-11-11 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0269, branch task-0269-interpret-intents, cut from origin/main 702390db. Spec number 104 claimed with a stub.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5
Spec 104 spec.md + plan.md (2ac78ce1) against 092 06d7ca13, 093 beae54aa, 097 a34d5d39, 100 16ae6147, 102 86d425b6, 103 39c9ed24, base 702390db. Size check: ~52 tasks; split recommended (PR A this card: AC 1,2,3,5,7 ~36 tasks; PR B new card: AC 4,6 ~16 tasks, after TASK-0223). Awaiting operator ruling on the split.

Operator ruling 2026-11-11 (in chat): "Approve split + OQs" — split per spec 104 plan (this card keeps AC #1, #2, #3, #5, #7; AC #4 and #6 move to a new card that lands after TASK-0223) and spec 104 OQ-1..OQ-9 as recommended.

Spec 104 tasks.md for PR A (f61a0bac): 36 tasks in 6 phases.

Orchestrator ruling (phases 1-2 dispatch): spec 104 changes the interpret reading shape in P1, and its consumers move in P3, so typecheck is red between them. Interim per-phase commits may be red (marked '[red: Phase 3 consumers pending]'); the runbook gate is ci:check green on the final tree. No legacy-union bridge. T004: the 18-kind union converts to JSON schema (draft-7, 0 refs, 18 oneOf); strict provider mode not verified (needs a paid call).

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Phases 1-2 (184b6c7b, 0077d599), both red by ruling. Spec slash example corrected in tests to the parse() grammar: /attack @goblin-2 with "Longsword".

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Phases 3-5 dispatch stopped at a blocker (WIP 74ac752c, red): action.resolve refuses UNKNOWN_BATCH for Intent stages. Frozen contract 029 gate-api.md:56 requires every batchId to name a ledger row with this actionId, and spec 102 FR-017 writes Intent engine rows with actionId null. Spec 104 FR-016 cannot be met as written. Awaiting operator ruling (C-GATE).

C-GATE ruling (operator, 2026-11-11, in chat): "Relax the gate (a)": action.resolve also accepts a batchId that an intent.recorded row names, when that row's Intent id is <actionId>.<n> for this action. Engine rows stay actionId null (spec 102 FR-017 unchanged). Amend specs/029-proposal-gate/contracts/gate-api.md line 56 additively, quoting this ruling.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Phases 3-5 done (a657c769 gate amendment, 72d7a388, 0e705bb3, 17667717 green). Orchestrator ran ci:check on 17667717: exit 0 (the agent misread 8 pre-existing lint warnings as failures). Full server suite REQUIRE_DATABASE=1: 1798 passed. Beyond the quoted C-GATE ruling: a ruling carrier's batch counts toward the Intent it answers (needed for the AI-seat check confirm). Behavior changes for operator review: seed NPCs not yet arrived are targetable through the planner (legacy refused UNKNOWN_COMBATANT); planner OUT_OF_RANGE now stops shots the old path rolled; each no-DC check under the AI seat queues one ruling turn.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Phase 6 wiki (b6f9dbc0): 26 notes re-pinned after prose review.
<!-- SECTION:NOTES:END -->
