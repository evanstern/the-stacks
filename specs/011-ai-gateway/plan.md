# Implementation Plan: AI Gateway — First Slice

**Branch**: `task-0023-ai-gateway` | **Date**: 2026-09-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/011-ai-gateway/spec.md`

## Summary

Add `apps/server/src/ai/`: one `Gateway` with two operations, `chat()` (async-iterable stream
of text pieces ending in a usage summary) and `embed()` (batch of 1024-length labeled
vectors). Purposes map to a provider and model through a JSON env var validated by Zod at
startup. Three providers: Anthropic chat via `@anthropic-ai/sdk`, OpenAI-compatible
embeddings via stdlib `fetch`, and a scriptable fake for tests. Every call emits one usage
record to an injected sink; this slice ships a log sink and an in-memory sink, no table.

## Technical Context

**Language/Version**: TypeScript, Node 22 (native `fetch`, `AbortController`)

**Primary Dependencies**: existing `zod`; **new: `@anthropic-ai/sdk`** (operator checkpoint, see research R2)

**Storage**: none this slice (usage records go to a sink; see research R4)

**Testing**: vitest, fake provider only; no network, no keys

**Target Platform**: the existing server process

**Project Type**: web service module

**Performance Goals**: gateway overhead negligible next to provider latency; embed batches split at a configurable size (default 128)

**Constraints**: no new container; no new service; one seam for all model calls (IX)

**Scale/Scope**: single-tenant; ~6 source files, ~6 test files

## Constitution Check

- [x] **I. Agent-operable** — the `Gateway` interface is the agent-facing seam. Agents
      (TASK-0027 onward) call `gateway.chat({purpose, ...})` exactly as any feature does.
      No human-only path exists; the gateway has no UI.
- [x] **II. Content contract** — N/A: no codex entity is created.
- [x] **III. Data planes** — the gateway holds no plane state. It lives in
      `apps/server/src/ai/`, outside the three plane directories, so every plane can import
      it without a cross-plane edge. Usage records are operational telemetry, not plane state.
- [x] **IV. Event sourcing** — N/A: no play state changes.
- [x] **V. Citations** — the gateway passes caller content through unaltered (CR-003);
      citation enforcement is TASK-0027's. No retrieval change here, so no eval fixtures owed.
- [x] **VI. System-agnostic** — no game mechanics.
- [x] **VII. Structured first** — N/A: no generated assets. (Usage records carry provider
      and model, which A8's "store prompt, provider, seed" rule will reuse later.)
- [x] **VIII. Operator-owned content** — library text goes only to operator-configured
      providers; the gateway never persists prompt or completion text (FR-011).
- [x] **IX. Self-hostable** — this *is* the single model seam IX requires. Keys are BYO via
      env. A local model becomes an `openai-compatible` purpose entry, no code change.

**Stack conformance** — stays within the table. One new npm dependency (the official
Anthropic SDK) inside the existing Node process; no new service, language, or datastore.

## Project Structure

### Documentation (this feature)

```text
specs/011-ai-gateway/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/gateway.md
└── tasks.md
```

### Source Code

```text
apps/server/src/ai/
├── gateway.ts            # Gateway: purpose routing, dim check, batching, usage emission
├── types.ts              # ChatRequest, ChatEvent, EmbedResult, UsageRecord, Provider
├── config.ts             # AI_PURPOSES / AI_PRICES parsing (Zod), key presence checks
├── usage.ts              # cost computation, logSink, memorySink
└── providers/
    ├── anthropic.ts      # chat via @anthropic-ai/sdk messages.stream
    ├── openai-compatible.ts  # embeddings via fetch POST {baseUrl}/embeddings
    └── fake.ts           # scripted chat/embed/failure for tests

apps/server/test/
├── ai.gateway.test.ts
├── ai.config.test.ts
├── ai.usage.test.ts
├── ai.anthropic.test.ts          # translation tested with an injected fake SDK stream
└── ai.openai-compatible.test.ts  # translation tested with an injected fetch
```

`apps/server/src/config.ts` gains an optional `ai` field populated by `ai/config.ts`;
`index.ts` constructs the gateway once. No route is added in this slice.

**Structure Decision**: one server module; no package split. `packages/shared` is untouched
(nothing here crosses to the web client).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| New dependency `@anthropic-ai/sdk` | Streaming, typed errors, retries, `finalMessage()` usage, and API drift tracking for the chat provider | Hand-rolled `fetch` + SSE parser: ~150 lines to own, loses typed errors and retry semantics, and must be re-verified on every API change. Operator decides at checkpoint. |
