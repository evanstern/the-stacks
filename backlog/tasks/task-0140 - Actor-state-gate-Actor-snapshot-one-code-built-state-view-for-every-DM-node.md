---
id: TASK-0140
title: 'Actor-state gate: Actor snapshot: one code-built state view for every DM node'
status: Done
assignee: []
created_date: '2026-10-27 03:53'
updated_date: '2026-10-27 09:19'
labels:
  - dm
  - rules-gate
milestone: m-3
dependencies: []
priority: high
ordinal: 127000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: code builds an `ActorSnapshot` from the projections and the seed, and every DM node renders state from it. This is the first implementation card (TASK-0135 AC #4).

Why: decision-0025 (D17, TASK-0135) — the actor-state rule gate; operator ruling 2026-10-26 at checkpoint C3, formulation 3 'ledger + opposition dice'. Design and rule map: docs/design/actor-state-gate.md §5 (card U1). Dependencies as stated there: none. Scene presence fields are present but default to `present` until U2.. Operator ruling 2026-10-26: added to m-3 Track C in decision-0025's order.

Spec: specs/040-actor-snapshot
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An `ActorSnapshot` type carries, per actor, id, display name, aliases, kind, controller, HP, life state, conditions, initiative, resources and scene presence; and the stage.
- [ ] #2 `assemble` builds S0 and `resolve` builds S1 plus the S0-to-S1 diff, with tests.
- [ ] #3 Director, interpret, adjudicate, narrate, audit, companion and chronicle prompts render state from the snapshot; `projectionEntries` and `npcNames` are retired.
- [ ] #4 Under the token cap, dead and absent actors compress to one line; no actor is dropped, with a test over a large party and encounter.
- [ ] #5 A snapshot that cannot fit fails the node loudly, with a test.
- [ ] #6 Existing dm tests and the scripted CI playtest stay green.
- [ ] #7 Spec phase: The snapshot module (US1, US2 diff, US4 render)
- [ ] #8 Spec phase: S0, S1 and the planning prompts (US2, US3, US4)
- [ ] #9 Spec phase: Player-facing prompts and retirement (US3, US4, US5)
- [x] #10 Spec phase: Wiki re-ground
- [x] #11 Spec phase: Constitution Compliance (the-stacks)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-26 by the M3 sweep (docs/design/m3-table-sweep-runbook.md). Worktree .worktrees/task-0140, branch task-0140-actor-snapshot, cut from origin/main 53250a9. Spec number 040 claimed with a stub. Track C3 (runbook amendment 1). decision-0025 card U1.

Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
(spec authoring, spec 040, commit 1fd1f48; served verified from transcript.)

ORCHESTRATOR RULINGS 2026-10-27 on spec open questions: Q1 split confirmed: U1 builds and tests the diff; TASK-0146 renders it for audit. Q2 the three views (dm / seat / fiction) stand as the orchestrator default; reported to the operator. Q3 reclaim S0 carded as revisit TASK-0153. Q4 TASK-0142's spec cites contract §3 rule 3. Q5 TASK-0135 merges before this PR. Q6 reconcile merges budgeted. PROMPT VERSION COLLISION: TASK-0114 Phase 2 already bumped dm.companion to v3; whichever of TASK-0114 / TASK-0140 merges second bumps to the next free version after merging main.

OPERATOR RULING 2026-10-27 (in chat): 'Keep three views' (dm / seat / fiction), confirming the orchestrator default.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(implementation Phase 1, T001-T011, commit 3ca21d2; 31 new tests.) ORCHESTRATOR RULINGS 2026-10-27: seat cap 2000 accepted (measured schema-max seat 1716 tokens > 1600); ActorCondition.instanceId accepted as an additive contract change; Phase 2 amends contracts/actor-snapshot.md §2 and §6.2 to match.

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(Phase 2, T012-T019: contract amendment f918e6e, work af65201; S0 at assemble, S1 + diff at resolve, state-overflow; dm.director-v3, dm.interpret-v3, dm.adjudicate-v3; server 889 passed.)

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
(Phase 3, T020-T029, commit 914a112; npcNames and projectionEntries removed; narrate-v4, audit-v3, companion-v3, chronicle-v3; ci:check exit 0, server 896 passed.) Next: Phase 4 wiki (pins on dm/facts.ts, prompts, nodes narrate/audit, companion, chronicle, worker, index.ts, session/projections.ts).

OPERATOR RULING 2026-10-27 (relayed verbatim from the parent session): "Also: the TASK-0140 snapshot views (DM all, companion no monster AC/resources, narration no numbers/ids) are confirmed."

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Reconcile with main (orchestrator session 2): merge aecaa10, fix 39554f5 (ChronicleResult.seqs on overflow). Companion prompt dm.companion-v5 (main had v4 from TASK-0114); chronicle stays v3. ci:check green with REQUIRE_DATABASE=1; playtest integration passes. TASK-0114 T038 annotated not-applicable (W-A) on this branch.

Phase 4 done (7e9c226): wiki re-ground. New actor-snapshot note; dm-runtime, dm-narration-quality, session-model, dm-turn-jobs, dm-failure-and-gates amended; ai-gateway, debug-view, overview, presence, retrieval, server-entrypoint-and-app re-pinned only; CAPSULES/INDEX regenerated; companion prompt text in spec set now dm.companion-v5. Freshness OK (51 notes), spec-bridge exit 0, T030-T039 ticked. ci:check: only the 5 adjudicate.integration tests fail, for lack of a database (no REQUIRE_DATABASE run).

Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5
Phase 4 (7e9c226): wiki re-ground; new note actor-snapshot; 11 staled pins classified (5 NEEDS-REVIEW amended, 6 RE-PIN-ONLY). Freshness OK (51 notes).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (The snapshot module (US1, US2 diff, US4 render): 11/11 · S0, S1 and the planning prompts (US2, US3, US4): 8/8 · Player-facing prompts and retirement (US3, US4, US5): 10/10 · Wiki re-ground: 7/7 · Constitution Compliance (the-stacks): 3/3). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
