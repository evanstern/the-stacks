# Implementation Plan: AI Gateway — First Slice

**Branch**: `task-0023-ai-gateway` | **Date**: 2026-09-28 (revised for decision-0007) | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/011-ai-gateway/spec.md`

## Summary

Add `apps/server/src/ai/`: one `Gateway` with two operations, `chat()` (async-iterable stream
of text pieces ending in a usage summary) and `embed()` (batch of 1024-length labeled
vectors). Providers are **named config entries** (`AI_PROVIDERS`) with an adapter kind, base
URL, and optional key-variable name; purposes (`AI_PURPOSES`) map to a provider name and a
model. Two adapter kinds this slice: `openai-compatible` (stdlib `fetch`; streaming
`/chat/completions` over SSE and `/embeddings`) and `fake`. The gateway owns SSE parsing,
error mapping, and bounded retry. Every call emits one usage record to an injected sink.
No vendor SDK; no new dependency.

## Technical Context

**Language/Version**: TypeScript, Node 22 (native `fetch`, `AbortController`, `TextDecoderStream`)

**Primary Dependencies**: existing `zod` only. **No new dependency** (decision-0007).

**Storage**: none this slice (usage records go to a sink; research R4)

**Testing**: vitest; adapters tested against an injected `fetch` double; no network, no keys

**Target Platform**: the existing server process

**Project Type**: web service module

**Performance Goals**: gateway overhead negligible next to provider latency; embed batches split at a per-purpose `batchSize` (default 128)

**Constraints**: no new container or service; one seam for all model calls (IX); no provider name in source

**Scale/Scope**: ~7 source files, ~6 test files

## Constitution Check

*Re-run 2026-09-28 after the decision-0007 revision.*

- [x] **I. Agent-operable** — the `Gateway` interface is the agent-facing seam. Agents
      (TASK-0027 onward) call `gateway.chat({purpose, ...})` exactly as any feature does. No
      human-only path; the gateway has no UI.
- [x] **II. Content contract** — N/A: no codex entity is created.
- [x] **III. Data planes** — the gateway holds no plane state. It lives in
      `apps/server/src/ai/`, outside the three plane directories, so any plane may import it
      without a cross-plane edge. Usage records are operational telemetry, not plane state.
- [x] **IV. Event sourcing** — N/A: no play state changes.
- [x] **V. Citations** — caller content passes through unaltered (CR-003); citation
      enforcement is TASK-0027's. No retrieval change, so no eval fixtures owed.
- [x] **VI. System-agnostic** — no game mechanics.
- [x] **VII. Structured first** — N/A: no generated assets. Usage records carry provider
      name and model, which A8's provenance rule will reuse.
- [x] **VIII. Operator-owned content** — library text goes only to providers the operator
      declared; the gateway never persists prompt or completion text (FR-011).
- [x] **IX. Self-hostable** — this is the single model seam IX requires. Keys are BYO, named
      per provider. A local model is an `openai-compatible` provider entry with no key — a
      config entry, never a code change. Strengthened by decision-0007: no vendor is privileged.

**Stack conformance** — within the table. No new dependency, service, language, or datastore.

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
├── gateway.ts            # purpose routing, dim check, batching, retry wrapper, usage emission
├── types.ts              # ChatRequest, ChatEvent, EmbedResult, UsageRecord, Provider, UsageSink
├── config.ts             # AI_PROVIDERS / AI_PURPOSES / AI_PRICES (Zod), cross-validation, key lookup
├── usage.ts              # cost computation, logSink, memorySink
├── sse.ts                # SSE line parser over a fetch response body
├── retry.ts              # bounded exponential backoff with jitter, Retry-After, abort-aware sleep
└── adapters/
    ├── openai-compatible.ts  # chat: POST /chat/completions stream; embed: POST /embeddings
    └── fake.ts               # scripted chat/embed/failure for tests

apps/server/test/
├── ai.config.test.ts
├── ai.usage.test.ts
├── ai.sse.test.ts
├── ai.retry.test.ts
├── ai.gateway.test.ts
└── ai.openai-compatible.test.ts   # fetch double: SSE chat, embeddings, error mapping, retry
```

`apps/server/src/config.ts` gains an optional `ai` field populated by `ai/config.ts`;
`index.ts` constructs the gateway once. No route in this slice.

**Structure Decision**: one server module; no package split; `packages/shared` untouched.
Adapters are registered by kind in a small map in `gateway.ts`; a native `anthropic` kind
later is one new file plus one map entry.

## Complexity Tracking

None. (The earlier `@anthropic-ai/sdk` row is withdrawn: rejected by operator ruling
decision-0007.)
