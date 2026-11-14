---
id: TASK-0335
title: Quoted NPC dialogue can name absent or unmet actors
status: In Progress
assignee: []
created_date: '2026-11-14T02:14:00Z'
updated_date: '2026-11-14T02:33:00Z'
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
- [ ] #1 The leak check runs on quoted NPC dialogue for absent and unmet actors and hidden zones, and drops or corrects the sentence, with a test built from this transcript.
- [ ] #2 Companion prompts receive no actor name the party has not met, with a test.
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
<!-- SECTION:NOTES:END -->
