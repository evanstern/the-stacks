---
id: TASK-0195
title: Per-runbook playtest scenarios
status: To Do
assignee: []
created_date: '2026-11-02 05:22'
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
- [ ] #1 A documented convention says where a runbook's scenario lives (seed file or setup step) and how playtest-run loads it
- [ ] #2 playtest-run accepts a per-runbook checklist and derives its tracked checklist from it
- [ ] #3 Runbook A ships a combat-heavy scenario with a companion moment, used for its post-sweep playtest
- [ ] #4 The runbook template or sweep doctrine says each runbook ends with authoring its scenario
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
