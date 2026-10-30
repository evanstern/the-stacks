---
id: TASK-0180
title: 'Design: in-character talk triggers DM reactions (amends D8)'
status: In Progress
assignee: []
created_date: '2026-10-30 00:37'
updated_date: '2026-10-30 04:47'
labels:
  - dm
  - design
  - narration
milestone: m-3
dependencies: []
references:
  - docs/playtests/2026-10-28-two-browser-alpha.md
priority: high
ordinal: 167000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: in-character talk can draw a reaction from the world. When a PC, companion or NPC speaks in character, the DM reads the post for triggers and decides what, if anything, happens next.

Why: two-browser alpha playtest 2026-10-28, run 2 item 1. Brother Odo asked Wenna Marsh directly who was missing from the house. Tamsin spoke a line in character. No NPC answered and nothing in the scene changed. The operator expects every action to be able to cause a reaction, and that reaction to cause further reactions.

Grounding: decision-0016 (D8) says talk never changes state and never triggers a DM turn. It allows the narrator to chime in when mentioned, but no code builds that. apps/server/src/dm/enqueue.ts enqueues DM work only on action.committed, proposal approval or rejection, a human action.commented on a companion action, and floor events. Talk rows match none of them.

Scope: the operator's wanted model. Every in-character post is read for triggers: a character addressed, mentioned or referred to; speech loud enough to be overheard by someone nearby; other triggers the design names. The DM decides what each trigger means for the next beat. Reactions can chain, but AI-only exchanges are capped so PCs drive the scene. A reaction that turns into combat, or action fast enough that turns matter, moves the table into turn mode.

Related: TASK-0172 and TASK-0173 (what each actor knows), TASK-0149 (NPC attitude), TASK-0152 (NPC doctrine), TASK-0144 (companion say gate).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A decision record amends decision-0016 so in-character talk can trigger a DM reaction
- [ ] #2 The decision names the triggers read from an in-character post: a character addressed, mentioned or referred to, speech overheard by someone nearby, and any others it adds
- [ ] #3 The decision states how the DM turns triggers into a next-beat outcome: an NPC reply, a scene change, or no reaction
- [ ] #4 The decision caps chained AI-only exchanges and states how the floor returns to the PCs
- [ ] #5 The decision states when a reaction moves the table into turn mode
- [ ] #6 A spec is written against the decision, and its implementation tasks are carded
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-29 by the M3 sweep, resumed 2026-10-29 (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0180, branch task-0180-talk-triggers, cut from origin/main cf9bdeb9. Spec number 065 claimed with a stub. Actual claim date 2026-10-30, fresh session after the pdlc 1.0.1 re-plant (#93). Next free decision id: decision-0027.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
