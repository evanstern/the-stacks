---
id: TASK-0123
title: Add the SRD 5.2.1 Playing the Game rules text to packages/srd
status: In Progress
assignee: []
created_date: '2026-10-27 02:06'
updated_date: '2026-10-27 03:28'
labels:
  - srd
  - rules
milestone: m-3
dependencies: []
priority: medium
ordinal: 110000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the project's rules baseline holds the DM-facing adjudication text, so engine, doctrine and research cite a repo copy. Today packages/srd holds class, condition, equipment, monster and spell records only; the Playing the Game chapter (d20 tests, ability checks, the DC table, advantage, contests, saving throws, Influence, Search and Study actions, exploration and social rules) is absent. Found by TASK-0115 (docs/research/DM-Craft-Map/SRD-5.2.1-Rules-Pass.md). SRD 5.2.1 is CC-BY-4.0; keep its attribution.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 packages/srd exposes the Playing the Game sections as validated records with heading-path ids
- [ ] #2 The CC-BY-4.0 attribution covers the new records
- [ ] #3 A test proves the DC table and each d20-test section load
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-26 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0123, branch task-0123-srd-rules-text, cut from origin/main a4aab3c. Spec number 039 claimed with a stub. Track C2.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
