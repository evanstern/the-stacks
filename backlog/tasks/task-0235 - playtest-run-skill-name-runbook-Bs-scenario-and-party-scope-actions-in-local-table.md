---
id: TASK-0235
title: >-
  playtest-run skill: name runbook B's scenario, and party-scope actions in
  local-table
status: To Do
assignee: []
created_date: '2026-11-03 12:38'
labels:
  - playtest
  - tooling
milestone: m-3
dependencies: []
ordinal: 221000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From TASK-0234 (runbook B scenario). (1) .claude/skills/playtest-run/SKILL.md section 8 names only runbook A's scenario; add runbook B's seed, script and checklist (docs/playtests/scenarios/runbook-b-reed-camp.md). (2) local-table.mjs act declares only character scope; the Odo spell rows needed a party-scope action, so the rehearsal used a local copy. Add a scope option. Both edits are under .claude/, which implementers do not touch; the orchestrator or operator makes them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 SKILL.md section 8 names runbook B's seed, script and checklist
- [ ] #2 local-table.mjs act accepts a party scope, and the runbook B rehearsal runs with the shipped script
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
