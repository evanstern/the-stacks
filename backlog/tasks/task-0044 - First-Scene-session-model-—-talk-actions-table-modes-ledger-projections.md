---
id: TASK-0044
title: 'First Scene: session model — talk, actions, table modes, ledger, projections'
status: To Do
assignee: []
created_date: '2026-10-25 19:59'
labels:
  - first-scene
  - session
milestone: m-2
dependencies:
  - TASK-0042
references:
  - docs/design/architecture.md
priority: high
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the session plane's play vocabulary. Typed, versioned event types and the projections built from them: talk versus action, the action lifecycle, table modes, party, encounter, secret trackers and the roll ledger.

Why: the session event log is the only source of truth; scene, party, encounter and journal are projections (decision-0017 layer 1). Talk never changes state; only a committed action reaches the DM pipeline (decision-0016). The ledger makes every number auditable (decision-0021 ideas 2 and 3).

The event log itself (M0) does not change. This card adds event types and projection code over it. Engine events from TASK-0042 are the mechanical payloads.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Zod-typed, versioned event types exist for talk, action declared, action commented, action committed and action resolved.
- [ ] #2 Talk events never change any projection except the transcript.
- [ ] #3 Table-mode events switch a session between free mode and turn mode, and turn mode records the active player.
- [ ] #4 Projections build scene, party, encounter and journal state from the log alone.
- [ ] #5 Secret trackers (named clocks) live in DM-only events, and a test proves player projections never include them.
- [ ] #6 Every roll event records its reason, and every state-change event records before and after values.
- [ ] #7 A test replays the log from seq 0 and rebuilds identical projections.
- [ ] #8 Projections skip unknown event types without failing.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
