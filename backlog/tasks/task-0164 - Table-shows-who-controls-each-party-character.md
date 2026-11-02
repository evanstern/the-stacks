---
id: TASK-0164
title: 'Party slide-out: each party character, its controller, vitals and turn order'
status: In Progress
assignee: []
created_date: '2026-10-28 05:50'
updated_date: '2026-11-02 15:00'
labels:
  - play-route
  - web
milestone: m-3
dependencies:
  - TASK-0163
priority: medium
ordinal: 151000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: every viewer at a table opens a party slide-out (no modal) that lists each party character. Each entry shows who controls the character (a named human, or an AI companion), marks the viewer's own character, and shows class, level, HP and AC. When turn order applies, the slide-out also shows initiative order and whose turn it is.

Why: originally a maybe. The play header shows presence chips for humans and the AI DM only. An AI companion such as Brother Odo has no chip, and a seat's snapshot view has no marker for the seat's own character (TASK-0163 Phase 2 evidence/two-human-check.md, Phase 6 live run). Players learn their own character only from the speaker select. The revisit trigger fired 2026-10-28 in the two-browser alpha playtest, item 5: the operator did not know Brother Odo was an AI party member until he spoke. Operator approved promoting and widening the card.

Grounding: seed characters carry HP, AC and ability modifiers (identity.combatant, identity.abilityMods) but no class or level. A turn-order strip exists for turn mode (apps/web/app/play/components/turn-order.tsx, TASK-0050). Full sheets stay TASK-0058 (m-4).

Spec: specs/072-party-slideout
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The table lists each party character with its controller (human display name or AI companion)
- [ ] #2 A player's own character is marked
- [ ] #3 The slide-out shows each character's class, level, current and max HP, and AC, and the seed schema adds class and level to party characters, which the shipped seeds fill
- [ ] #4 When turn order applies, the slide-out lists initiative order and marks the active turn
- [ ] #5 The slide-out opens from the table header as a slide-out, never a modal, in light and dark mode
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-11-02 by M3 runbook A (docs/design/m3-runbook-a-run3-fixes.md). Worktree .worktrees/task-0164, branch task-0164-party-slideout, cut from origin/main f3c408c1. Spec number 072 claimed with a stub. Lane A4, after TASK-0191 (PR #100). Spec 072. Compare plan.md with spec 068 (TASK-0194) before implementation.

Dispatch: tier=opus pinned=cc/claude-opus-5-5[1m] served=claude-opus-5-5 (spec 072 authoring, C1)
Overlap check vs spec 068 (orchestrator, 2026-11-02): one shared source file, apps/server/src/dm/nodes/resolve.ts (0164: party class/level hunk in directorOpening; 0194: pullIn). Runbook rule: draft-hold. T006 waits until 0194 merges or the operator rules. Implementation held for OQ-1 (it widens the frozen 029 party proposal schema; operator ruling needed).

Operator rulings 2026-11-02 (in chat): spec 072 OQ-1 (class and level optional on party members, widening the frozen 029 party proposal schema additively): "Accept additive change (Recommended)". Overlap with spec 068 on dm/nodes/resolve.ts: "Hold until 0194 merges (Recommended)". T006 and the wiki phase wait for TASK-0194's merge; other phases run now. OQ-2 (away controller shows as 'Player (away)'): orchestrator takes the spec default.

Dispatch: tier=sonnet pinned=cc/claude-sonnet-5-5[1m] served=claude-sonnet-5-5 (spec 072 phase 1 minus T006, 883a75a8)
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
