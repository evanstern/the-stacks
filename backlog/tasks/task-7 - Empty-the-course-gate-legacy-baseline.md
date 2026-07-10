---
id: TASK-7
title: Empty the course-gate legacy baseline
status: Done
assignee:
  - '@claude'
created_date: '2026-07-10 18:27'
updated_date: '2026-07-10 22:15'
labels: []
dependencies:
  - TASK-4
  - TASK-5
  - TASK-6
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Once the 007/008/009 courses are rebuilt on current chrome, remove their entries from the LEGACY set in scripts/check-courses.mjs so every course must pass the praxis course gate with no exceptions.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
LEGACY set emptied in scripts/check-courses.mjs — all three courses (007/008/009) now pass the course gate unconditionally; comment pins the set as permanently empty.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
LEGACY baseline in scripts/check-courses.mjs emptied and pinned permanently empty — all three courses (007 PR#9, 008 PR#10, 009 PR#11) pass the course gate unconditionally; every future course is enforced from day one. Merged via PR #11, released as v0.1.3.
<!-- SECTION:FINAL_SUMMARY:END -->
