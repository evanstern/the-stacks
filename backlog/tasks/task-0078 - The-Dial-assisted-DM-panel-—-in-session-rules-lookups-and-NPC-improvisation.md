---
id: TASK-0078
title: 'The Dial: assisted-DM panel — in-session rules lookups and NPC improvisation'
status: To Do
assignee: []
created_date: '2026-10-25 20:18'
updated_date: '2026-11-07 05:16'
labels:
  - dial
  - dm
  - ui
  - 'ws:dm-console'
milestone: m-12
dependencies:
  - TASK-0076
references:
  - docs/design/architecture.md
priority: medium
ordinal: 68000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
REWRITTEN by replan-2026-11: Proposal rows inbox (Accept / Edit inline / Reject / Narrate my own). Design round at CP-8.

Source: docs/design/replan-2026-11/board-rework-map.md. Acceptance criteria are refined at the milestone's planning (P-16).

--- Previous description (superseded where it conflicts) ---
Outcome: a human DM asks rules questions and has any codex NPC speak, in the session, with answers and lines arriving as DM-only proposals.

Why: operator goal 4. decision-0004 deferred in-session rules lookups as events to the assisted table; this card makes them events. NPC lines are proposals the DM sends, edits or discards (decision-0015).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The DM asks a rules question in the session, and the cited answer appears as a DM-only event.
- [ ] #2 A decision record states how in-session lookups relate to POST /library/ask (decision-0004).
- [ ] #3 The DM asks any codex NPC to speak, and the line arrives as a DM-only proposal.
- [ ] #4 The DM sends, edits or discards each proposed line.
- [ ] #5 Citations in in-session answers are verified as in M1.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rewritten by replan-2026-11. Proposal rows inbox (Accept / Edit inline / Reject / Narrate my own). Design round at CP-8.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
