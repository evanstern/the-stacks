---
id: TASK-7
title: Empty the course-gate legacy baseline
status: In Progress
assignee:
  - '@claude'
created_date: '2026-07-10 18:27'
updated_date: '2026-07-10 22:10'
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
