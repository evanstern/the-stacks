---
id: TASK-0097
title: 'Narrow screens: About and Settings links are unreachable'
status: To Do
assignee: []
created_date: '2026-10-26 02:58'
labels:
  - ui
dependencies: []
priority: medium
ordinal: 87000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: on narrow screens a user can reach About and Settings from the app shell.

Why: the sidebar footer that holds the About link (added by TASK-0043, PR #45) and the Settings link is hidden under the narrow: breakpoint, so neither link shows on narrow screens. /about carries the SRD 5.2.1 CC-BY-4.0 attribution, which every role must be able to reach. Raised in the M2 First Scene sweep; carded by operator ruling 2026-10-26. Outside M2 scope.

No modals: slide-out panels or autocomplete dropdowns only.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 On a narrow screen, the shell shows a link to About for every role.
- [ ] #2 On a narrow screen, the shell shows a link to Settings for an operator.
- [ ] #3 Neither link opens a modal.
- [ ] #4 A test or committed Brave screenshot at a narrow width proves both links are reachable.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
