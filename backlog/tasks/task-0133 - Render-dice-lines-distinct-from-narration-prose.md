---
id: TASK-0133
title: Render dice lines before and distinct from narration prose
status: To Do
assignee: []
created_date: '2026-10-27 02:45'
updated_date: '2026-10-28 19:14'
labels:
  - web
milestone: m-3
dependencies: []
references:
  - docs/design/m2-demo.md
priority: low
ordinal: 120000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: roll lines in a narration render before the prose they caused, in a style visually distinct from the prose (code-block style).

Evidence: M2 demo record (docs/design/m2-demo.md, operator finding 6; docs/design/m2-demo/scene-end.png). Dice lines rendered inline in the prose. Operator sign-off 2026-10-27: card in m-3.

Widened 2026-10-28 (two-browser alpha playtest, item 1; operator approval): the roll line is appended after the narration (apps/server/src/dm/facts.ts renderRollLine and its caller), so it reads like an afterthought. The player cannot tell whether the prose is the roll's result. The roll happens first, so it shows first.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Dice lines in a narration render in a distinct style in light and dark mode
- [ ] #2 Prose around the dice lines renders unchanged
- [ ] #3 Each roll line renders above the narration prose its roll produced, with a test
<!-- AC:END -->



## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
