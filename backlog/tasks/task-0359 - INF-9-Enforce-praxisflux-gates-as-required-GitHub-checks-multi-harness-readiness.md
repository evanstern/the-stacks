---
id: TASK-0359
title: >-
  INF-9 Enforce praxisflux gates as required GitHub checks (multi-harness
  readiness)
status: In Progress
assignee: []
created_date: '2026-11-26T20:34:57Z'
updated_date: '2026-11-27T03:49:42Z'
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
- [x] #1 CI jobs gate-spec-bridge, gate-wiki-freshness, gate-tiers, gate-scope run on PRs to main
- [x] #2 A non-compliant PR is blocked and a compliant PR passes (both linked on card)
- [ ] #3 Checks are required in branch protection or a question card names them for Evan
- [ ] #4 Spec phase: Gates and scope script (FR-001–FR-005, FR-008)
- [ ] #5 Spec phase: Enforcement and proof (FR-006, FR-007)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(Implemented by the Ops Engineer agent itself at sonnet; pinned= is the model on the Paperclip agent config, served= is the model in the Paperclip run receipt, per decision-0031.)

Proof (INF-16): negative PR https://github.com/evanstern/the-stacks/pull/200 — gate-scope FAILED (apps/web/ path outside spec scope), other gates green, closed unmerged. Positive PR https://github.com/evanstern/the-stacks/pull/201 — gate-spec-bridge, gate-wiki-freshness, gate-tiers, gate-scope all PASSED, closed unmerged. Gates PR #198 merged (2d92bdd4). Branch protection on main: NOT enabled as of 2026-11-27 (GitHub reports main protected=false) — the four checks are not yet required.

spec-bridge sync: Gates and scope script (FR-001–FR-005, FR-008): 0/4 · Enforcement and proof (FR-006, FR-007): 0/2
<!-- SECTION:NOTES:END -->
