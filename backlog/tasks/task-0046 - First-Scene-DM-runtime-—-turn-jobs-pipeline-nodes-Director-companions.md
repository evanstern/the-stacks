---
id: TASK-0046
title: 'First Scene: DM runtime — turn jobs, pipeline nodes, Director, companions'
status: In Progress
assignee: []
created_date: '2026-10-25 19:59'
updated_date: '2026-10-26 05:07'
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
- [ ] #1 A committed action enqueues a turn job on the jobs queue, using its claim, lease and fencing.
- [ ] #2 The turn job runs assemble, director, interpret, adjudicate when needed, resolve, narrate and audit, in that order.
- [ ] #3 Each node is a plain async function from TurnContext to NodeResult.
- [ ] #4 Every LLM call names one gateway purpose: dm.director, dm.interpret, dm.adjudicate, dm.narrate, dm.audit, dm.chronicle or dm.companion.
- [ ] #5 Resolve turns node output into proposals and sends them through the gate; no other node writes state.
- [ ] #6 Narrate receives resolved results as facts and never calls the engine or the dice.
- [ ] #7 Audit regenerates and flags narration that disagrees with the roll ledger, and never ships a mismatch silently.
- [ ] #8 The Director sets the scene goal, runs secret trackers, switches table modes and decides when a beat resolves.
- [ ] #9 Actions committed during a resolving turn queue into the next beat and resolve in log sequence order.
- [ ] #10 AI companions declare and commit actions through the same gate path as a human player.
- [ ] #11 Adjudicate calls the M1 retrieval and returns a cited ruling.
- [ ] #12 Chronicle runs off the hot path and writes journal updates as proposals.
- [ ] #13 The runtime loads a Zod-validated scene seed file.
- [ ] #14 Doctrine prompts adapted from tabletop-dm carry an MIT attribution notice.
- [ ] #15 Tests run a full turn against the fake gateway adapter with scripted dice.
- [ ] #16 Spec phase: The jobs queue for DM jobs (US4, US8; AC #1, #9)
- [ ] #17 Spec phase: Seed, doctrine, purposes and scripts (US1, US3; AC #4, #13, #14, #15)
- [ ] #18 Spec phase: Node seam and the planning nodes (US1, US3, US6; AC #2, #3, #11)
- [ ] #19 Spec phase: Resolve, narrate and audit (US1, US2, US3, US8; AC #5, #6, #7, #8)
- [ ] #20 Spec phase: Worker, actors and routes (US4, US5, US7; AC #1, #5, #10, #12)
- [ ] #21 Spec phase: Merge condition and the full gate (all stories; AC #1, #2, #4, #8, #9, #15)
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
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 All tests and checks run green
- [ ] #2 All acceptance criteria are met or explicitly bypassed with notes
<!-- DOD:END -->
