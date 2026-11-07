---
id: TASK-0129
title: 'Design round: Ask the DM, out-of-character questions get a read-only answer'
status: To Do
assignee: []
created_date: '2026-10-27 02:32'
updated_date: '2026-11-07 05:17'
labels:
  - dm
  - design-round
  - table
  - replan-2026-11
milestone: m-3
dependencies: []
priority: high
ordinal: 116000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a player can ask the DM an out-of-character question (can I reach the ledge, what does my character know, what would this roll) and get an answer that changes no state. Why: SRD 5.2.1 treats this exchange as routine (improvised actions, p.10; Passive Perception, p.186); today talk never reaches the DM (decision-0016) and clarify runs only from DM to player. Operator ruling 2026-10-26: needed sooner rather than later; run it as a design round alongside the M3 table work. Use pdlc:design-rounds: options for the channel (talk subtype, proposal kind, or a DM aside), how answers stay read-only, how they respect DM-only secrets, and cost and latency. Ends in a decision record amending decision-0016 and a spec. UI: no modals; use slide-out panels or autocomplete dropdowns. Grounding: decision-0022 (D14) and docs/research/Resolution-and-Outcome/Analysis-Dice-Versus-Player.md (TASK-0115, lands with TASK-0115's PR).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A design-rounds decision record names the chosen channel and amends decision-0016
- [ ] #2 A spec for the chosen channel exists, with a test plan proving an answer writes no game state and leaks no DM-only fact
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Closed (close-superseded) by replan-2026-11: TASK-0281 channels (`@dm`, `((`).
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
