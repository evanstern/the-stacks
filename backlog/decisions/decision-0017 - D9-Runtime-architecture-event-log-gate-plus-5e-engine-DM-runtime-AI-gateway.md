---
id: decision-0017
title: >-
  D9 Runtime architecture: event log, gate plus 5e engine, DM runtime, AI
  gateway
date: '2026-10-25'
status: accepted
---
## Context

Architecture A4 made sessions event-sourced with the AI DM as "just another actor", and A7
defined agents as tool-loops over the AI gateway. Neither said where an LLM may touch state,
how a DM turn is scheduled, or how narration is kept honest against the dice. tabletop-dm's
key lesson (doc-0004): the script owns numbers, the LLM owns story.

## Decision

Four layers; only one holds an LLM.

1. **Session event log** (built, M0): the only source of truth. Scene, party, encounter and
   journal are projections.
2. **Gate plus 5e engine** (no LLM): the engine is a pure function
   `(state, command, rng) -> events | refusal`, Zod-typed, seeded RNG, scripted-dice tests.
   The gate wraps it with the decision-0015 policies and decision-0016 commit authority.
   Refuse before write.
3. **DM runtime:** an actor like any player. A committed action enqueues a **turn job** on
   the existing Postgres jobs queue (claim, lease and fencing, from ingestion). The job runs:
   `assemble` (no LLM: projections, recent log, codex neighbours) then `director` then
   `interpret` (intent; roll needed? combat? rules question?) then `adjudicate` (when needed:
   LLM plus library retrieval, giving a cited ruling) then `resolve` (proposals to the gate,
   giving dice and events) then `narrate` (tells only what resolve produced) then `audit`
   (checks plus a cheap LLM: narration agrees with the ledger; on failure regenerate and
   flag, never ship silently). `chronicle` runs off the hot path: journal and codex updates,
   also as proposals.
4. **AI gateway** (built, decision-0007): every node names a purpose (`dm.director`,
   `dm.interpret`, `dm.adjudicate`, `dm.narrate`, `dm.audit`, `dm.chronicle`,
   `dm.companion`); model choice and cost accounting stay in config.

Nodes are plain async functions `(TurnContext) -> NodeResult`; this is the seam
decision-0019 relies on.

**Ordering is the anti-cheat:** dice resolve before narration; the narrator receives results
as facts.

**Rationale.** Keeping the LLM out of layers 1 and 2 makes every number auditable and every
illegal move refusable. Reusing the jobs queue gives turns crash recovery and single-owner
execution for free. A fixed pipeline order replaces "please do not invent rolls" prompting
with a structural guarantee.

## Consequences

- Extends architecture A4 (event-sourced sessions) and supersedes A7's "agents as tool-loops"
  for the DM: the DM is a pipeline of nodes, not one tool loop. A7's gateway, purposes and
  cost accounting stand.
- In M2 `assemble` reads a scene seed instead of codex neighbours (decision-0009); M4 adds
  codex neighbours.
- Cards: TASK-0042 (engine), TASK-0044 (session model), TASK-0045 (gate),
  TASK-0046 (DM runtime).
