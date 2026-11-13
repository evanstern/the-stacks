---
id: TASK-0333
title: Instrument ai-actor-parity companion attempt test (CI-only flake)
status: To Do
assignee: []
created_date: '2026-11-13T16:05:00Z'
labels:
  - test
  - flaky
  - ws:intent
milestone: m-10
dependencies: []
ordinal: 317000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The test 'AI actor parity: companion source (database) > attempt: needs_ruling, then the AI seat answers it in the same job' (apps/server/test/dm/ai-actor-parity.integration.test.ts:208) failed twice on CI for PR #177 (run 43455978886, head 4b77efd7). It received [] carriers where it expected declared, needs_ruling, settled. Main has never failed it in 100 runs. It passed 19/19 locally, including under CPU load. TASK-0247 changed nothing on the companion path. Likely mechanism (unproven): runCompanionJob is called directly while the live gate listener and enqueuer run on the same DB, and the companion play is skipped. odoTurn passes log: () => {}, so the cause is invisible. Trigger: the next CI failure of this test.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 odoTurn captures the companion job's log lines (dm.companion.refused, play statuses) and prints them when the carrier assertion fails.
- [ ] #2 The root cause is recorded on this card, or the test is made independent of the live listener timing, with a test.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
