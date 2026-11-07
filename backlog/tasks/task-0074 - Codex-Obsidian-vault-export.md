---
id: TASK-0074
title: 'Maps and the Table View: Obsidian vault export of the codex'
status: To Do
assignee: []
created_date: '2026-10-25 20:18'
updated_date: '2026-11-07 05:16'
labels:
  - codex
  - export
  - 'ws:notebook'
milestone: m-17
dependencies:
  - TASK-0067
priority: medium
ordinal: 64000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the operator exports a campaign's codex as an Obsidian vault: one markdown file per entity with frontmatter, typed links as wiki links.

Why: decision-0013. It meets the appeal of Atlas VTT (Obsidian as the management surface) without integrating Atlas. Export is one-way; the codex stays the source of truth.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Export writes one markdown file per entity, with identity fields in YAML frontmatter.
- [ ] #2 Typed links become Obsidian wiki links, and the link type is kept in frontmatter.
- [ ] #3 Secrets in hooks export only when the operator opts in.
- [ ] #4 Re-exporting the same campaign version produces identical files.
- [ ] #5 The export opens in Obsidian with working links, recorded with a screenshot in the PR.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
