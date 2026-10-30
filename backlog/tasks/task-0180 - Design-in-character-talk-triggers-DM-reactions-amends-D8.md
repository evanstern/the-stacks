---
id: TASK-0180
title: 'Design: in-character talk triggers DM reactions (amends D8)'
status: In Progress
assignee: []
created_date: '2026-10-30 00:37'
updated_date: '2026-10-30 15:13'
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

Spec: specs/065-talk-triggers
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A decision record amends decision-0016 so in-character talk can trigger a DM reaction
- [x] #2 The decision names the triggers read from an in-character post: a character addressed, mentioned or referred to, speech overheard by someone nearby, and any others it adds
- [x] #3 The decision states how the DM turns triggers into a next-beat outcome: an NPC reply, a scene change, or no reaction
- [x] #4 The decision caps chained AI-only exchanges and states how the floor returns to the PCs
- [x] #5 The decision states when a reaction moves the table into turn mode
- [x] #6 A spec is written against the decision, and its implementation tasks are carded
- [x] #7 Spec phase: The pure core (card AC #2, #4)
- [x] #8 Spec phase: Enqueue (card AC #3, #4)
- [x] #9 Spec phase: The talk path (card AC #3, #4)
- [x] #10 Spec phase: Escalation to turn mode (card AC #5) — cut 1
- [x] #11 Spec phase: DB suites, mutation guard, live check **[orchestrator]**
- [x] #12 Spec phase: Contracts and wiki re-ground
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-29 by the M3 sweep, resumed 2026-10-29 (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0180, branch task-0180-talk-triggers, cut from origin/main cf9bdeb9. Spec number 065 claimed with a stub. Actual claim date 2026-10-30, fresh session after the pdlc 1.0.1 re-plant (#93). Next free decision id: decision-0027.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5
Spec author (2026-10-30): draft decision-0027 (D19, proposed) + spec 065 set, commits b8ede81b 748f0602 a144c4b9, ~172k tokens. OQ-1..OQ-16 await the operator's ruling; no frozen contract touched by the (a) options. Implementation cards wait on the ruling.

Operator ruling 2026-10-30, in this sweep session: "I rule OQ-1 to OQ-16 all (a)." decision-0027 flipped to accepted (no CLI edit verb; status line edited in the file, as decision-0026 was). OQ-15 (a): close TASK-0052 by decision-0027 §7 after this PR merges.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5
Phases (2026-10-30), one line each above: P1 pure core 0bbd0e69; P2 enqueue 8a142292; P3 talk path eb45dded; P4 escalation 447b321e; P5 gates + reclaim fix c2e6d785 + live check ccf6a49e; P6 contracts + wiki 0c9f9dc4 9bc934ea 91509eaa. REQUIRE_DATABASE=1 ci:check exit 0 (server 1424, web 139). Mutation: codeTriggers 9, capReached 3, legalEscalation 2. Brave live check (greyhollow-talk): Wenna replies, free mode, 8 shots, no modal.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
