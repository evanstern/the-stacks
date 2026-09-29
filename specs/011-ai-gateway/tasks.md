---

description: "Task list for spec 011 — AI gateway first slice (revised for decision-0007)"
---

# Tasks: AI Gateway — First Slice

**Input**: `specs/011-ai-gateway/` — spec.md, plan.md, research.md, data-model.md, contracts/gateway.md

**Tests**: required — spec US6 and SC-004 make the no-key suite a deliverable.

**Dependencies**: none new (decision-0007).

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Foundational — types, config, usage, fake

**Purpose**: everything every story needs. Blocks all later phases.

- [x] T001 Create `apps/server/src/ai/types.ts` with `ProviderConfig`, `PurposeConfig`, `ChatRequest`, `ChatEvent`, `EmbedResult`, `UsageRecord`, `Provider`, `AdapterFactory`, `UsageSink` per data-model.md and contracts/gateway.md
- [x] T002 [P] Create `apps/server/src/ai/config.ts`: Zod-parse `AI_PROVIDERS`, `AI_PURPOSES`, `AI_PRICES`; cross-validate (undeclared provider, unsupported op, unset `apiKeyEnv` for a used provider); unset `AI_PURPOSES` → no purposes (research R5)
- [x] T003 [P] Create `apps/server/src/ai/usage.ts`: `computeCost` keyed `"<provider>/<model>"` (null when unpriced), `logSink`, `memorySink`
- [x] T004 [P] Create `apps/server/src/ai/adapters/fake.ts`: scripted chat events, deterministic hash-derived embeddings, injectable failures, request recording (research R6)
- [x] T005 Tests `apps/server/test/ai.config.test.ts` and `apps/server/test/ai.usage.test.ts`: contract invariant 8; malformed JSON names the variable; unpriced → null

**Checkpoint**: config and usage are testable in isolation.

## Phase 2: US1 + US3 + US4 — streaming chat through the gateway (P1) 🎯 MVP

- [ ] T006 Create `apps/server/src/ai/gateway.ts` `chat()`: adapter registry by kind, purpose → named provider, pass `signal`, exactly one terminal event, exactly one usage record per call
- [ ] T007 Tests in `apps/server/test/ai.gateway.test.ts` (fake adapter, two arbitrarily named providers) for invariants 1, 2, 3, 6, 7 and spec US1 #1–#4, US3 #1, US4 #1–#3

**Checkpoint**: a caller can stream a chat answer through the fake with usage recorded.

## Phase 3: US2 — embeddings through the gateway (P1)

- [ ] T008 Add `embed()` to `apps/server/src/ai/gateway.ts`: split by the purpose's `batchSize` (default 128), order preserved, any length ≠ 1024 rejects the whole call, empty input short-circuits with no usage record
- [ ] T009 Tests in `apps/server/test/ai.gateway.test.ts` for invariants 4 and 5 and spec US2 #1–#3, including a split batch

## Phase 4: US5 + US1 + US2 — gateway-owned HTTP: SSE, retry, OpenAI-compatible adapter (P1)

- [ ] T010 [P] Create `apps/server/src/ai/sse.ts`: parse a fetch response body into `data:` payloads; blank-line framing; multi-line `data:`; ignore comments; stop at `[DONE]`; report a stream that ends without `[DONE]` (research R3)
- [ ] T011 [P] Create `apps/server/src/ai/retry.ts`: bounded attempts, exponential backoff with full jitter and cap, `Retry-After` seconds/HTTP-date override, abort-aware sleep, injectable clock (research R8)
- [ ] T012 Tests `apps/server/test/ai.sse.test.ts` and `apps/server/test/ai.retry.test.ts`: chunk boundaries split mid-line, `[DONE]`, truncated stream; retry on 429/5xx/network, none on 400/401/403, `Retry-After`, abort during backoff; no real waiting
- [ ] T013 Create `apps/server/src/ai/adapters/openai-compatible.ts`: chat via `POST {baseUrl}/chat/completions` (`stream: true`, `stream_options.include_usage`), content deltas → `text`, final usage chunk → `done`, `content_filter` → `refusal`; embeddings via `POST {baseUrl}/embeddings` (`dimensions: 1024`, sort by `index`, `usage.prompt_tokens`); `Authorization: Bearer` only when `apiKeyEnv` is set; HTTP → error kinds per research R7; requests wrapped in `retry.ts`, never after first output
- [ ] T014 Test `apps/server/test/ai.openai-compatible.test.ts` against a `fetch` double: request bodies and headers, SSE translation, usage, content filter, error mapping, retry-then-success yields one usage record with `attempts`, no retry after first text, keyless provider sends no auth header (invariant 9)

## Phase 5: US6 + wiring — no-key test run and startup

- [ ] T015 Wire `apps/server/src/config.ts` (optional `ai` field) and `apps/server/src/index.ts` (construct the gateway once with `logSink`); unset AI env → server starts exactly as today
- [ ] T016 Test (in `apps/server/test/ai.gateway.test.ts`) that no provider name, vendor name, or key variable name appears in `apps/server/src/ai/` (invariant 10)
- [ ] T017 [P] Add the contracts/gateway.md `.env.example` block verbatim to `.env.example`
- [ ] T018 Run `pnpm ci:check` with no AI env set; record output in the PR body (SC-004)

## Phase 6: Polish & re-ground

- [ ] T019 Wiki: add an `ai-gateway` note; review `configuration` and `server-entrypoint-and-app` (NEEDS-REVIEW per runbook); `gates/cli.mjs freshness` prints `OK`
- [ ] T020 Tick this file and run `spec-bridge:sync` after merge

## Dependencies & Execution Order

- Phase 1 blocks all. Phase 2 before Phase 3 (same file). Phase 4 needs only Phase 1 and may run beside Phases 2–3. Phase 5 after 2–4. Phase 6 last.

## Implementation Strategy

One implementer per phase. No phase waits on an operator ruling.
