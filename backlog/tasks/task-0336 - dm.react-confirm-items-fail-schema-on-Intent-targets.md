---
id: TASK-0336
title: dm.react confirm items fail schema on Intent targets
status: To Do
assignee: []
created_date: '2026-11-14T02:18:00Z'
updated_date: '2026-11-14T02:29:00Z'
labels:
  - playtest
  - ws:narration
  - bug
milestone: m-10
dependencies: []
references:
  - docs/playtests/2026-11-13-r1-spine-test-drive.md
priority: high
ordinal: 320000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in the 2026-11-13 R1 spine test drive (session 0106e608, job fc1f6c10, seq 36). On 'I search the ferry house' (free mode), dm.react-v4 returned outcome 'confirm' with body {kind:'search', targets:['ferry-house']} on attempt 1, then targets [{id:'ferry-house'}] on attempt 2. Both fail IntentBodySchema (targets need a 'kind' discriminator: actor|entity|item|zone|square|point). The job stopped at narrate: invalid-output and the player got no reply. Every confirm item with a target hits this, so the TASK-0199 confirm row is unusable for targeted deeds on the hosted model. The schema-repair re-ask does not name the missing field clearly enough.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The dm.react prompt shows the Intent target shape (kind plus id) with a worked example, and a scripted test replays both failing outputs from this job.
- [ ] #2 A confirm item whose target lacks only 'kind' is repaired in code when the id names exactly one known zone, actor or item, with a test.
- [ ] #3 A failed react turn tells the player the DM could not answer, rather than staying silent.
- [ ] #4 The scripted CI playtest scenario includes a free-mode targeted deed through dm.react confirm, so a confirm-schema regression fails CI.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
