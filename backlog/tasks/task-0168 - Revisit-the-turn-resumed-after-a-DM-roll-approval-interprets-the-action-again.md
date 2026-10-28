---
id: TASK-0168
title: 'With a human DM, approving a check roll re-proposes the same roll'
status: To Do
assignee: []
created_date: '2026-10-28 08:50'
updated_date: '2026-10-28 15:24'
labels:
  - dm-runtime
  - gate
milestone: m-3
dependencies: []
priority: high
ordinal: 155000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: with a human DM seated, a player check narrates after the DM approves its roll. Evidence: the TASK-0159 live check (spec 055, 5614968, session 6cb00938) on a script-mode stack. The commit turn ran director and interpret and paused on a check.roll proposal (policy ask). The DM approved it: dice.rolled, check.resolved, proposal.approved. The resumed approval turn ran director and interpret again and wrote a second check.roll proposal for the same perception DC 13 (seq 56) instead of narrating. Each approval repeats this, so the check never narrates. An AI DM resolves the roll inside one turn, so only a human DM hits this. Why it matters: the TASK-0053 demo second run is ask mode with a human DM (checkpoint C7). Promoted from a revisit on 2026-10-28, once the loop reproduced.

Spec: specs/057-human-dm-roll-resume
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 With a human DM seated, a player check whose roll the DM approves narrates in the resumed turn, with no second roll proposal, and a DB test
- [ ] #2 The resumed turn reuses the resolved check rather than interpreting the action again, or a spec records why it must re-interpret
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
