---
id: TASK-0157
title: Gate refuses bursty concurrent talk with CONFLICT after its retry bound
status: To Do
assignee: []
created_date: '2026-10-27 09:46'
labels:
  - gate
  - ws
  - session
milestone: m-3
dependencies: []
ordinal: 144000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: several humans talking at once never see a CONFLICT refusal for a talk request, or the client retries it transparently. Evidence: TASK-0099 Phase 1 (spec 043, commit 92e0a14) moved the WS integration tests and the load bench from the uncatalogued append to gate talk requests. With 3 concurrent senders (T012), 5 back-to-back sends from one socket (T021), and concurrency-smoke, the gate (MAX_ATTEMPTS = 3) refused some sends with CONFLICT. The tests now await each echo and resend on CONFLICT, as a client would. The old uncatalogued path never hit this. Why it matters for M3: the demo seats three humans at one table (C7). Options: widen or back off the gate's optimistic retry for direct-route kinds; or have the web client resend a talk on CONFLICT. Before the M3 demo (TASK-0053).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A test with at least 3 concurrent human talk senders shows no CONFLICT reaches the client, or the play-route client resends and the talk lands once
- [ ] #2 The chosen retry policy is documented in the gate contract
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
