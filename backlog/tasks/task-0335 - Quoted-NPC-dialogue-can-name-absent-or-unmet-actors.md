---
id: TASK-0335
title: Quoted NPC dialogue can name absent or unmet actors
status: Done
assignee: []
created_date: '2026-11-14T02:14:00Z'
updated_date: '2026-11-14T08:49:00Z'
labels:
  - playtest
  - ws:narration
milestone: m-10
dependencies: []
references:
  - docs/playtests/2026-11-13-r1-spine-test-drive.md
priority: high
ordinal: 319000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in the 2026-11-13 R1 spine test drive (session 0106e608, seq 21). Wenna's reply says 'Pell's not back. Snag's not back.' Snag (goblin leader) is absent at scene start (seq 14) and the seed never gives Wenna knowledge of him. The spec 103 narration check masks quoted text before the absent-actor and fogged-zone leak checks, so NPC dialogue inside quotes ships hidden information. A companion (Odo, seq 22) then repeats the name. Separately, Wenna is placed on the bank although the seed beat puts her hidden in the loft.

Spec: specs/112-dialogue-knowledge
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The leak check runs on quoted NPC dialogue for absent and unmet actors and hidden zones, and drops or corrects the sentence, with a test built from this transcript.
- [x] #2 Companion prompts receive no actor name the party has not met, with a test.
- [x] #3 Spec phase: Knowledge model and the speech check (US1, US2, AC #1)
- [x] #4 Spec phase: Prompts see only met names (US3, AC #2)
- [x] #5 Spec phase: Auditor mirrors the runtime rule (US4, card note)
- [x] #6 Spec phase: Wiki re-pin
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Related evidence (session 0106e608, seq 31): the check dropped a narration sentence naming Pell, although Wenna speaking of her own grandson is fair. The absent-actor rule needs a notion of who the speaker or party knows, not only presence.

The playtest auditor's hidden-info check also passed segment 1 (seq 16-21), which contains the quoted 'Snag's not back.' Fix the auditor alongside the runtime check.

Claimed 2026-11-13 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0335, branch task-0335-quoted-dialogue-leak, cut from origin/main 594dd99a. Spec number 111 claimed with a stub.

Renumbered spec 111 -> 112: TASK-0337 claimed 111 first (5cea343c).

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=cc/claude-opus-5-5

Spec 112 committed (cfb80e55). Spec open questions carded on main: OQ-1 TASK-0339, OQ-2 TASK-0340, OQ-3 TASK-0341, OQ-4 TASK-0342, OQ-5 TASK-0343. Raw evidence for the Phase 1 fixture: ~/.cache/stacks-sweep/t0335/ (events.json holds a human user id; replace it with PLAYER_USER). Next: Phase 1 (T001-T009) to sonnet-implementer. The dispatch from the coordinating session was blocked by the auto-mode classifier on 2026-11-14.

spec-bridge sync: Knowledge model and the speech check (US1, US2, AC #1): 0/9 · Prompts see only met names (US3, AC #2): 0/5 · Auditor mirrors the runtime rule (US4, card note): 0/3 · Wiki re-pin: 0/3

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5 (phase 1)

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5 (phase 2)

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5 (phase 3)

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5 (phase 4)

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5 (reconcile with main: TASK-0336/0337; dm.react-v6)

Operator ruling 2026-11-14 (in chat): "Remove after merge". Once PR merges and the worktree is removed, delete the three ~/.claude/settings.json allow rules for git -C .../worktrees/task-0335 add, commit and push.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (Knowledge model and the speech check (US1, US2, AC #1): 9/9 · Prompts see only met names (US3, AC #2): 5/5 · Auditor mirrors the runtime rule (US4, card note): 3/3 · Wiki re-pin: 3/3). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->
