---
id: TASK-0336
title: dm.react confirm items fail schema on Intent targets
status: In Progress
assignee: []
created_date: '2026-11-14T02:18:00Z'
updated_date: '2026-11-14T08:18:00Z'
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

Spec: specs/114-react-confirm-targets
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The dm.react prompt shows the Intent target shape (kind plus id) with a worked example, and a scripted test replays both failing outputs from this job.
- [x] #2 A confirm item whose target lacks only 'kind' is repaired in code when the id names exactly one known zone, actor or item, with a test.
- [x] #3 A failed react turn tells the player the DM could not answer, rather than staying silent.
- [x] #4 The scripted CI playtest scenario includes a free-mode targeted deed through dm.react confirm, so a confirm-schema regression fails CI.
- [x] #5 The scripted CI scenario deeds marked intent take the direct-Intent path (driver passes Move.intent through), with a test proving no interpret call for them (spec 114 OQ-4, ruling (a))
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-14 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0336, branch task-0336-react-confirm-targets, cut from origin/main 8b958a98. Spec number 114 claimed with a stub.

Spec 114 authored (323b0b43): dm.react-v5 target shape + Targets list; normalizeReact repair (zone/actor only, unique id); failed talk turn appends public ai:dm ooc notice; parseAgainst names missing kind; CI confirm deed. OQ-2 (hidden zones out of Targets) and OQ-3 (item/entity repair waits for a list) defaults kept. OQ-1 and OQ-4 to parent for ruling.
Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=cc/claude-opus-5-5

Parent rulings 2026-11-14: OQ-4 (a), fold the driver.ts intent pass-through and greyhollow-ford-deeds.json reorder into phase 3 (new AC); correction posted on PR #181. OQ-1 carded as TASK-0345. OQ-2, OQ-3 defaults stand.

Phase 1 done (612f4dc1, 2b973e7a): dm.react-v5, normalizeReact, replay of both fc1f6c10 bodies; ci:check green, latency PASS, ai-round 865 ms.
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5

Phase 2 done (3c45733a): public ai:dm ooc read-failure notice on failed talk turns; parseAgainst names missing kind; ci:check green, latency PASS, ai-round 850 ms.
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5

Phase 3 done (414c2e69): confirm-search CI deed (bare-id target, exercises repair); driver passes intent+confirm (OQ-4 (a)), test proves intent turns make only dm.narrate; negative proof: normalizeReact stubbed -> playtest integration fails. write-boundary test now allows playtest/harness.ts (scripted seat) to build action.accept; flag for PR review.
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5

Phase 4 wiki done (ff16f811): 6 prose (incl. proposal-gate write boundary), 7 re-pin.
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5
<!-- SECTION:NOTES:END -->
