---
id: decision-0015
title: 'D7 The proposal gate and the autonomy dial (auto, ask, suggest)'
date: '2026-10-25'
status: accepted
---
## Context

The operator wants both goal 3 (the AI runs the game) and goal 4 (the AI assists a human DM).
The old ladder built them as two products in sequence. An LLM writing state directly would
make neither safe: it could invent rolls, skip rules or leak hidden information.

## Decision

Every LLM output is a **typed (Zod) proposal**, never a direct write. The gate applies a
policy per proposal kind:

- `auto`: apply immediately. The AI DM runs the game.
- `ask`: append `proposal.created`, visible to the DM only; apply on `proposal.approved`.
- `suggest`: show it; the DM issues their own command.

A human DM's own commands go through the same engine, already approved. Pending proposals
live in the event log, so they survive restarts and are filtered per viewer.

**Rationale.** One mechanism serves goal 3 and goal 4; the policy table is the autonomy dial.
Proposals as events reuse the log's ordering, replay and visibility instead of adding a
second store.

## Consequences

- Extends architecture A4: the server validates through the gate and the 5e engine before it
  appends. Constitution IV's "validate against the active system module" becomes "validate
  through the gate and the 5e engine" (constitution 2.0.0).
- Player actions use the same gate with a sign-off policy (decision-0016).
- V1 ships both ends of the dial (M7).
- Card: TASK-0045.
