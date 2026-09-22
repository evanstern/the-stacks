---
id: decision-1
title: the-stacks v2 foundational design ratified
date: '2026-09-22 01:12'
status: accepted
---
## Context

the-stacks v2 is a greenfield rebuild of a RAG-focused TTRPG project, pivoting toward an
automated DM. A design session on 2026-09-21 (operator + Claude) worked from the operator's
free-form use cases through four rounds of structured questions, producing three companion
documents:

- [vision.md](../../docs/design/vision.md) - what this is, posture, use cases, non-goals
- [architecture.md](../../docs/design/architecture.md) - decisions A1-A9
- [milestones.md](../../docs/design/milestones.md) - M0 to V1 ladder

The session ended abnormally: the operator approved the final ratification round at
2026-09-22T01:00Z, but the session died before applying those answers (an unresolvable model
id, then an auth failure). The approval therefore existed only in a dead transcript. This
record makes it durable.

## Decision

The operator ratified all three open items **as proposed**:

1. **Stack (architecture A1)** - TypeScript end-to-end. One Node process (Hono + WebSocket),
   React SPA + PixiJS tabletop, Postgres 17 for everything (relational, pgvector, job queue,
   event log), two containers. No Python in V1; it enters later only as an optional sidecar
   behind the provider seam.
2. **System-agnosticism (architecture A6)** - system-agnostic core behind a system-module
   interface. Ships `dnd5e` at full depth plus `fate-core` as a deliberately alien
   conformance module held to interface depth, both exercised in CI.
3. **Milestone ladder (milestones.md)** - M0 Skeleton, M1 Library, M2 Codex,
   M3 Sheets & Systems, M4 The Table, M5 Maps & Media, M6 Assisted Table = V1.
   Auto-DM is post-V1 (M7-M9).

Earlier rounds in the same session, already reflected in vision.md, settled: greenfield
rebuild (no v1 code carried forward); V1 = assisted table; BYO cloud LLM key; own minimal
VTT; structured-core rules depth; event-sourced sessions; structured-first map generation;
maps and portraits both core for V1; public self-hosters as the audience; aggressive cadence.

## Consequences

- The three design documents are the plan of record and move from proposed to ratified.
- M0 is carded onto the board and is immediately sweepable; later milestones are carded as
  they are reached, since each milestone closes with a re-grounding pass that informs the next.
- Reopening a ratified item requires a new decision record superseding this one, not an edit
  to the design documents.
- Architecture A1's stack choices are binding on M0, which exists to prove exactly those seams.
