---
id: TASK-0333
title: Instrument ai-actor-parity companion attempt test (CI-only flake)
status: To Do
assignee: []
created_date: '2026-11-13T16:05:00Z'
updated_date: '2026-11-13T17:06:00Z'
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AC #1 delivered on TASK-0247's branch (PR #177, f50f1628/41f191dd): the assertion message carries logs, plays and gateway purposes. Root cause found: the test read rows before the gate listener's enqueued commit turn ran; fixed in the test (41f191dd). Still open: why TASK-0247's branch hit the window often (4 of 5 CI runs) while main never did. Trigger: any new failure of this test after #177 merges.

Answer to the open question: main CI on bf44d82f (a card commit, before #177 merged, so without the test fix) failed the same test with the same [] carriers. The race was never branch-specific; main hit it once the window was open. Fix 41f191dd is on main via merge 2a1d5189. Remaining: AC #2 (record root cause / decouple from listener timing) is met by 41f191dd; close after main CI is green on 2a1d5189.
<!-- SECTION:NOTES:END -->
