---
id: TASK-6
title: Rebuild 009-library-surface-env course on current chrome
status: Done
assignee:
  - '@claude'
created_date: '2026-07-10 18:26'
updated_date: '2026-07-10 22:15'
labels:
  - courses
dependencies: []
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
docs/courses/009-library-surface-env fails the praxis codebase-to-course gate (v1 chrome). Rebuild with the current /spec-cycle-course chrome so it passes the course gate natively.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Same playbook as TASK-4/5: chrome v2 from plugin references, per-module inline-contract rewrite where the validator flags blocks, build, course gate. This PR also closes TASK-7: removing 009 from LEGACY empties the set — every course enforced.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rebuilt on chrome v2: 009 was already mostly inline-authored (3a0501b), so only 3 blocks needed work — module 04's error-handler excerpt closed with an honest elision + real closer; module 02's Promise.all rebalanced the same way and its orphan inline test panel converted to a full block (9 paired notes on the generation-predicate contract test); module 03's orphan loader panel converted (9 notes). Plus a latent assembly trap fixed: 8 display-only transcript code-line spans in module 04's layer demo polluted the assembled index.html's block chunking — class dropped (pre newlines carry the layout). Course gate: 'course ok: 6 module(s)'.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
docs/courses/009-library-surface-env rebuilt on chrome v2: three block repairs (elision-line rebalances in modules 02/04, two orphan panels converted to full blocks), plus a latent cross-module assembly trap fixed (display-only transcript spans polluting index.html chunking). Course gate: 'course ok: 6 module(s)'. Merged via PR #11, released as v0.1.3.
<!-- SECTION:FINAL_SUMMARY:END -->
