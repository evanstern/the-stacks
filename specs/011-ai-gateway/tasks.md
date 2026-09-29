---

description: "Task list for spec 011 — AI gateway first slice"
---

# Tasks: AI Gateway — First Slice

**Input**: `specs/011-ai-gateway/` — spec.md, plan.md, research.md, data-model.md, contracts/gateway.md

**Tests**: required — spec US5 and SC-004 make the fake-provider suite a deliverable.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Foundational — types, config, fake, usage

**Purpose**: everything every story needs. Blocks all later phases.

- [ ] T001 Create `apps/server/src/ai/types.ts` with `ChatRequest`, `ChatEvent`, `EmbedResult`, `UsageRecord`, `Provider`, `UsageSink` per data-model.md and contracts/gateway.md
- [ ] T002 [P] Create `apps/server/src/ai/config.ts`: Zod-parse `AI_PURPOSES` and `AI_PRICES`; check provider keys for used providers; unset `AI_PURPOSES` → no purposes (research R5)
- [ ] T003 [P] Create `apps/server/src/ai/usage.ts`: `computeCost` (null when unpriced), `logSink`, `memorySink`
- [ ] T004 [P] Create `apps/server/src/ai/providers/fake.ts`: scripted chat events, deterministic hash-derived embeddings, injectable failures, request recording (research R6)
- [ ] T005 Tests `apps/server/test/ai.config.test.ts` and `apps/server/test/ai.usage.test.ts`: malformed mapping fails naming the entry; missing key for a used provider fails; unpriced → null cost

**Checkpoint**: config and usage are testable in isolation.

## Phase 2: User Story 1 + 3 + 4 — streaming chat through the gateway (P1) 🎯 MVP

- [ ] T006 Create `apps/server/src/ai/gateway.ts` `chat()`: resolve purpose, delegate to provider, pass `signal`, guarantee exactly one terminal event, emit exactly one usage record per call
- [ ] T007 Tests in `apps/server/test/ai.gateway.test.ts` (fake provider) for contract invariants 1, 2, 3, 6, 7 and spec US1 #1–#4, US3 #1, US4 #1–#3

**Checkpoint**: a caller can stream a chat answer through the fake with usage recorded.

## Phase 3: User Story 2 — embeddings through the gateway (P1)

- [ ] T008 Add `embed()` to `apps/server/src/ai/gateway.ts`: batch split by `EMBEDDINGS_BATCH_SIZE`, order preserved, 1024-length check rejects the whole call, empty input short-circuits without a usage record
- [ ] T009 Tests in `apps/server/test/ai.gateway.test.ts` for contract invariants 4 and 5 and spec US2 #1–#3, including a split batch

## Phase 4: User Story 2 + 1 — real providers (P1)

- [ ] T010 [P] Create `apps/server/src/ai/providers/openai-compatible.ts`: stdlib `fetch` POST `{baseUrl}/embeddings` with `dimensions: 1024`; sort `data` by `index`; read `usage.prompt_tokens`; map HTTP errors to gateway kinds (research R3)
- [ ] T011 [P] Test `apps/server/test/ai.openai-compatible.test.ts` with an injected `fetch`: request body shape, ordering by `index`, error mapping; no network
- [ ] T012 Add `@anthropic-ai/sdk` to `apps/server/package.json` — **only after the operator approves the dependency** (plan Complexity Tracking)
- [ ] T013 Create `apps/server/src/ai/providers/anthropic.ts`: `client.messages.stream`, yield `text_delta` text, `finalMessage().usage` into `done`, `stop_reason: "refusal"` → `error{kind:"refusal"}`, typed `Anthropic.*Error` → gateway kinds, `signal` forwarded (research R2)
- [ ] T014 Test `apps/server/test/ai.anthropic.test.ts` with an injected client double: event translation, refusal, error mapping, abort; no network, no key

## Phase 5: User Story 5 + wiring — no-key test run and startup

- [ ] T015 Wire `apps/server/src/config.ts` (optional `ai` field) and `apps/server/src/index.ts` (construct the gateway once with `logSink`); unset AI env → server starts exactly as today
- [ ] T016 [P] Document every new variable in `.env.example`, commented out, with the R5 examples
- [ ] T017 Run `pnpm ci:check` with all provider keys unset; record output in the PR body (SC-004)

## Phase 6: Polish & re-ground

- [ ] T018 Wiki: add a `ai-gateway` note; review `configuration` and `server-entrypoint-and-app` (NEEDS-REVIEW per runbook); `gates/cli.mjs freshness` prints `OK`
- [ ] T019 Tick this file and run `spec-bridge:sync` after merge

## Dependencies & Execution Order

- Phase 1 blocks all. Phase 2 before Phase 3 (same file). Phase 4's T010/T011 need only Phase 1; T012–T014 wait for the dependency ruling. Phase 5 after 2–4. Phase 6 last.

## Implementation Strategy

One implementer per phase. Phase 4 may split into two dispatches: embeddings (T010–T011) and Anthropic (T012–T014) once the dependency is approved.
