# Implementation Plan: DM calls survive a leading think block

**Branch**: `task-0181-think-block` | **Date**: 2026-10-29 | **Spec**: [spec.md](spec.md)
**Input**: `specs/063-think-block/spec.md`

## Summary

Hosted-dev DM replies arrive as `<think></think>` plus JSON, or as `<think></think>` alone after
hidden thinking spends the whole output cap (research R1, R4). The fix has two parts (OQ-1 (a)).
In code, a pure `stripThink` in `dm/pipeline/call.ts` removes leading think blocks before the
fence strip and the JSON parse, and from narrate's prose. At the source, an orchestrator probe
on vm-104 confirms the cause and picks the router or config change, under the operator's go.

## Technical Context

**Language/Version**: TypeScript, Node 22
**Primary Dependencies**: none new (Zod, vitest already installed)
**Storage**: none. No migration.
**Testing**: vitest, `apps/server/test/dm/call.test.ts`, fake gateway only
**Target Platform**: the server process (DM worker)
**Project Type**: web service
**Performance Goals**: a hosted-dev turn back to 10–21 s and $0.04–0.08 (run 2 clean turns)
**Constraints**: no paid model call in tests; vm-104 and vm-103 changes only under the operator's go
**Scale/Scope**: one source file, one test file, docs

## Files touched

| File | Change |
|---|---|
| `apps/server/src/dm/pipeline/call.ts` | add exported `stripThink`; use it in `parseAgainst` and `callText` |
| `apps/server/test/dm/call.test.ts` | think-block cases (tests first) |
| `specs/031-dm-runtime/contracts/node-seam.md` | one "Amended by" line pointing at `contracts/think-strip.md` |
| `specs/063-think-block/evidence/probe.md` | probe record (orchestrator) |
| `specs/063-think-block/evidence/mutation-guard.md` | mutation guard record |
| `specs/063-think-block/evidence/hosted-check.md` | AC #4 record (orchestrator) |
| `docs/wiki/dm-runtime.md`, `docs/wiki/dm-failure-and-gates.md`, `docs/wiki/debug-view.md`, `docs/wiki/ai-gateway.md` | re-pin; prose where the parse order is described |
| `docs/wiki/CAPSULES.md`, `docs/wiki/INDEX.md` | upkeep |

No migration. No new runtime dependency. No change to `apps/server/src/ai/`.

## Constitution Check (2.0.0)

- [x] **I. Agent-operable**: the strip runs inside `callJson`/`callText`, which every DM node
      already uses. No human step.
- [x] **II. Content contract**: no codex entity. N/A.
- [x] **III. Data planes**: no new state. The ledger stays text-free (OQ-2 (a)).
- [x] **IV. Event sourcing**: no event type changes. A turn that now parses commits the same
      events through the gate.
- [x] **V. Citations**: no library claim. The answerer is not changed (OQ-3 (a)).
- [x] **VI. 5e engine boundary**: no number moves. The strip removes text before the parse;
      the engine still owns every number.
- [x] **VII. Structured first**: model output is still Zod-validated data before use. The strip
      narrows what reaches the parse; it never relaxes a schema.
- [x] **VIII. Operator-owned content**: no rulebook content. N/A.
- [x] **IX. Self-hostable**: model access stays behind the gateway seam. No container.

**Stack conformance**: TypeScript in the one Node process. No departure.

## Project Structure

```text
specs/063-think-block/
├── spec.md
├── plan.md
├── research.md
├── quickstart.md
├── contracts/think-strip.md
├── checklists/requirements.md
├── evidence/            # probe.md, mutation-guard.md, hosted-check.md (written in tasks)
└── tasks.md
```

**Structure Decision**: the change stays in `apps/server/src/dm/pipeline/call.ts`. No new file.

No `data-model.md`: the feature adds no entity and no field.

## Complexity Tracking

None.
