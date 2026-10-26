---
id: TASK-0046
title: 'First Scene: DM runtime — turn jobs, pipeline nodes, Director, companions'
status: Done
assignee: []
created_date: '2026-10-25 19:59'
updated_date: '2026-10-26 09:43'
labels:
  - first-scene
  - dm
  - ai
milestone: m-2
dependencies:
  - TASK-0045
  - TASK-0043
references:
  - docs/design/architecture.md
  - 'https://github.com/bradbushSFAI/tabletop-dm'
priority: high
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Outcome: the AI DM as an actor. A committed action enqueues a turn job on the existing Postgres jobs queue. The job runs assemble, director, interpret, adjudicate (when needed), resolve, narrate and audit. Chronicle runs off the hot path. AI companions act through the same action path as a human.

Why: decision-0017 layer 3. Ordering is the anti-cheat: dice resolve before narration, and the narrator receives results as facts. The Director owns scene goal, clocks, table-mode switches and beat timing from day 1 (decision-0018). Nodes are plain async functions so a graph framework could wrap them later (decision-0019).

Scene content: the Codex does not exist yet. The runtime loads a hand-authored scene seed (goal, location, NPCs, encounter) validated by Zod and shaped toward the content contracts. M4 replaces the seed with codex entities.

Doctrine: DM-style prompts adapt tabletop-dm's right/wrong pairs (MIT, commit fe2c29b) with attribution (decision-0021 idea 5).

Spec: specs/031-dm-runtime
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A committed action enqueues a turn job on the jobs queue, using its claim, lease and fencing.
- [x] #2 The turn job runs assemble, director, interpret, adjudicate when needed, resolve, narrate and audit, in that order.
- [x] #3 Each node is a plain async function from TurnContext to NodeResult.
- [x] #4 Every LLM call names one gateway purpose: dm.director, dm.interpret, dm.adjudicate, dm.narrate, dm.audit, dm.chronicle or dm.companion.
- [x] #5 Resolve turns node output into proposals and sends them through the gate; no other node writes state.
- [x] #6 Narrate receives resolved results as facts and never calls the engine or the dice.
- [x] #7 Audit regenerates and flags narration that disagrees with the roll ledger, and never ships a mismatch silently.
- [x] #8 The Director sets the scene goal, runs secret trackers, switches table modes and decides when a beat resolves.
- [x] #9 Actions committed during a resolving turn queue into the next beat and resolve in log sequence order.
- [x] #10 AI companions declare and commit actions through the same gate path as a human player.
- [x] #11 Adjudicate calls the M1 retrieval and returns a cited ruling.
- [x] #12 Chronicle runs off the hot path and writes journal updates as proposals.
- [x] #13 The runtime loads a Zod-validated scene seed file.
- [x] #14 Doctrine prompts adapted from tabletop-dm carry an MIT attribution notice.
- [x] #15 Tests run a full turn against the fake gateway adapter with scripted dice.
- [x] #16 Spec phase: The jobs queue for DM jobs (US4, US8; AC #1, #9)
- [x] #17 Spec phase: Seed, doctrine, purposes and scripts (US1, US3; AC #4, #13, #14, #15)
- [x] #18 Spec phase: Node seam and the planning nodes (US1, US3, US6; AC #2, #3, #11)
- [x] #19 Spec phase: Resolve, narrate and audit (US1, US2, US3, US8; AC #5, #6, #7, #8)
- [x] #20 Spec phase: Worker, actors and routes (US4, US5, US7; AC #1, #5, #10, #12)
- [x] #21 Spec phase: Merge condition and the full gate (all stories; AC #1, #2, #4, #8, #9, #15)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Claimed 2026-10-26 by the M2 First Scene sweep (docs/design/m2-first-scene-sweep-runbook.md, lane 4) after TASK-0045 merged (#48); TASK-0043 merged earlier (#45). Worktree .worktrees/task-0046, branch task-0046-dm-runtime, cut from origin/main 722e8a6. Spec number 031 claimed with a stub.

Spec authoring by opus-implementer: 2727563, ~? tokens. Clarify was skipped (spec.md records why).
Dispatch: tier=opus pinned=claude-opus-5-5 served=claude-opus-5-5
The spec defaults stand; the orchestrator took them as within the spec's authority:
- a combat-starting beat resolves with no effect, then the player re-declares;
- audit flags go to the job's audit record plus a dm journal entry;
- rulings become dm journal entries;
- the seed lives in apps/server/seeds;
- there is one companion hold per beat.
Migration 0004 extends the jobs table (new kinds, session_id, partial unique indexes). It also fixes an existing bug: ingestion's claimJob, listJobs and getJob had no kind filter (FR-007).
Implementation dispatch grouping: one phase per dispatch, P1 to P6.

