---
id: TASK-0359
title: >-
  INF-9 Enforce praxisflux gates as required GitHub checks (multi-harness
  readiness)
status: In Progress
assignee: []
created_date: '2026-11-26T20:34:57Z'
updated_date: '2026-11-26T20:37:15Z'
labels:
  - ops
  - ci
dependencies: []
priority: high
ordinal: 343000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Run spec-bridge (requireDispatchRecord), wiki-freshness, tiers --check and a spec-scope guard as CI jobs on PRs to main, and mark them required. Paperclip INF-9 (parent INF-8).

Spec: specs/122-praxisflux-required-checks
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CI jobs gate-spec-bridge, gate-wiki-freshness, gate-tiers, gate-scope run on PRs to main
- [ ] #2 A non-compliant PR is blocked and a compliant PR passes (both linked on card)
- [ ] #3 Checks are required in branch protection or a question card names them for Evan
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
