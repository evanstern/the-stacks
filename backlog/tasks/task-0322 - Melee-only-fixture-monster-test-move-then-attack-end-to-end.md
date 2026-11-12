---
id: TASK-0322
title: 'Melee-only fixture monster: test move-then-attack end to end'
status: To Do
assignee: []
created_date: '2026-11-12T19:30:00Z'
labels:
  - ws:intent
  - test
milestone: m-10
dependencies:
  - TASK-0299
ordinal: 306000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-0299 (PR #173). monsterStages() plans 'move then attack' when no attack reaches the target, but every seed monster has a ranged attack, so the path is unit-tested only (monster-policy.test.ts). The 4v4 bench never exercises a move either.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A fixture monster with melee attacks only plans move then attack in an integration test, and both stages settle through the gate.
- [ ] #2 The 4v4 bench fixture includes one monster that must move before it attacks.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