Correction: the spec authoring above cost ~348k tokens.
Phase 1 by sonnet-implementer: a684c31. Migration 0004_glamorous_warlock was generated, not hand-edited. queue.ts and dm/jobs.ts added, and ingestion's job queries now filter by kind (FR-007). The DB suite passes 476 server tests; ci:check green.
Carried to later phases: Phase 3 and 4 narrow the TurnCheckpoint fields; Phase 5's worker appends the FR-012 failure notice for an abandoned job.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 2 by sonnet-implementer: eeefbd3. Seed schema and loader added (seed copied byte-identical), with the doctrine module, NOTICE.md and its guard test. Seven dm.* purposes, purpose-keyed fake-provider queues and the DmScript format added. docker build ok. The DB suite passes 508 server tests; ci:check green.
The orchestrator verified that NOTICE.md contains tabletop-dm's LICENSE at fe2c29b verbatim (MIT, Copyright (c) 2026 Brad Bush).
Carried to Phase 5: the boot-time missingDmPurposes check still needs wiring.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 3 by sonnet-implementer: dd3d8e5. Adds the node seam plus the assemble, director, interpret and adjudicate nodes. Prompts are built for dm.director, dm.interpret and dm.adjudicate, and the doctrine guard now runs non-vacuously. The server suite passes 572 tests, including the adjudicate DB integration; ci:check green.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 4 by sonnet-implementer: 9550955. resolve is the only gate.submit caller; it steps from engine events only and takes job markers on replay. narrate writes digit-free prose from code-built facts. audit runs seven deterministic checks plus dm.audit, at most 3 attempts, and on failure ships a fallback with a dm journal flag. The server suite passes 624 tests; ci:check green.
Carried to Phase 5: the worker fills TurnJobRef.start from the job input, and createDmEnqueuer enqueues on approval (T058/T071).
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 5 by sonnet-implementer: 2ba24e0. Adds the worker, the enqueuer (on commit, and on approval or rejection of an ai:dm proposal), companion and chronicle jobs, /dm routes, and a dm/ Biome boundary (17/17 fixtures). All four carried items are closed: TurnJobRef.start, the approval enqueue, the FR-012 abandoned-job notice, and the boot check for missing purposes. The server suite passes 645 tests; ci:check green.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Phase 6 by sonnet-implementer: 40b6ea0. Merge condition met: one full turn on the worktree stack, fake gateway, scripted dice. Four model calls (director, interpret, narrate, audit); 1 roll, 1d20 = 14 against DC 13, a success; audit passed on attempt 1. Evidence: specs/031-dm-runtime/evidence/full-turn.json.
The full-scene, reclaim and beat suites pass. The suite found and fixed a double tracker advance on reclaim. The server suite passes 650 tests; ci:check green. Every tasks.md box is ticked.
Open finding: a crash inside submitNarration, after the row lands and before the checkpoint save, appends a second narration on reclaim. The orchestrator rules it be fixed in-task, not carded.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Reclaim fix by sonnet-implementer: 13101f0. On reclaim the runner detects a landed ai:dm narration above the turn's lastSeq, then skips narrate and audit. That is sound because only one turn job runs per session. A new crash test asserts one narration and a log equal to the uninterrupted run. Merged origin/main in 050b496 with no migration conflict. The server suite passes 651 tests; ci:check green.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Wiki re-ground by sonnet-implementer: 23c5921. New notes dm-runtime and dm-turn-jobs. Of the 19 stale notes, 14 were amended and 5 re-pinned only after reading their diffs. Freshness OK, 44 notes.
Dispatch: tier=sonnet pinned=claude-sonnet-5-5 served=claude-sonnet-5-5

Merged in PR #49 on 2026-10-26. Card ACs #1–#15 are proven by specs/031-dm-runtime/ci-evidence.txt and evidence/full-turn.json.

spec-bridge sync: The jobs queue for DM jobs (US4, US8; AC #1, #9): 8/8 · Seed, doctrine, purposes and scripts (US1, US3; AC #4, #13, #14, #15): 11/11 · Node seam and the planning nodes (US1, US3, US6; AC #2, #3, #11): 12/12 · Resolve, narrate and audit (US1, US2, US3, US8; AC #5, #6, #7, #8): 10/10 · Worker, actors and routes (US4, US5, US7; AC #1, #5, #10, #12): 9/9 · Merge condition and the full gate (all stories; AC #1, #2, #4, #8, #9, #15): 8/8 — status In Progress → Done
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All spec tasks complete (The jobs queue for DM jobs (US4, US8; AC #1, #9): 8/8 · Seed, doctrine, purposes and scripts (US1, US3; AC #4, #13, #14, #15): 11/11 · Node seam and the planning nodes (US1, US3, US6; AC #2, #3, #11): 12/12 · Resolve, narrate and audit (US1, US2, US3, US8; AC #5, #6, #7, #8): 10/10 · Worker, actors and routes (US4, US5, US7; AC #1, #5, #10, #12): 9/9 · Merge condition and the full gate (all stories; AC #1, #2, #4, #8, #9, #15): 8/8). Derived Done by spec-bridge sync.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 All tests and checks run green
- [x] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
