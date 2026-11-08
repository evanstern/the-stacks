---
id: TASK-0245
title: >-
  Every DM reply to an action follows one structure: restate, describe, ask,
  state
status: To Do
assignee: []
created_date: '2026-11-05 04:52'
updated_date: '2026-11-08 19:55'
labels:
  - dm
  - narration
  - playtest
  - design
  - 'ws:narration'
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
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The spec states the decision tree: for each trigger, resolution and mode, which slots appear and what State says.
- [ ] #2 A fact sheet schema carries restate target, settled facts, speakers and slot names, and every narrate job receives one.
- [ ] #3 Code renders every fact row and the State line from engine state; the model writes no digit or state.
- [ ] #4 The narrator fills only the restate, describe and optional ask slots, and the reply renders in template order.
- [ ] #5 A clarify reply shows its question in the ask slot and a State line saying nothing has happened, replaying run 1 seq 15-20.
- [ ] #6 No State line contains 'What do you do?'; each names whose move it is, with a test per branch.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rewritten by replan-2026-11. Fact sheet, code-rendered fact rows and State line, four-part template.

AC re-authored by replan-2026-11.

CP-5 ruling 2026-11-08 (docs/design/r1-fast-table-runbook.md) F4: may develop ahead of TASK-0268 against fixtures. Builds after TASK-0273. The spec states the fact-sheet input as settled engine events.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
