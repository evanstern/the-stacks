---
id: TASK-0315
title: 'Build: one composer, one Send, Enter commits in combat — web (spec 066)'
status: In Progress
assignee: []
created_date: '2026-11-12T03:01:00Z'
updated_date: '2026-11-12T05:28:00Z'
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

Spec: specs/105-one-composer-web
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From TASK-0199 phase 4: C-6, C-7 and C-9 contract blocks landed in TASK-0199 (7c0d1613); build against them. Confirm the ui-surfaces.md C-7 wording (the speaker chip drops 'The party') when building the composer. Replace the minimal ponytail detailsOf cases in apps/web/app/play/proposals.ts with real rendering, and document it in play-route.

Claimed 2026-11-12 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0315, branch task-0315-one-composer, cut from origin/main 468069b8. Spec number 105 claimed with a stub.

Spec marker fixed: this card links spec 105 only. Spec 066 stays TASK-0199's (Done); adding web tasks to it would put TASK-0199 ahead of its artifacts. Spec 105 builds on spec 066's design (plan D4) and the C-6/C-7/C-9 contract blocks merged in PR #170.
<!-- SECTION:NOTES:END -->
