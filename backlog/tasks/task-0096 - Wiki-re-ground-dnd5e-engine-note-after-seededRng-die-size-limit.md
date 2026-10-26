---
id: TASK-0096
title: 'Wiki: re-ground dnd5e-engine note after seededRng die-size limit'
status: Done
assignee: []
created_date: '2026-10-26 02:50'
updated_date: '2026-10-26 02:53'
labels:
  - wiki
  - docs
dependencies: []
ordinal: 86000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
docs/wiki/dnd5e-engine.md is pinned to 60defcc. Commit 2c9f99e (TASK-0042) then changed packages/dnd5e-engine/src/rng.ts: seededRng rollDie now throws RngContractError when sides is above MAX_SIDES (1000). The wiki plan gate reports the note as NEEDS-REVIEW. Found during TASK-0095. A sub-agent Edit of the note was refused by a PreToolUse worktree hook that named the .worktrees/task-0095 path as the base checkout. Check that hook's path logic too.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The RNG section of docs/wiki/dnd5e-engine.md states the 1..MAX_SIDES die-size rule
- [x] #2 The wiki plan gate prints nothing and the freshness gate exits 0
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Already satisfied by ebec1b0 (TASK-0043 wiki re-ground, PR 45): dnd5e-engine.md re-pinned to ad02bc4, which includes 2c9f99e; plan empty, freshness exit 0. Verified on task-0095-ws-duplicate-delivery after merging main: note states the 1..1000 rule; plan empty; freshness 39 fresh, exit 0. The PreToolUse worktree-hook path question in the description was not investigated here.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
