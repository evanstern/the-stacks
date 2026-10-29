---
id: TASK-0176
title: Three-human seed for the M3 demo
status: In Progress
assignee: []
created_date: '2026-10-29 02:48'
updated_date: '2026-10-29 03:03'
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
- [ ] #4 Spec phase: Trio seed and the no-database server tests (card AC #1; OQ-1 to OQ-5)
- [ ] #5 Spec phase: The three-human DB test (card AC #1; FR-006)
- [ ] #6 Spec phase: Slide-out test and the runbook subsection (card AC #2, #3; OQ-6)
- [ ] #7 Spec phase: DB suites, mutation guard and live check **[orchestrator]**
- [ ] #8 Spec phase: Wiki re-ground and the sweep runbook
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-28 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0176, branch task-0176-trio-seed, cut from origin/main e1c2b547. Spec 061 authored at 8f8a6808 (opus): no source change needed (one seed file, tests, a runbook subsection); OQ-1 to OQ-6 await the operator. Finding F-1 (verified: git grep dm.seat apps/web is empty): nothing on hosted dev seats a human DM, which blocks TASK-0053 run 2. F-2 (record only): the playtest harness seats one human; the demo audits a live session.
Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5

Operator ruling 2026-10-28 in chat, answering "Do you accept the recommended defaults (a) for TASK-0176's OQ-1 to OQ-6?": "Accept all (a)". Recorded in spec.md. F-1 (no web control seats a human DM) is put to the operator separately; not carded yet.

Phase 1 (T001-T006) at a5f1a905: seeds/greyhollow-ford-trio.json (the duo seed with Odo a human seat, voice and want "Chosen by the player."), trio-views.test.ts (5 cases: views, aiCompanionIds empty, no companion prompt section, legalizeDirector drops odo), seed.test.ts trio cases; red on the missing seed, then 41/41. No server source change. ci:check: only the 5 known adjudicate requireDb failures.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 2 (T007-T009) at c7d25658: trio.integration.test.ts (4 cases: three player rows and no companion job; sign-off waits for all three present; an absent player is skipped; the turn floor passes to Odo with no companion turn) and routes.integration trio cases (seeds list, one-user-two-seats 400, three users 202). 22 passed with REQUIRE_DATABASE=1, green on the first run (behaviour already existed). No server source change.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
