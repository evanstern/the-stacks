---
id: TASK-0344
title: >-
  Revisit: web node --test failed 1 of 341 once on the TASK-0337 branch, name
  not captured
status: To Do
assignee: []
created_date: '2026-11-14T06:00:00Z'
labels:
  - flake
  - ci
dependencies: []
priority: low
ordinal: 328000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
During TASK-0337 phase 3 (2026-11-14 about 05:28 UTC), one REQUIRE_DATABASE=1 pnpm ci:check run failed in @the-stacks/web#test: node --test reported pass 340, fail 1 of 341. The agent captured only tail -30, so the test name and error are lost. The same tree passed the next ci:check. The final branch tree then passed pnpm test 3x in a row (341 node + 176 vitest) and node --test 20x in a row. A sibling session's ci:check (TASK-0335) ran on the same machine at about the same time, so load is a plausible cause. The only timing-sensitive web test found is test/debug/poller.test.mjs (fake setTimeout).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 When any web node --test failure recurs, the test name and error are recorded on this card
- [ ] #2 The cause is fixed, or ruled a known flake with a named test
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
