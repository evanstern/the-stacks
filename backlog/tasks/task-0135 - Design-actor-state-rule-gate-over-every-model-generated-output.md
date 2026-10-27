---
id: TASK-0135
title: 'Design: actor-state rule gate over every model-generated output'
status: Done
assignee: []
created_date: '2026-10-27 03:22'
updated_date: '2026-10-27 04:22'
labels:
  - design
  - dm
  - rules-gate
  - doctrine
milestone: m-3
dependencies: []
priority: high
ordinal: 122000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a decision record and design pattern by which every model-generated sequence (interpret, adjudicate, companion, narrate) receives the full tracked state of all actors in scope and the stage, and its result passes hard rule gates over that state before it is written or shown. Example: an actor at 0 HP cannot act, be narrated acting, or be counted as present opposition. Operator raised 2026-10-26 (M3 sweep Lane-0 ruling on TASK-0055): 'NPCs, PCs, anything with trackable stats should be tracked explicitly and the data should be passed around to the functions/gates which decide what happens.' Proposed hard rule (operator, to rule on): 'The LLM can add flavor or advance plot only in response to dice-rolls and those LLM-generated results must pass rule gates which take into account all trackable actors in the input.' Today (grounding, docs/wiki/dm-narration-quality.md, dm-failure-and-gates.md): resolve is the only gate writer and the engine owns numbers, but narration checks compare prose to this turn's facts only, life-state checks are word lists (apps/server/src/dm/audit-words.ts), and the rest rides the model-based dm.audit. The proposed hard rule must be reconciled with decision-0022 (D14) point 3 (a retry with no new risk succeeds without a roll) and with narration that is not roll-driven (scene framing, talk). Frames TASK-0104, TASK-0105, TASK-0110, TASK-0112, TASK-0127 and TASK-0130.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An inventory lists every model-generated output and, for each, the actor and stage state it receives today and the gates it passes
- [x] #2 A decision record (amending decision-0017 and decision-0022 where needed) states the actor-state contract and the hard rules, with the operator's ruling on the dice-only rule recorded in the operator's words
- [x] #3 The decision record names which existing m-3 cards implement which rules, and cards any rule no card covers
- [x] #4 The spec for the first implementation card is written against the decision
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-26 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0135, branch task-0135-actor-state-gate, cut from origin/main a4aab3c. No spec dir: signed escape line covers this task. Track C1. Escape line E3. Checkpoint C3 after the inventory.

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
(design inventory, docs/design/actor-state-gate.md, commit 0cb18c8; ~220k tokens; served verified from transcript.) AC #1 met. Stopped at checkpoint C3.

OPERATOR RULINGS 2026-10-26 (checkpoint C3, answered in chat to the orchestrator's questions):
- Binding wording: '3: Ledger + opposition dice'. Every model output passes a code gate over a snapshot of every tracked actor and the stage. Plot changes only through a recorded fact (a die result, or an engine outcome under decision-0022 point 3). Any change to an actor other than the one acting (harm, condition, flight, surrender, handover, disposition) needs a roll against that actor or an SRD rule that decides it. Uncontested effort needs no roll.
- Seed NPCs: 'M3, minimal'. Add presence state for seed NPCs now as a Track C card; richer NPC records stay with the Codex (M4).
- Position and range: carded as revisit TASK-0139 (orchestrator, decision-0020).

decision-0025 (D17) written, status accepted, commit ce68d69: formulation 3 adopted in the operator's words. AC #2 met. AC #3 half met: decision-0025 and docs/design/actor-state-gate.md section 5 map every rule to a card; uncovered rules are proposed as U1-U5, U7-U9 (U6 recommended as added ACs on TASK-0112). AC #3 ticks once the orchestrator creates those cards on main and the decision names their ids.

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
(decision record, decision-0025 (D17), commits 34297fa 6fe8d76 ce68d69; ~131k tokens.)

Dispatch: tier=haiku pinned=claude-haiku-5-5 served=claude-haiku-5-5
(docs: card ids linked into decision-0025 and actor-state-gate.md, commit dc5e74e; ~87k tokens; served verified from transcript.)
OPERATOR RULINGS 2026-10-26 (in chat): 'Add all, D17 order' -> TASK-0140 to TASK-0147 created on main; 'Fold into TASK-0112' (U6); 'Demo after a subset' (TASK-0053 runs after TASK-0140, TASK-0110, TASK-0112 with U6, TASK-0141, TASK-0142, TASK-0143; the rest of Track C merges after the demo, still in m-3). AC #4 (spec for the first implementation card) is met when TASK-0140's spec set is committed.

AC #4 met: TASK-0140's spec set is committed (specs/040-actor-snapshot, 1fd1f48, branch task-0140-actor-snapshot), written against decision-0025.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Merged in PR #60 (c4fe8c6). decision-0025 (D17): every model output passes code gates over a snapshot of every tracked actor and the stage; plot moves only through recorded facts; a change to another actor needs a roll against it or an engine-coded SRD rule (operator ruling, formulation 3). Amends decision-0017 and decision-0022 point 3. Design: docs/design/actor-state-gate.md. Cards TASK-0140 to TASK-0147; U6 folded into TASK-0112. Runbook amendment 1 and the 2026-10-27 handoff landed with it. Escape line E3; AC #4's spec is specs/040-actor-snapshot.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
