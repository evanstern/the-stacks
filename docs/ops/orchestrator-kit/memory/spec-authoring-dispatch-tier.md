---
name: spec-authoring-dispatch-tier
description: "In a sweep, dispatch spec authoring (speckit specify/plan/tasks) to opus-implementer, never to a fork of the orchestrator session."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 7bc214b1-094e-4686-abdf-fc65c6cc777c
  modified: 2026-09-29T09:49:08.256Z
---

Spec authoring is dispatched work, like implementation. Send it to `opus-implementer`
(pinned `cc/claude-opus-5-5[1m]`), not to a `fork` of the orchestrator session.

**Why:** operator ruling 2026-09-29, after the M1 wave-1 sweep. Specs were written by
session forks, which inherit the orchestrator's whole context. Four specs cost ~1.6M
tokens against ~3.8M for all sonnet implementation. The operator wants a high-reasoning
model for specs (Opus 5.5 is the right tier), but through a pinned dispatch with a lean
prompt, not a context-inheriting fork. A fork also leaves no `Dispatch:` line, so the
spend is invisible on the board.

**How to apply:** in the runbook, name the spec-authoring tier per task (default opus).
Dispatch `opus-implementer` with the card id, the spec dir, and the decision docs to read.
Verify `served=` from the transcript and record a `Dispatch:` line, as for implementation.
Upstream card: praxisflux TASK-0135 (pdlc:sweep step 3). Related: [[pr-merge-order-follows-green]].
