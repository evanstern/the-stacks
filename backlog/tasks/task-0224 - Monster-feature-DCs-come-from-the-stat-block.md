---
id: TASK-0224
title: Monster-feature DCs come from the stat block
status: Done
assignee: []
created_date: 2026-11-03 05:40
updated_date: '2026-11-16T05:23:00Z'
labels:
  - dm
  - engine
  - rules
  - ws:engine
milestone: m-10
dependencies:
  - TASK-0104
ordinal: 210000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Spec 082 (TASK-0104) OQ-7: a DC a monster feature names (a save against a trait) stays a model-picked difficulty tier. Derive it from the SRD stat block.

Spec: specs/120-monster-feature-dc
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A save against a monster feature uses the DC its SRD record states, with an engine test
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope added by spec 084 (TASK-0128) OQ-2: stat-block escape DCs (21 of 38 SRD grapple escape DCs differ from 8 + STR mod + proficiency); the engine uses the formula until this card lands.

Claimed 2026-11-15 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0224, branch task-0224-monster-dc, cut from origin/main b82168ad. Spec number 120 claimed with a stub.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5

AC #1 proven on the branch: packages/dnd5e-engine/test/commands/feature-dc.test.ts (golden dice), seed-stats.test.ts (all 331 SRD records), gate-intents.test.ts replays (DM mechanics save, /contest escape). Gates before PR: ci:check green, wiki plan empty, freshness OK 66/66, boundaries 28/28. Review item: dnd5e-engine.md body 7997 -> 8121 chars, size_budget_exempt added.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Engine source, planner call sites and engine tests (FR-001–FR-015, FR-017, FR-018; AC #1): 9/9 · Stats builder, gate replay and contracts (FR-016, FR-019, FR-020; AC #1): 5/5 · Wiki: 7/7). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->
