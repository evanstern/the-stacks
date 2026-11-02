---
id: TASK-0053
title: 'The Table: multi-human demo with an AI DM and with an assisted human DM'
status: To Do
assignee: []
created_date: '2026-10-25 20:00'
updated_date: '2026-11-02 05:05'
labels:
  - multiplayer
  - acceptance
  - revisit
dependencies:
  - TASK-0049
  - TASK-0050
  - TASK-0051
  - TASK-0052
  - TASK-0176
  - TASK-0177
priority: medium
ordinal: 43000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the M3 milestone demo. Several humans play one scene twice: once with the AI DM (policy auto) and once with a human DM in assisted mode (policy ask).

Why: decision-0014 (multiplayer follows solo) and decision-0015 (one pipeline, two ends of the autonomy dial). The second run proves the assisted table works on the same pipeline.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Three humans play a scene to its end with the AI DM under policy auto.
- [ ] #2 Three humans play a scene to its end with a human DM approving AI proposals under policy ask.
- [ ] #3 Both runs pass the playtest auditor from TASK-0048, or the demo record lists each failure and its resolution.
- [ ] #4 The demo record is committed under docs/.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Operator, 2026-10-28, in the M3 sweep chat, verbatim: "Spending Ceiling: Since we're essentially using my subscription to Claude through 9router, dollar-wise it's fuzzy. I'm pretty happy with doing as high as you'd like -- maybe cap it at $50 and if that causes any issues we can scale down. I'm not actually being charged $50 so it's okay." Operator, same reply, verbatim: "TASK-0053 -- same ceiling note as above". Read as: a $50 ceiling for the demo. The demo is still a human-review checkpoint before it runs, and its human-DM run waits on TASK-0168.

Orchestrator, 2026-10-28, demo readiness after TASK-0165 merged (7c18b8ff): the demo gate is met (Track A, TASK-0114, TASK-0116, TASK-0117, TASK-0134, TASK-0168 Done; the human-DM controls TASK-0159/0165/0167 merged). Gap: no shipped seed seats three humans. greyhollow-ford seats one (tamsin; odo and kestrel are companions); greyhollow-ford-duo seats two (tamsin, kestrel; odo a companion). AC #1 (three humans with the AI DM) needs a three-human seat map. Open for the operator: (a) card a small sweepable task for a three-human seed and run it before the demo; (b) run the duo seed and record AC #1 as bypassed (two players plus an AI companion), with run 2 as two players plus the human DM. The demo runs on hosted dev (vm-104), after TASK-0163 AC #4 (the two-account alpha run); each vm-104 command needs the operator's go on the exact command.

Operator ruling 2026-10-28 in chat, answering "How should the demo get its three human players?": "Card a trio seed". Carded TASK-0176 (three-human seed); TASK-0053 now depends on it. Sweep order: TASK-0176, then the TASK-0163 alpha run, then the demo.

Operator ruling 2026-10-28 in chat, answering "Should I card F-1, seating a human DM from the web, in m-3 before the demo?": "Card it in m-3". Carded TASK-0177; TASK-0053 now also depends on it. Sweep order: TASK-0176, TASK-0177, the TASK-0163 alpha run, then the demo.

Operator ruling 2026-11-02, in the M3 sweep session, verbatim: "I want to skip TASK-0053 for now -- revisit it after M3 is done. The 2player run got most of what we need already". Read as: the demo no longer gates M3. Evidence it leans on: alpha run 3 (docs/playtests/2026-11-01-two-browser-alpha-run-3.md, TASK-0163 Done) played the duo seed to the scene goal on hosted dev with the AI DM. Trigger to revisit: the last other m-3 task reaches Done. Milestone cleared so M3 can close without it; the human-DM run (AC #2) and the trio seed (TASK-0176) stay ready.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
