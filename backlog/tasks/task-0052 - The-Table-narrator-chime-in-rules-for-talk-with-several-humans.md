---
id: TASK-0052
title: 'The Table: narrator chime-in rules for talk with several humans'
status: Done
assignee: []
created_date: '2026-10-25 20:00'
updated_date: '2026-10-30 15:19'
labels:
  - multiplayer
  - dm
  - ai
milestone: m-3
dependencies:
  - TASK-0048
references:
  - docs/design/architecture.md
priority: medium
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the narrator chimes into table talk at a sensible rate and on clear triggers when several humans talk. Talk still never changes state and never triggers a DM turn.

Why: decision-0016 lets the narrator answer talk (for example when mentioned). With one player that is rare; with several, an eager narrator floods the table and a silent one feels absent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The narrator replies to talk only on stated triggers, including a direct mention.
- [x] #2 A configurable rate limit bounds narrator talk per minute.
- [x] #3 Narrator talk never rolls dice and never proposes a state change; a test enforces this.
- [x] #4 Each chime-in names its trigger in the event, so the playtest auditor can check it.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Closed 2026-10-30 by decision-0027 §7 under the operator ruling on TASK-0180 OQ-15 (a): "I rule OQ-1 to OQ-16 all (a)." Built in PR #95 (5d2acf45). AC #1 stated triggers incl. direct mention: talk-triggers.ts codeTriggers. AC #2 per-minute rate limit: bypassed, replaced by the chain cap TALK_CHAIN_CAP=2 plus the 3s/10s quiet window (decision-0027). AC #3 no dice, no state change: FR-010, talk-turn.integration.test.ts. AC #4 trigger recorded: job result talk.triggers (debug jobs API).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Superseded by decision-0027 (D19) and TASK-0180 (PR #95). AC #2 rate limit replaced by the chain cap, per decision-0027 §7.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
