---
id: TASK-0189
title: Companion reply misnames who spoke to it
status: In Progress
assignee: []
created_date: '2026-11-02 04:03'
updated_date: '2026-11-02 05:47'
labels:
  - dm
  - companion
  - playtest
milestone: m-3
dependencies: []
priority: medium
ordinal: 176000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: when a PC addresses a companion, the companion answers that PC by name and treats the question as theirs.

Why: alpha run 3 (2026-11-01), finding 3. Tamsin declared 'Odo, are you here?' (seq 31). Brother Odo replied 'I'm here, Wenna, and no gaff needed for an old monk' (seq 36, dm.companion-v5): he answered Wenna, the NPC in the loft, not Tamsin. His earlier line (seq 27, 'Easy now, Tamsin') named the right PC.

Where to look: the companion prompt's view of the triggering post (who declared it, to whom) in apps/server/src/dm/ companion path; whether the companion sees the declarer's character name.

Related: TASK-0144 (claim gate on companion say), TASK-0172 (what each actor knows).

References: docs/playtests/2026-11-01-two-browser-alpha-run-3.md (run 3, session e8e8326d)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The companion prompt names the PC whose post triggered it, and who that post addressed
- [ ] #2 A test replays run 3's seq 31 and checks the reply addresses Tamsin, not Wenna (fake gateway, prompt-content assertion)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-02 by M3 runbook A (docs/design/m3-runbook-a-run3-fixes.md). Worktree .worktrees/task-0189, branch task-0189-companion-addressee, cut from origin/main 7e252840. No spec dir: signed escape line covers this task. Lane A3. Escape E1: card ACs drive.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
