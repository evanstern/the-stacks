---
id: TASK-0195
title: Per-runbook playtest scenarios
status: Done
assignee: []
created_date: '2026-11-02 05:22'
updated_date: '2026-11-02 16:23'
labels:
  - playtest
  - tooling
milestone: m-3
dependencies: []
priority: high
ordinal: 182000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: each M3 runbook ships a playtest scenario aimed at the features it built, so the post-sweep playtest exercises those features without replaying the same opening. Why: operator ruling 2026-11-02 (M3 planning) — a playtest runs after every sweep, and the operator finds replaying the same greyhollow-ford scenario tiresome. Shape: a seed under apps/server/seeds/ or a setup step, plus a short checklist the playtest-run skill (.claude/skills/playtest-run/SKILL.md) consumes. DM_FAKE_SCRIPT (apps/server/src/dm/script/env.ts) may script the DM to set up a situation directly (start in combat, place a companion beat) to keep runs short; paid-model turns still run where the feature under test is model behavior. First consumer: M3 runbook A (docs/design/m3-runbook-a-run3-fixes.md), whose last step authors its own scenario.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A documented convention says where a runbook's scenario lives (seed file or setup step) and how playtest-run loads it
- [x] #2 playtest-run accepts a per-runbook checklist and derives its tracked checklist from it
- [x] #3 Runbook A ships a combat-heavy scenario with a companion moment, used for its post-sweep playtest
- [x] #4 The runbook template or sweep doctrine says each runbook ends with authoring its scenario
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-02 by M3 runbook A (docs/design/m3-runbook-a-run3-fixes.md). Worktree .worktrees/task-0195, branch task-0195-runbook-a-scenario, cut from origin/main 7e4a6219. No spec dir: signed escape line covers this task. Lane Last, after A1-A5 merged (#99-#107). Escape E3: card ACs drive. Rides: spec 072 T008 tick (done in 883a75a8; missed during the T006 hold) so TASK-0164 can close.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (TASK-0195 scenario, 54b63816 df0d4460)
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Runbooks now end with a playtest scenario (seed, optional DM_FAKE_SCRIPT setup, checklist) that playtest-run loads. Runbook A's scenario: seed greyhollow-ford-reed-camp, script runbook-a-reed-camp, 9-row checklist; local scripted rehearsal ran end to end. Merged in PR #108.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 All tests and checks run green
- [x] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
