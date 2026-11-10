---
id: TASK-0245
title: >-
  Every DM reply to an action follows one structure: restate, describe, ask,
  state
status: Done
assignee: []
created_date: 2026-11-05 04:52
updated_date: '2026-11-10T04:10:00Z'
labels:
  - dm
  - narration
  - playtest
  - design
  - ws:narration
milestone: m-10
dependencies: []
references:
  - docs/playtests/2026-11-03-runbook-b-playtest.md
priority: high
ordinal: 229000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
REWRITTEN by replan-2026-11: Fact sheet, code-rendered fact rows and State line, four-part template.

Intent: each narrate job receives a fact sheet: the restate target, the facts the ledger settled, the speakers and the slot names. Code renders every fact row (dice, damage, life state, condition) and the State line from engine state. The model writes no digit and no state (decision-0021 extended). The four-part reply is a template: restate, describe and optional ask are model slots; State is code. The spec keeps the decision tree over trigger (action, NPC turn, talk, scene or encounter start/end), resolution (applied, clarify, refused, no-effect, partly applied) and mode (free play, turn order). The 'What do you do?' ban stands (TASK-0204); the State line names whose move it is. N-07 (TASK-0272) builds the prose-slot narrator and the leak and contradiction check on this.

Source: docs/design/replan-2026-11/board-rework-map.md (rewrite row), plan-of-action.md §5, target-architecture.md, decisions-for-ratification.md.

Prior scope (superseded): a four-part reply policed by the narrate prompt and the audit, from runbook B playtest run 1 (2026-11-03, session 729a6c5c, seq 20). Operator rulings 2026-11-04: State line is code-rendered; restate is a narrator paraphrase; no design round. Related: TASK-0209, 0204, 0207, 0214, 0237, 0244.

Spec: specs/098-fact-sheet
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The spec states the decision tree: for each trigger, resolution and mode, which slots appear and what State says.
- [x] #2 A fact sheet schema carries restate target, settled facts, speakers and slot names, and every narrate job receives one.
- [x] #3 Code renders every fact row and the State line from engine state; the model writes no digit or state.
- [x] #4 The narrator fills only the restate, describe and optional ask slots, and the reply renders in template order.
- [x] #5 A clarify reply shows its question in the ask slot and a State line saying nothing has happened, replaying run 1 seq 15-20.
- [x] #6 No State line contains 'What do you do?'; each names whose move it is, with a test per branch.
- [x] #7 Phase 1: Rows, State line and slots as pure code (US2, US4; FR-004 to FR-008, FR-011, FR-012; plan D1, D2) (specs/098-fact-sheet tasks.md)
- [x] #8 Phase 2: Narrate builds and ships the sheet (US1, US3; FR-001 to FR-003, FR-009, FR-010, FR-013; plan D3, D4) (specs/098-fact-sheet tasks.md)
- [x] #9 Phase 3: Audit, fallback, talk, auditor and transcript follow the template (FR-014, FR-015; plan D5 to D10) (specs/098-fact-sheet tasks.md)
- [x] #10 Phase 4: Wiki re-ground (specs/098-fact-sheet tasks.md)
- [ ] #11 Spec phase: Rows, State line and slots as pure code (US2, US4; FR-004 to FR-008, FR-011, FR-012; plan D1, D2)
- [ ] #12 Spec phase: Narrate builds and ships the sheet (US1, US3; FR-001 to FR-003, FR-009, FR-010, FR-013; plan D3, D4)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rewritten by replan-2026-11. Fact sheet, code-rendered fact rows and State line, four-part template.

AC re-authored by replan-2026-11.

CP-5 ruling 2026-11-08 (docs/design/r1-fast-table-runbook.md) F4: may develop ahead of TASK-0268 against fixtures. Builds after TASK-0273. The spec states the fact-sheet input as settled engine events.

Claimed 2026-11-08 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0245, branch task-0245-fact-sheet, cut from origin/main d639c0e1. Spec number 098 claimed with a stub.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=cc/claude-opus-5-5 (spec authoring, grant C1)
Spec 098 (a370041c): FactSheet with code-rendered FactRow rows, tagged prose slots, code-composed reply, State line; dm.narrate-v22, dm.audit-v17; 4 phases. Orchestrator-settled (technical seams): OQ-1 tagged text (dm.narrate stays a text purpose per spec 093), OQ-2 FactRow in apps/server/src/dm/fact-sheet.ts (matches spec 097 OQ-10), OQ-5 NarrationFacts kept as settled, OQ-7 refusal wording table, OQ-8 drop ledger-format.ts from the footprint, OQ-9 position row noted on TASK-0271, OQ-10 slots owned here, noted on TASK-0272. Operator rulings pending: OQ-3 (rows still ride narration text, a partial meet of constitution VII), OQ-4 (no State line on talk replies), OQ-6 (audit stops blocking claim omission).

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5 (phases 1-4)
Phases a3aea616, 809cfe65, 803c548b, 2d3b45cd. dm.narrate-v22, dm.audit-v17. Clarify replay (run 1 seq 15-20, fixture rebuilt from the playtest log) 3/3. Server tests: 1437 pass with no DB; test/dm 1282 pass, 0 skipped with REQUIRE_DATABASE=1. ci:check exit 0. Orchestrator re-ran the replay test and freshness (OK 62); env:down done. PR held for spine order (#9, after TASK-0267).

Operator ruling 2026-11-09 (R1 lane specs 097-100): spec 100 OQ-12 — add fact rows for moves and zone reveals once TASK-0271 lands (position row). (Restored after the main merge.)
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Rows, State line and slots as pure code (US2, US4; FR-004 to FR-008, FR-011, FR-012; plan D1, D2): 6/6 · Narrate builds and ships the sheet (US1, US3; FR-001 to FR-003, FR-009, FR-010, FR-013; plan D3, D4): 5/5 · Audit, fallback, talk, auditor and transcript follow the template (FR-014, FR-015; plan D5 to D10): 10/10 · Wiki re-ground: 5/5). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->
