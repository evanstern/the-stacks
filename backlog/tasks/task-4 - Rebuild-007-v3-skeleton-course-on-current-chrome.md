---
id: TASK-4
title: Rebuild 007-v3-skeleton course on current chrome
status: Done
assignee:
  - '@claude'
created_date: '2026-07-10 18:26'
updated_date: '2026-07-10 21:45'
labels:
  - courses
dependencies: []
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
docs/courses/007-v3-skeleton fails the praxis codebase-to-course gate (v1 chrome: no version stamp, translation-block violations). Rebuild it with the current /spec-cycle-course chrome so it passes 'node scripts/check-courses.mjs' without the legacy baseline.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Rebuild docs/courses/007-v3-skeleton on the current codebase-to-course chrome (plugin references: inline visualizer, exactly one .tl per .code-line, chrome version stamps in styles.css/main.js). Reuse the existing briefs as the module spec, regenerate modules to the new translation-block contract, verify with node scripts/check-courses.mjs, remove 007-v3-skeleton from the LEGACY baseline in the same PR so CI enforces the rebuilt course.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rebuilt on chrome v2: copied styles.css/main.js/build.sh/validate.mjs from the plugin references; all 6 modules' translation blocks re-authored to the inline contract (one .tl per .code-line, in order; excerpts trimmed from within with // … elision lines; snippets verified verbatim against source — spot-check: claimNext 8/8 lines match packages/db/src/queue.ts). Structural fix: modules 04 and 06 had bare v1 translation-code panels outside any translation-block, polluting neighbor block counts — converted to full v2 blocks. fetch('http literal in module 01 HTML-escaped for the self-containment scanner. Course gate: 'course ok: 6 module(s)'. 007 removed from the LEGACY baseline in scripts/check-courses.mjs (now enforced). Version 0.1.0→0.1.1 (scripts/ touched).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
docs/courses/007-v3-skeleton rebuilt on chrome v2 (inline translation engine): chrome copied from the plugin references with version stamps; all 6 modules' translation blocks re-authored to one-.tl-per-.code-line in the skilled-developer register, snippets verbatim-verified; v1 structural bugs fixed (orphan translation-code panels in modules 04/06); fetch('http escaped for self-containment. Course gate passes as an ENFORCED course — 007 removed from the LEGACY baseline in scripts/check-courses.mjs. Merged via PR #9 (all CI green), released as v0.1.1.
<!-- SECTION:FINAL_SUMMARY:END -->
