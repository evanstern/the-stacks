---
id: TASK-0212
title: Downed-character fallback repeats 'falls unconscious'
status: Done
assignee: []
created_date: '2026-11-02 23:19'
updated_date: '2026-11-03 05:29'
labels:
  - dm
  - narration
  - playtest
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-11-02-runbook-a-playtest.md
priority: low
ordinal: 198000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the fallback names a life-state change once.

Why: runbook A playtest run 1 (2026-11-02, session 9296c653, seq 191-196). The pot-helm goblin's hit took Kestrel 5 → 0 HP. The engine emitted life-state.changed (conscious → unconscious) and condition.applied (unconscious, hp-zero). The fallback rendered each as its own sentence: 'Kestrel is wounded. Kestrel falls unconscious. Kestrel falls unconscious.'

Where: apps/server/src/dm/fallback.ts — collapse a life-state change and its hp-zero condition into one sentence.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A drop to zero renders 'falls unconscious' once, with a test replaying seq 189-196
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-03 by M3 runbook B (docs/design/m3-runbook-b-resolution-quality.md). Worktree .worktrees/task-0212, branch task-0212-one-falls-unconscious, cut from origin/main 88589234. No spec dir: signed escape line covers this task. Spine #11. Escape line E2 (card ACs drive).

Dispatch: tier=haiku pinned=cc/claude-haiku-5-5 served=claude-haiku-5-5 (E2 implementation)
Builds beside TASK-0207: separate fallback.ts functions (life-state sentence vs plannedSentence).

Gates on the final tree (orchestrator): pnpm ci:check green with the DB suite; freshness OK; spec-bridge ok. Replay built from the engine's fact shape for seq 189-196 (run 1 raw rows are not in the repo).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A drop to 0 HP now says 'falls unconscious' once: the fallback skips the hp-zero unconscious condition when the same target has a life-state change to unconscious (changeSentences in fallback.ts). Escape line E2.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 All tests and checks run green
- [x] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
