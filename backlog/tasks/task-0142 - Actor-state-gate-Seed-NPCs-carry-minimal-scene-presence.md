---
id: TASK-0142
title: 'Actor-state gate: Seed NPCs carry minimal scene presence'
status: In Progress
assignee: []
created_date: '2026-10-27 03:53'
updated_date: '2026-10-27 19:09'
labels:
  - dm
  - rules-gate
milestone: m-3
dependencies:
  - TASK-0140
  - TASK-0141
priority: high
ordinal: 129000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: every seed NPC is an actor in the snapshot with scene presence, so claims about it can be checked. Richer NPC records stay with the Codex (M4).

Why: decision-0025 (D17, TASK-0135) — the actor-state rule gate; operator ruling 2026-10-26 at checkpoint C3, formulation 3 'ledger + opposition dice'. Design and rule map: docs/design/actor-state-gate.md §5 (card U8). Dependencies as stated there: U1, U2.. Operator ruling 2026-10-26: added to m-3 Track C in decision-0025's order.

Spec: specs/050-seed-npc-presence
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A seed declares each NPC's initial scene presence per beat, with a schema test.
- [ ] #2 Seed NPCs appear in the snapshot with id, name, aliases, kind `NPC` and scene presence.
- [ ] #3 A seed NPC's scene presence changes only through U2's event, with a test over M2 seq 296-301 (Snag stays present without a roll).
- [ ] #4 A seed NPC that becomes a combatant keeps one identity across both.
- [x] #5 Spec phase: Seed declaration, identity check and aliases (card AC #1, AC #4 seed half)
- [x] #6 Spec phase: `scene-presence` proposal visibility (card AC #2 support, OQ-4)
- [ ] #7 Spec phase: Snapshot aliases, the M2 log test, one identity (card AC #2, AC #3, AC #4)
- [ ] #8 Spec phase: Seed-presence group in resolve, NPC lists from presence (card AC #2, AC #4 resolve half)
- [ ] #9 Spec phase: Wiki re-ground
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-27 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0142, branch task-0142-seed-npc-presence, cut from origin/main 4fb8cbe. Spec number 050 claimed with a stub. Track C, first card after TASK-0050 (#74, 464b336).

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
(Spec author: spec.md and the checklist at 0cd9a9e. It stopped before plan.md with OQ-1..OQ-6.) Recommended defaults:
- OQ-1 (a): a required beats[].presence map per seed NPC, cross-checked against npcIds; seed v stays 1; amends 031 scene-seed.md.
- OQ-2 (a): code-owned seed rows at scene start for opening-beat NPCs that are not present, plus arrived at encounter start, before initiative, for NPCs that beat declares present. Later beats are guidance only.
- OQ-3 (a): reuse the reasons removed, conceded and arrived; no new reason.
- OQ-4 (a): an optional visibility on the scene-presence proposal, with scene-start seed rows at dm visibility and kept out of narration facts; amends 029 proposals.md and gate-api.md §1.
- OQ-5 (a): a seed cross-check that identity.combatant equals id and names an encounter monster.
- OQ-6 (a): optional identity.aliases (at most 6); proposed Greyhollow values "the keeper", "the boy", "the goblin leader".
Also for the operator: the encounter-start rows are triggered by a Director tableMode move. Confirm this fits decision-0025 §2.5 and 048 AC #5.

Operator ruling 2026-10-27 (verbatim): "TASK-0142: I accept the recommended defaults OQ-1 to OQ-6 (a), including the frozen 029 and 031 amendments and the Greyhollow aliases "the keeper", "the boy", "the goblin leader". The Director-triggered encounter-start seed rows are fine under decision-0025 §2.5 and 048 AC #5."

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
(Resumed spec author for plan.md, design artifacts and tasks.md: 3fd89db.) The M2 log, rows 1-333, folds cleanly under the current catalog, so the AC #3 test reads the recorded file in place. The Greyhollow presence values chosen by the spec author: Wenna is present at ferry-house and the-keeper and absent at reed-camp; Pell and Snag are absent, absent, then present. Orchestrator ruling: Phases 1 and 2 run serially, not in parallel, because two writers in one worktree risk index collisions.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(Phase 1, T001-T007: aa900c6. seed.test 31 pass; ci:check without a DB: only the 5 expected adjudicate.integration failures. The two seed copies are byte-identical.)

spec-bridge sync: Seed declaration, identity check and aliases (card AC #1, AC #4 seed half): 7/7 · `scene-presence` proposal visibility (card AC #2 support, OQ-4): 0/6 · Snapshot aliases, the M2 log test, one identity (card AC #2, AC #3, AC #4): 0/5 · Seed-presence group in resolve, NPC lists from presence (card AC #2, AC #4 resolve half): 0/11 · Wiki re-ground: 0/7

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(Phase 2, T008-T013: b09a675. session-model 816 pass; ci:check without a DB: only the 5 expected adjudicate.integration failures. pnpm lint was not reached; the Phase 4 DB ci:check covers it.) Deviation: resolve.ts presence submit sets visibility "public" explicitly, so it typechecks. Behaviour is unchanged.

spec-bridge sync: Seed declaration, identity check and aliases (card AC #1, AC #4 seed half): 7/7 · `scene-presence` proposal visibility (card AC #2 support, OQ-4): 6/6 · Snapshot aliases, the M2 log test, one identity (card AC #2, AC #3, AC #4): 0/5 · Seed-presence group in resolve, NPC lists from presence (card AC #2, AC #4 resolve half): 0/11 · Wiki re-ground: 0/7
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
