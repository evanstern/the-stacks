---
id: TASK-5
title: Rebuild 008-ingestion-service course on current chrome
status: In Progress
assignee:
  - '@claude'
created_date: '2026-07-10 18:26'
updated_date: '2026-07-10 21:54'
labels:
  - courses
dependencies: []
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
docs/courses/008-ingestion-service fails the praxis codebase-to-course gate (v1 chrome). Rebuild with the current /spec-cycle-course chrome so it passes the course gate natively.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Same playbook as TASK-4: copy chrome v2 from plugin references, re-author every translation block to the inline one-.tl-per-.code-line contract (verbatim snippets, skilled-dev register, briefs as spec), fix any v1 structural issues (orphan translation-code panels), validate per module, build, pass the course gate, remove 008-ingestion-service from the LEGACY baseline, bump version (scripts/ touched), PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rebuilt on chrome v2 (plugin references): all 6 modules' translation blocks re-authored to the inline contract — 25 validator issues cleared, incl. mid-structure cuts in admitSource/commitGeneration/intake-route rebalanced with real closers + sanctioned elision lines, one orphan panel in module 03 converted to a full block, and a wrong line-range label corrected (routes.ts:43-81). Snippets verbatim-verified (spot-check: registry.ts 8/8). Course gate: 'course ok: 6 module(s)'. 008 removed from LEGACY (now enforced). Version 0.1.1→0.1.2 (scripts/ touched).
<!-- SECTION:NOTES:END -->
