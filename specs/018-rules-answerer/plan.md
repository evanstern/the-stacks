# Implementation Plan: Rules answerer

**Branch**: `task-0027-rules-answerer` | **Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/018-rules-answerer/spec.md`

## Summary

Add `POST /library/ask`: an operator's question in, a streamed, cited answer out, as
`text/event-stream` (decision-0004). `answer(deps, req)` in `apps/server/src/library/answer.ts`
retrieves passages with `retrieve()`, keeps the relevant ones (keyword hit, or vector similarity
at or above `ASK_MIN_SIMILARITY`), and refuses without a model call when none is relevant. It
streams the `answering` purpose's `chat()` through an incremental parser (`cite.ts`) that turns
inline `<cite p="N">quote</cite>` markers into citations. Each citation is verified against the
stored passage text, exactly or after whitespace and typography normalization, and invalid ones
are dropped and counted. The route is a thin `streamSSE` adapter. The UI contract is
`contracts/ask-sse.md`. No new dependency, no migration.

## Technical Context

**Language/Version**: TypeScript 5.x, Node 22 (existing server package)

**Primary Dependencies**: `hono` (incl. `hono/streaming`'s `streamSSE`), `zod`, the AI gateway,
`retrieve()`. All installed. **No new runtime dependency.**

**Storage**: none new. Reads library tables through `retrieve()` (spec 015). No migration.

**Testing**: vitest. `cite.test.ts` and `answer.test.ts` are pure (no DB): a stub `retrieve`
result feeds `answer()` through an injected seam. `ask.integration.test.ts` runs the real route
on a real Postgres with the loud-skip harness (`REQUIRE_DATABASE=1` makes a skip fail). All
model calls use the gateway's `fake` adapter with scripted chat events (research R7). Books are
seeded with `storeParsedBook`/`attachEmbeddings`, never through ingestion jobs (TASK-0033).

**Target Platform**: the existing two-container compose stack

**Project Type**: web service (server package only; the UI is TASK-0028)

**Performance Goals**: one retrieval plus one streamed chat call per question. First `delta`
latency equals the provider's first-token latency plus retrieval.

**Constraints**: every model call through the gateway under a named purpose (decision-0007,
constitution IX); quoted text only to the operator (constitution VIII); spans are UTF-16.

**Scale/Scope**: single tenant; one question per request; k ≤ 50 passages in the prompt.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* Re-checked after
Phase 1: all pass.

- [x] **I. Agent-operable** — agents call `answer(deps, req)` (contracts/answer.md) and receive
      the same `AnswerEvent` sequence the route writes. The route is a thin adapter over it.
- [x] **II. Content contract** — not applicable: no codex entity.
- [x] **III. Data planes** — code lives under `apps/server/src/library/` (library plane,
      read-only) and `routes/library.ts`. It imports the gateway (shared infrastructure) and
      `retrieve()`. No codex or session import; no write.
- [x] **IV. Event sourcing** — not applicable: library Q&A is not play state (decision-0004).
- [x] **V. Citations** — every citation carries book, section, exact quote, and span, verified
      against stored text (research R1); uncited answers are refused (`unverified`). Tests
      assert the slice round-trip for every emitted citation (SC-001) and that a scripted
      invented quote is dropped (SC-002). Retrieval evals stay with TASK-0029.
- [x] **VI. System-agnostic** — the prompt names no game system; it answers from passages.
- [x] **VII. Structured first** — the answer stream is typed events with a published contract;
      the prompt is versioned (`answer-v1`). No generated asset.
- [x] **VIII. Operator-owned content** — operator-only route (research R4); quotes come from
      the operator's own stored books; nothing quoted is logged or persisted. Test fixtures are
      original text written in the test.
- [x] **IX. Self-hostable** — no new container or dependency; the model is a config entry
      (`AI_PURPOSES.answering`); unset, the route returns `error{config}` and the server still
      boots.

**Stack conformance** — within the Architecture Constraints table. No amendment.

## Operator checkpoints

None. The auth decision (operator only) follows from constitution VIII and A9 (research R4).
The purpose name follows from `.env.example` (research R3). No new dependency (research R8).
The only guessed value, `ASK_MIN_SIMILARITY = 0.3`, is configurable and marked `ponytail:` for
calibration by TASK-0029.

## Project Structure

### Documentation (this feature)

```text
specs/018-rules-answerer/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── ask-sse.md      # UI-facing SSE contract (TASK-0028 builds against this)
│   └── answer.md       # module contract: answer(), cite parser, invariants
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/server/src/
├── library/
│   ├── cite.ts           # NEW: locateQuote, createCiteParser (pure)
│   └── answer.ts         # NEW: loadAnswerConfig, isRelevant, prompt, answer()
├── routes/library.ts     # EDIT: POST /ask via streamSSE; options gain answer deps
├── app.ts                # EDIT: thread optional answer deps into createLibraryRoutes
└── index.ts              # EDIT: loadAnswerConfig at boot; pass gateway + configs to createApp
.env.example              # EDIT: ASK_MIN_SIMILARITY; note the `answering` purpose

apps/server/test/library/
├── cite.test.ts                  # NEW (pure)
├── answer.test.ts                # NEW (pure; fake gateway, stubbed retrieval)
└── ask.integration.test.ts       # NEW (real DB, real route, fake provider)

docs/wiki/rules-answerer.md       # NEW note
```

**Structure Decision**: server package only, beside `retrieve.ts`. `answer()` takes an optional
`retrieve` function in its deps (defaulting to the real one) so pure tests can script retrieval
results without a database.

## Complexity Tracking

No violations.
