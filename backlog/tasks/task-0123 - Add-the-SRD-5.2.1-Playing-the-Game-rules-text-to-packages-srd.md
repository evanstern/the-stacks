---
id: TASK-0123
title: Add the SRD 5.2.1 Playing the Game rules text to packages/srd
status: In Progress
assignee: []
created_date: '2026-10-27 02:06'
updated_date: '2026-10-27 04:14'
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

Spec: specs/039-srd-rules-text
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 packages/srd exposes the Playing the Game sections as validated records with heading-path ids
- [ ] #2 The CC-BY-4.0 attribution covers the new records
- [ ] #3 A test proves the DC table and each d20-test section load
- [ ] #4 Spec phase: Rule kind in the package (schema, loader, compact)
- [ ] #5 Spec phase: Generated rule data and coverage proof
- [ ] #6 Spec phase: Wiki re-ground
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-26 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0123, branch task-0123-srd-rules-text, cut from origin/main a4aab3c. Spec number 039 claimed with a stub. Track C2.

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
(spec authoring, spec 039, commit 82d8188; served verified from transcript; ~156k tokens.) Deviation: plan.md and tasks.md written to the Spec Kit templates by hand, not via the speckit-plan/speckit-tasks skills; reported to the operator.

ORCHESTRATOR RULINGS 2026-10-26 on spec open questions: OQ-1 the rest of the Rules Glossary is out of scope; carded as a revisit with a trigger. OQ-2 TASK-0104 offers rule citations in the adjudicate prompt (DC table first). OQ-3 the SRD PDF is needed by Phase 2 only; operator asked.

OPERATOR RULING 2026-10-26 (OQ-3, in chat): 'Download it'. Phase 2 downloads the SRD 5.2.1 PDF from the pinned URL to a path outside the repo and checks the pinned sha256.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(implementation Phase 1, T001-T009, commit 9c0fc2c; ~137k tokens; served verified from transcript.) Orchestrator ruling: the compact 'See:' line renders child TITLES per plan.md D8 (Phase 2 resolves them from the loaded rule set); slugs were a Phase 1 placeholder.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(implementation Phase 2, T010-T018, commit fcebdb5; 117 rule records (85 dataset, 31 PDF, root bodyless); verify-against-pdf 1020 records 0 mismatches; hand check 38/38 contents entries + 16 records; five existing data files byte-identical; absentTopics: contests/opposed checks; ~278k tokens.)

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(Phase 3 wiki, T019-T022, commit 0849064; srd-data NEEDS-REVIEW amended and re-pinned to 64daef4; CAPSULES regenerated; ci:check, freshness, spec-bridge green.)
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
