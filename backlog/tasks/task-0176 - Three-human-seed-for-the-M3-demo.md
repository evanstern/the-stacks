---
id: TASK-0176
title: Three-human seed for the M3 demo
status: In Progress
assignee: []
created_date: '2026-10-29 02:48'
updated_date: '2026-10-29 02:57'
labels:
  - seed
  - multiplayer
milestone: m-3
dependencies: []
priority: high
ordinal: 163000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: a shipped seed seats three humans (tamsin, odo and kestrel all human seats), so the TASK-0053 demo can run three human players under the AI DM.

Why: TASK-0053 AC #1 needs three humans with the AI DM, and no shipped seed seats three: greyhollow-ford seats one (tamsin), greyhollow-ford-duo seats two (tamsin, kestrel; odo is a companion). Operator ruling 2026-10-28 in chat, answering "How should the demo get its three human players?": "Card a trio seed". Model it on greyhollow-ford-duo (TASK-0163, spec 054).

Spec: specs/061-trio-seed
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A shipped seed seats three humans, loads through loadSeed, and has a test
- [ ] #2 The Start scene slide-out offers three human seats for it, with no modal, and a test
- [ ] #3 docs/ops/dev-vm-104.md names the seed for a three-player table
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-28 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0176, branch task-0176-trio-seed, cut from origin/main e1c2b547. Spec 061 authored at 8f8a6808 (opus): no source change needed (one seed file, tests, a runbook subsection); OQ-1 to OQ-6 await the operator. Finding F-1 (verified: git grep dm.seat apps/web is empty): nothing on hosted dev seats a human DM, which blocks TASK-0053 run 2. F-2 (record only): the playtest harness seats one human; the demo audits a live session.
Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
