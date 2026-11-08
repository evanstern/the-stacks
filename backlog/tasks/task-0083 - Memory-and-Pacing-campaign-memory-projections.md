---
id: TASK-0083
title: 'Memory and Pacing: campaign memory projections'
status: To Do
assignee: []
created_date: '2026-10-25 20:18'
updated_date: '2026-11-07 05:17'
labels:
  - memory
  - dm
  - session
  - 'ws:memory'
milestone: m-16
dependencies:
  - TASK-0082
references:
  - docs/design/architecture.md
priority: medium
ordinal: 73000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
REWRITTEN by replan-2026-11: Campaign summaries as projections inside a token budget, over TASK-0280 snapshots.

Source: docs/design/replan-2026-11/board-rework-map.md. Acceptance criteria are refined at the milestone's planning (P-16).

--- Previous description (superseded where it conflicts) ---
Outcome: summaries of sessions, scenes and threads are projections of the event log, kept current by chronicle, and assemble loads them within a token budget.

Why: the log is truth and chat memory is not (decision-0021 idea 3). Long campaigns outgrow any context window, so memory must be a derived, rebuildable view of the log.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Chronicle writes scene and session summaries as proposals, and the gate applies them.
- [ ] #2 Summaries cite the event ranges they summarize.
- [ ] #3 Rebuilding summaries from the log produces equivalent content, and a test checks key facts.
- [ ] #4 Assemble loads memory within a stated token budget.
- [ ] #5 Player-visible summaries never contain DM-only facts.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rewritten by replan-2026-11. Campaign summaries as projections inside a token budget, over TASK-0280 snapshots.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
