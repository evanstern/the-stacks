---
id: TASK-0171
title: >-
  Scene-start narration introduces the place, the reason, the party and the NPCs
  present
status: Done
assignee: []
created_date: '2026-10-28 19:39'
updated_date: '2026-11-03 09:18'
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
- [ ] #6 Spec phase: The opening premise (card AC #1; US1)
- [ ] #7 Spec phase: The opening prompt (card AC #2, #5; US1, US2, US4)
- [ ] #8 Spec phase: The name check, the fallback and the scripts (card AC #3, #4; US2, US3)
- [ ] #9 Spec phase: Wiki re-ground
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-02 by M3 runbook B (docs/design/m3-runbook-b-resolution-quality.md). Worktree .worktrees/task-0171, branch task-0171-scene-start-intros, cut from origin/main b756b68f. Spec number 076 claimed with a stub. Spine #17; spec authored early.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5 (spec 076 authoring, C1)

spec-bridge sync: The opening premise (card AC #1; US1): 0/5 · The opening prompt (card AC #2, #5; US1, US2, US4): 0/5 · The name check, the fallback and the scripts (card AC #3, #4; US2, US3): 0/8 · Wiki re-ground: 0/5

Spec 076 (c5bfc692). Defaults taken: OQ-2 (a) scene-start fallback names everyone (fallback.ts joins 0171's footprint, between 0213 and 0214 in the fallback order); OQ-3 (a) opening up to about 160 words, never over 180. OQ-1 (what 'who plays them' means) put to the operator. Footprint correction: adds nodes/narrate.ts, nodes/audit.ts, fallback.ts and eight DM scripts; drops scene-start.ts and prompts/audit.ts. Phase 1 waits on TASK-0127 (seed/schema.ts); phases 2-3 on 0113, 0127, 0170.

OPERATOR RULING 2026-11-02 on spec 076 OQ-1 (in chat, answering what 'who plays them' means for the opening): "The opening should name the characters, not the players". The opening names every party character; it names no player. No user lookup, no display names reach the model. Spec 076 is amended to match before its phase 2 builds; runbook B's scenario row reads 'names the party characters and Wenna'.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5 (spec 076 amendment for OQ-1 ruling, C1)

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (spec 076 phases 1-2, with seam check)

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (spec 076 phase 3)
Seam check (phases 1-2): no seam changed meaning; narrate-v16; see deviations.md.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (spec 076 phase 4, wiki)
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (The opening premise (card AC #1; US1): 5/5 · The opening prompt (card AC #2, #5; US1, US2, US4): 5/5 · The name check, the fallback and the scripts (card AC #3, #4; US2, US3): 8/8 · Wiki re-ground: 5/5). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
