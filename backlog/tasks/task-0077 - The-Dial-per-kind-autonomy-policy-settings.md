---
id: TASK-0077
title: 'The Dial: per-kind autonomy policy settings'
status: To Do
assignee: []
created_date: '2026-10-25 20:18'
updated_date: '2026-11-07 05:16'
labels:
  - dial
  - gate
  - ui
  - 'ws:dm-console'
milestone: m-12
dependencies:
  - TASK-0076
references:
  - docs/design/architecture.md
priority: medium
ordinal: 67000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the DM sets the autonomy dial in the app: a policy (auto, ask or suggest) per proposal kind, per campaign, with named presets for an AI-run table and an assisted table.

Why: decision-0015 makes the policy table the autonomy dial. M2 and M3 set policies in config and fixtures; V1 needs the DM to set them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The DM views and sets the policy for each proposal kind in a campaign.
- [ ] #2 Two presets exist: AI runs the game (all auto) and AI assists (state-changing kinds ask).
- [ ] #3 A policy change is a session event and takes effect from the next proposal.
- [ ] #4 Players see which mode the table runs in, but not the per-kind settings.
- [ ] #5 The UI uses slide-out panels and autocomplete dropdowns only, never modals.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
