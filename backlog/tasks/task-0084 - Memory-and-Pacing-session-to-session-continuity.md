---
id: TASK-0084
title: 'Memory and Pacing: session-to-session continuity'
status: To Do
assignee: []
created_date: '2026-10-25 20:19'
updated_date: '2026-11-07 05:17'
labels:
  - memory
  - dm
  - 'ws:memory'
milestone: m-16
dependencies:
  - TASK-0083
priority: medium
ordinal: 74000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
REWRITTEN by replan-2026-11: Session continuity: recap, carry-over, chronicle write-back drafts; absorbs 0109.

Source: docs/design/replan-2026-11/board-rework-map.md. Acceptance criteria are refined at the milestone's planning (P-16).

--- Previous description (superseded where it conflicts) ---
Outcome: a new session opens with an accurate recap, and open threads, clocks and NPC attitudes carry over.

Why: continuity is what turns scenes into a campaign. The recap must come from the log, so the audit node can check it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A new session opens with a recap generated from the previous session's memory.
- [ ] #2 Audit checks every recap fact against the cited event ranges.
- [ ] #3 Secret trackers and open threads carry over between sessions.
- [ ] #4 Players see only player-visible recap content.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rewritten by replan-2026-11. Session continuity: recap, carry-over, chronicle write-back drafts; absorbs 0109.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
