---
id: TASK-0053
title: 'The Table: multi-human demo with an AI DM and with an assisted human DM'
status: To Do
assignee: []
created_date: '2026-10-25 20:00'
updated_date: '2026-10-28 14:44'
labels:
  - multiplayer
  - acceptance
milestone: m-3
dependencies:
  - TASK-0049
  - TASK-0050
  - TASK-0051
  - TASK-0052
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
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
