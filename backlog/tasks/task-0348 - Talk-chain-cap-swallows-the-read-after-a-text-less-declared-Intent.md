---
id: TASK-0348
title: Talk chain cap swallows the read after a text-less declared Intent
status: Done
assignee: []
created_date: '2026-11-15T03:26:00Z'
updated_date: '2026-11-15T06:40:00Z'
labels:
  - playtest
  - ws:dm
milestone: m-10
dependencies: []
priority: high
ordinal: 332000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Hosted run 2026-11-14 (TASK-0338, docs/playtests/2026-11-14-combat-smoke-hosted.md finding 4): after two DM narrations, a second /move stage (seq 26) queued no read and no confirm row. capReached (apps/server/src/dm/talk-triggers.ts) counts ai:dm narrations since the last human transcript row, and a declared Intent with no text adds no transcript row. A player who walks stage by stage stalls until they say something.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A human declared mechanical Intent resets the chain cap the same way a human talk row does
- [x] #2 A test covers two narrated moves followed by a third declared /move, which queues a read
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 All tests and checks run green
- [x] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-15 by the R1 sweep (docs/design/r1-fast-table-runbook.md). Worktree .worktrees/task-0348, branch task-0348-chain-cap-intent, cut from origin/main 12527068. No spec dir: signed escape line covers this task.

Operator ruling 2026-11-15, relayed verbatim by the parent session: "Sign E12". It signs: "E12 — TASK-0348: card ACs drive. `capReached` (apps/server/src/dm/talk-triggers.ts) also stops counting at a human-declared mechanical Intent, the same as a human transcript row. Add a test: two narrated /move stages, then a third declared /move queues a read, replaying the 2026-11-14 hosted flow (finding 4)."

Implemented under E12 (b866ace1 code/tests/runbook, 1aa3181d wiki). capReached also stops at the latest human Intent by seq. Gates: REQUIRE_DATABASE=1 ci:check exit 0 (latency PASS, ai-round 860ms OK), boundaries 28/28, freshness OK, plan empty, spec-bridge ok.
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=cc/claude-sonnet-5-5

Merged origin/main (7a76b5bb; runbook rows from 0347 and 0348 both kept). dm-talk-triggers chain-cap prose re-verified (2fddcc2e).
Dispatch: tier=haiku pinned=cc/claude-haiku-5-5 served=cc/claude-haiku-5-5

Merged PR #188 1e82ef60. Escape-line task: no spec dir.

Deploy check: vm-104 /health serves bc0adeba, which contains merge 1e82ef60. Worktree, branch and stack removed; env:prune --check: no orphans.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Merged in PR #188 (1e82ef60) under operator-signed E12. capReached (dm/talk-triggers.ts) also stops counting at the latest human Intent by seq, so a text-less declared /move resets the chain cap. A unit case and a DB replay (two narrated stages, then a declared /move, queue a read) cover the 2026-11-14 hosted finding 4.
<!-- SECTION:FINAL_SUMMARY:END -->
