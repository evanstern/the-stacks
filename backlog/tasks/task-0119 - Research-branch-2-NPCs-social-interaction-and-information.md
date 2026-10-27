---
id: TASK-0119
title: 'Research branch 2: NPCs, social interaction and information'
status: Done
assignee: []
created_date: '2026-10-27 02:05'
updated_date: '2026-10-27 04:21'
labels:
  - research
  - dm
  - doctrine
milestone: m-3
dependencies:
  - TASK-0115
priority: medium
ordinal: 106000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the AI DM's NPC and information doctrine rests on documented DM practice, with contract decisions made before doctrine text. Scope: NPC attitudes as persistent state, social checks and their DCs (DMG 2014 Ch 8 Resolving Interactions; SRD 5.2.1 Influence), NPC knowledge limits and lying, clue economy (Three Clue Rule versus doctrine pair one-clue), DM-side reading of NPC secrets (TASK-0107). Vault: docs/research/ (scaffolded by TASK-0115). Method: research:research-vault, then research:analyze-vault. Source rules: paraphrase non-SRD books, cite by heading path, never commit their text; SRD 5.2.1 is CC-BY-4.0. Ordering basis: docs/research/DM-Craft-Map/Analysis-Refactor-Risk-and-Deep-Dive-Order.md (operator-approved 2026-10-26 on TASK-0115).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A vault branch for this topic passes the research branch gate
- [x] #2 An analysis note answers which NPC and information facts need contract fields, with a recommendation
- [x] #3 A decision record is created with the backlog CLI after operator go
- [x] #4 Follow-up cards exist, and TASK-0107 carries the applicable findings
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-26 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0119, branch task-0119-research-npcs-social, cut from origin/main a4aab3c. No spec dir: signed escape line covers this task. Track D2. Escape line E2. Decides TASK-0107.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(research gather, branch docs/research/NPCs-Social-and-Information, commits a612765 bde79d2; ~241k tokens; served verified from transcript.)

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
(analyze-vault + decision-0026 (D18, proposed), commits 04fa413 0093406; ~172k tokens; served verified from transcript.)
OPERATOR RULINGS 2026-10-26 (in chat): placement 'K3 now, K1-K6 after demo' (TASK-0107 = K3 joins Track C now; K1, K2, K4, K5, K6 are created in m-3 after the demo subset); attitude 'Per character' (each NPC tracks an attitude toward each PC; the analysis recommended party-with-override); clue lint 'Warn; fail only core'; Influence 'SRD Influence DC' (DMG table rejected).

AC #4: follow-up cards created on main 2026-10-26: K1 TASK-0148, K2 TASK-0149, K4 TASK-0150, K5 TASK-0151, K6 TASK-0152 (m-3, after the demo subset); K3 carried by TASK-0107 (m-3, ACs added). Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(decision-0026 accepted with operator rulings, commit be522d8; ~86k tokens.)
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Merged in PR #59 (2371ed5). Research branch docs/research/NPCs-Social-and-Information (11 notes + analysis) and decision-0026 (D18): NPC information and attitude move only through recorded facts. Operator rulings: attitude per character; clue lint warns, fails only core; SRD Influence DC; K3 = TASK-0107 now; K1, K2, K4, K5, K6 = TASK-0148 to TASK-0152 after the demo subset. Escape line E2.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
