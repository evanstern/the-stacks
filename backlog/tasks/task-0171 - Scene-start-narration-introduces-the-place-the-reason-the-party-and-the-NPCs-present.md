---
id: TASK-0171
title: >-
  Scene-start narration introduces the place, the reason, the party and the NPCs
  present
status: In Progress
assignee: []
created_date: '2026-10-28 19:39'
updated_date: '2026-11-02 23:41'
labels:
  - dm
  - narration
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-10-28-two-browser-alpha.md
priority: high
ordinal: 158000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the first narration of a scene grounds the players. It covers where the party is, why they came, who each party character is and who plays them, which NPCs are present, and what the party is there to do. Then it asks what they do.

Why: two-browser alpha playtest 2026-10-28, items 4 and 6. The opening was well written but read like the middle of a campaign. It never introduced the PCs or said why they were there. Wenna Marsh is present from the first beat (seed beat presence 'present'), yet she first appeared mid-narration ('Wenna's eyes flick upward'). The operator reread it several times and suspected a bug.

Grounding: the scene-start prompt passes only one framing line (apps/server/src/dm/prompts/narrate.ts, 'Open the scene. Framing: ${seed.openingFraming}'). The seed's opening.framing is a single sentence (apps/server/seeds/greyhollow-ford-duo.json). The seed has no field for why the party came. Location identity and portrayal, the goal statement, and character identity and portrayal exist but do not reach the opening.

Related: TASK-0164 (party slide-out) shows the same facts in the UI. The knowledge-ledger card (under discussion 2026-10-28) later lets the opening tell NPCs the party already knows apart from strangers.

Spec: specs/076-scene-start-intros
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The seed opening carries a premise field (why the party is here), the loader requires it, and the shipped seeds fill it
- [ ] #2 The scene-start narrate prompt receives the location identity and portrayal, the premise, the goal statement, each party character with its controller, and each NPC present at the first beat, from player-safe seed views only
- [ ] #3 The scene-start narration names every party character and every present NPC before it asks what the party does, with a test over a captured run
- [ ] #4 The audit flags a scene-start narration that omits a party character or a present NPC, with a test
- [ ] #5 No DM-only seed text (secrets, knows) reaches the scene-start prompt, with a type-level or prompt test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-02 by M3 runbook B (docs/design/m3-runbook-b-resolution-quality.md). Worktree .worktrees/task-0171, branch task-0171-scene-start-intros, cut from origin/main b756b68f. Spec number 076 claimed with a stub. Spine #17; spec authored early.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5 (spec 076 authoring, C1)
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
