---
id: TASK-0315
title: 'Build: one composer, one Send, Enter commits in combat — web (spec 066)'
status: To Do
assignee: []
created_date: '2026-11-12T03:01:00Z'
labels:
  - web
  - ws:table-ux
  - replan-2026-11
milestone: m-10
dependencies:
  - TASK-0199
ordinal: 299000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Split from TASK-0199 by the operator's C-AMD ruling of 2026-11-11 (spec 066 OQ-1). Spec 066 phase 4 (web) and the web share of phases 6 and 7: Send parses each line and sends one intent request (declared in free mode, confirmed in turn mode), the active player's Enter commits, the ring and Thinking visuals, the interrupt strip, the confirm row, the DM confirm editor, and removing the sign-off and comment UI. Draft-hold the PR until TASK-0199 merges. UI: no modals; Brave live check.

Spec: specs/066-one-chat-stream
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 In combat, no quiet ring runs; the active player's Enter commits the Intent, with a test.
- [ ] #2 The play route has one composer and one Send button, verified live in Brave.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
