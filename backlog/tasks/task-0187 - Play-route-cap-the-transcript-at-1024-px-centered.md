---
id: TASK-0187
title: 'Play route: cap the transcript at 1024 px, centered'
status: To Do
assignee: []
created_date: '2026-11-02 02:39'
labels:
  - web
  - ux
  - playtest
milestone: m-3
dependencies: []
priority: medium
ordinal: 174000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: on /play/<id>, the transcript column is at most 1024 px wide (Tailwind max-w-5xl) and centered; the scroll area and its scrollbar stay full width; the composer and header are unchanged.

Why: alpha run 3 (2026-11-01), finding 1. On a wide window the narration runs edge to edge and is hard to read. The operator mocked the fix in devtools: constrain and center the text column.

Where: apps/web/app/play/table-view.tsx, the transcript scroll container (div.min-h-0.flex-1.overflow-y-auto.p-3). Wrap its contents in a mx-auto max-w-5xl block.

References: docs/playtests (run 3 log, lands at wrap).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The transcript content is at most 1024 px wide and centered on a wide window
- [ ] #2 The scroll area and its scrollbar still span the full width; the composer and header are unchanged
- [ ] #3 At 390 px the transcript still fills the width with no horizontal scroll
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
