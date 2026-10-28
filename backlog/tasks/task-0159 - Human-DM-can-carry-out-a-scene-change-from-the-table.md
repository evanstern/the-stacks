---
id: TASK-0159
title: Human DM can carry out a scene change from the table
status: In Progress
assignee: []
created_date: '2026-10-27 10:33'
updated_date: '2026-10-28 08:28'
labels:
  - play-route
  - gate
milestone: m-3
dependencies: []
ordinal: 146000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a seated human DM can change scene from the play route. That includes acting on a dismissed or pending scene suggestion. Evidence: the TASK-0100 spec author (spec 047, c53d50f, OQ-1) found that apps/web/app/play/frames.ts builds no scene request, so a human DM can read and dismiss a scene suggestion but cannot carry it out at the table. Why it matters: the M3 demo's second run is ask mode with a human DM (checkpoint C7).

Spec: specs/055-human-dm-scene-change
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The play route offers a human DM a scene-change control built from a gate scene request, with no modal, and a test
- [ ] #2 A scene suggestion's content can seed that control
- [x] #3 Spec phase: The scene request and command (card AC #1)
- [x] #4 Spec phase: Seeds and the view model (card AC #2)
- [x] #5 Spec phase: The scene panel and the header trigger (card AC #1, card AC #2)
- [x] #6 Spec phase: The AI DM resumes in the carried-out scene (card AC #2, SC-002)
- [ ] #7 Spec phase: Live check in script mode (card AC #1, card AC #2)
- [ ] #8 Spec phase: Merge, re-ground and close (all ACs)
<!-- AC:END -->



## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-28 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0159, branch task-0159-human-dm-scene-change, cut from origin/main 7e3e029. Spec number 055 claimed with a stub. Spec 054 is held by TASK-0163 (PR #79), so this takes 055.

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
Spec author (spec.md, 212a4f8) stopped with open questions OQ-1 to OQ-7. Finding: with a human DM the scene-start suggestion stays pending, p.scene stays null, and every later AI DM turn fails no-scene until the human DM carries out a scene with the seed's sceneId.

Operator ruling, in chat 2026-10-28, verbatim: "TASK-0159: I accept the recommended defaults OQ-1 to OQ-7 (A), including the 030 TableHeader amendment. Card DC-1 (human DM ends an encounter or changes table mode) in m-3; card DC-2 as a revisit."

Carded per the ruling: DC-1 is TASK-0165 (m-3). DC-2 is TASK-0166 (revisit).

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5

Spec author resumed (573cafc): resolved OQ-1 to OQ-7 as D-1 to D-7, wrote plan.md, tasks.md (6 phases, 40 tasks), contracts/scene-change.md and quickstart.md. Risks raised: the live check may not show the next AI DM turn running while other scene-start proposals stay pending (T023 stops and raises an open question if so); the operator header keeps offering Start scene while the scene-start suggestion is pending.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

spec-bridge sync: The scene request and command (card AC #1): 9/9 · Seeds and the view model (card AC #2): 0/4 · The scene panel and the header trigger (card AC #1, card AC #2): 0/7 · The AI DM resumes in the carried-out scene (card AC #2, SC-002): 0/7 · Live check in script mode (card AC #1, card AC #2): 0/6 · Merge, re-ground and close (all ACs): 0/7

Phase 1 gate (orchestrator): REQUIRE_DATABASE=1 pnpm ci:check exits 0 on 6a75be7 with the test DB migrated. Web node 255 pass.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Orchestrator ruling (Phase 2): a scene seed whose proposal summary is null takes its label from the after title, or "Clear the scene" for a clear seed. This fills a null case the contract left open; it changes no frozen contract.

spec-bridge sync: The scene request and command (card AC #1): 9/9 · Seeds and the view model (card AC #2): 4/4 · The scene panel and the header trigger (card AC #1, card AC #2): 0/7 · The AI DM resumes in the carried-out scene (card AC #2, SC-002): 0/7 · Live check in script mode (card AC #1, card AC #2): 0/6 · Merge, re-ground and close (all ACs): 0/7

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Orchestrator rulings (Phase 3), keeping the panel as built: (1) unchecking Clear on a clear-scene seed leaves Apply disabled, because D-2 takes the sceneId only from a seed; (2) the panel closes on a successful apply; (3) the extra Current scene heading stays; (4) Apply needs a non-empty reason, as the gate's ReasonSchema does. None changes a frozen contract.

spec-bridge sync: The scene request and command (card AC #1): 9/9 · Seeds and the view model (card AC #2): 4/4 · The scene panel and the header trigger (card AC #1, card AC #2): 7/7 · The AI DM resumes in the carried-out scene (card AC #2, SC-002): 0/7 · Live check in script mode (card AC #1, card AC #2): 0/6 · Merge, re-ground and close (all ACs): 0/7

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

T023 first DB run (orchestrator): (a) and (b) pass. (c) fails only on its last line: it expects 2 scene.changed rows and gets 1. One is right, because the human-DM scene-start leaves the scene pending, so only the DM carry-out writes a row. Every other (c) check passes: no failure, and checkpoint.beat is set, so the seed loaded and assemble ran.

Orchestrator ruling (Phase 4, OQ from the implementer): an approval turn with no player action ends empty-beat by design (runner.ts), with or without a scene. So the discriminator between (b) and (c) is checkpoint.beat: null on the no-scene path, set once the seed loads. SC-002 is unchanged. Tasks T021 and T028-T030 and quickstart step 8 are reworded to that discriminator. The live check also proves a narrated turn: after the carry-out the DM approves the pending scene-start suggestions, a player declares act-search, and the AI DM narrates it. If that cannot run, Phase 5 stops and raises an open question.

Phase 4 gate (orchestrator): T023 DB test 3/3 at 8f6a283; T024 DB mutations both fail (c) as expected (evidence a40b954). REQUIRE_DATABASE=1 pnpm ci:check run on a40b954.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
