---
id: TASK-0059
title: 'The Codex: codex browser UI'
status: To Do
assignee: []
created_date: '2026-10-25 20:16'
updated_date: '2026-11-07 05:16'
labels:
  - codex
  - ui
  - 'ws:notebook'
milestone: m-13
dependencies:
  - TASK-0057
priority: medium
ordinal: 49000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
REWRITTEN by replan-2026-11: Becomes the notebook shell: tree, entity page, `@` links, backlinks, search.

Source: docs/design/replan-2026-11/board-rework-map.md. Acceptance criteria are refined at the milestone's planning (P-16).

--- Previous description (superseded where it conflicts) ---
Outcome: the operator browses, searches, creates and edits campaign entities, and follows typed links, in the web app.

Why: operator goal 2 (campaign management). Forms come from the shared contracts (doc-0003 ruling 3). No modals: slide-out panels or autocomplete dropdowns only.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The operator lists a campaign's entities by type and searches them by name.
- [ ] #2 Entity forms render from the shared Zod contracts and show validation errors per field.
- [ ] #3 The operator follows a typed link from one entity to another.
- [ ] #4 The operator views an entity's version history.
- [ ] #5 The UI uses slide-out panels and autocomplete dropdowns only, never modals.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rewritten by replan-2026-11. Becomes the notebook shell: tree, entity page, `@` links, backlinks, search.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
