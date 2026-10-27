---
id: TASK-0112
title: Playtest seat stops declaring actions for a downed hero
status: In Progress
assignee: []
created_date: '2026-10-26 20:08'
updated_date: '2026-10-27 09:55'
labels:
  - playtest
  - harness
milestone: m-3
dependencies:
  - TASK-0140
  - TASK-0141
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
- [ ] #3 The declare gate refuses a character that is not conscious or is absent, with a refusal code and a test (decision-0025 §3.1, card U6)
- [ ] #4 The engine refuses an unconscious, stable or incapacitated attacker or checker, beside the existing dead-actor refusals, with engine tests (decision-0025 §3.2, U6)
- [ ] #5 A plan gate refuses a step whose actor or target is missing from S0 or absent (decision-0025 §3.2, U6; needs TASK-0140 and TASK-0141)
- [ ] #6 Death-save turns for unconscious PCs still run (U6)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
OPERATOR RULING 2026-10-26: 'Fold into TASK-0112'. decision-0025 card U6 (able-actor gates) lands here as added ACs; it answers this card's question of whether the engine or gate refuses a declared action from an unconscious character: yes.

Claimed 2026-10-26 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0112, branch task-0112-downed-hero-gate, cut from origin/main 429e865. Spec number 046 claimed with a stub. Session 2 of the M3 orchestrator (2026-10-27). Track C5 (runbook amendment 1), with U6 folded in.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
