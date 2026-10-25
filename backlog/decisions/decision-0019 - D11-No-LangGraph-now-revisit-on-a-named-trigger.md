---
id: decision-0019
title: D11 No LangGraph now; revisit on a named trigger
date: '2026-10-25'
status: accepted
---
## Context

LangGraph (LangGraph.js for our TypeScript stack) is a common framework for agent graphs. It
offers `StateGraph`, human-in-the-loop `interrupt()`, durable checkpointers (including
`@langchain/langgraph-checkpoint-postgres`) and run scheduling. The session asked whether the
DM runtime should be built on it.

Facts checked on 2026-10-25 against current sources:
- `StateGraph` and `interrupt()` are imported from `@langchain/langgraph`. `interrupt()`
  requires a checkpointer and a `thread_id`; a run resumes with `new Command({ resume })`
  (docs.langchain.com, LangGraph JavaScript "Interrupts").
- `@langchain/langgraph` 1.5.2 lists `@langchain/core` (^1.1.48) as a peer dependency (npm
  registry).
- `@langchain/langgraph-checkpoint-postgres` 1.1.2 depends on `pg` and lists
  `@langchain/core` as a peer dependency (npm registry).

## Decision

Do **not** adopt LangGraph now. Revisit on a named trigger.

**Rationale.**
- Its checkpointer duplicates the event log: a second copy of state.
- `interrupt()` duplicates proposals-as-events. Ours are visible to clients, filtered per
  viewer and restart-safe through the log.
- Its run scheduling duplicates the jobs queue.
- decision-0007 (no vendor SDK) pulls against the LangChain model layer that
  `@langchain/core` brings.
- Our turn is a pipeline with two conditional branches (adjudicate or not; regenerate on
  audit failure), not a dynamic graph.

**Seam:** nodes are plain async functions `(TurnContext) -> NodeResult` (decision-0017), which
a `StateGraph` could wrap later.

**Trigger:** the second agent graph lands (campaign prep: NPC-smith or the encounter builder,
in the Codex milestone), or any node needs dynamic routing among more than two branches or a
cycle.

## Consequences

- Revisit card: TASK-0054 (milestone m-4). milestones.md gates the M4 Codex milestone's first
  agent task on it.
- No LangChain package enters the dependency tree before that card is decided.

## Alternatives

Adopt LangGraph.js now for the DM runtime, with its Postgres checkpointer. Rejected for the
duplication reasons above; the seam keeps it reachable.
