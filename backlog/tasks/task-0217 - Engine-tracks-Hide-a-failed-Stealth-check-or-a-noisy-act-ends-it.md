---
id: TASK-0217
title: Engine tracks Hide; a failed Stealth check or a noisy act ends it
status: To Do
assignee: []
created_date: '2026-11-03 02:46'
labels:
  - dm
  - engine
  - rules
milestone: m-3
dependencies:
  - TASK-0205
ordinal: 203000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: hidden state is an engine fact, not goal-note prose. SRD 5.2.1's Hide action grants the Invisible condition; a failed Stealth check, a noisy act, or another SRD-listed trigger ends it. The Director and narrate read the tracked state.

Why: spec 077 (TASK-0205) OQ-4. Runbook A playtest run 1 seq 114-122: after a failed Stealth check the Director kept 'hidden goblins tracking her' framing, and the operator said 'the stealth check failed so I had assumed we were out of stealth'. Spec 077 stops undeclared Stealth checks; it does not track hidden state.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The engine records hidden state from a Hide (Stealth) success and ends it on a failed check or SRD-listed trigger, with engine tests
- [ ] #2 The Director and narrate prompts read the tracked hidden state, never infer it from earlier prose, with a prompt test
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
