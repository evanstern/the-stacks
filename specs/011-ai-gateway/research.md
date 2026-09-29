# Research: AI Gateway — First Slice

Revised 2026-09-28 for operator ruling decision-0007 (provider-agnostic gateway).

## R1. Stream shape exposed to callers

**Decision**: `chat()` returns `AsyncIterable<ChatEvent>`: `{type:"text", text}` |
`{type:"done", usage}` | `{type:"error", kind, message, usage}`. Cancellation is an
`AbortSignal` on the request.

**Rationale**: async iteration composes with Hono's `streamSSE` for TASK-0027 without an
adapter; the terminal event makes error-vs-complete explicit (spec US1 #3).

## R2. Vendor SDKs — REJECTED by operator ruling

**Decision**: no vendor SDK (`@anthropic-ai/sdk` or any other). Recorded in decision-0007
(doc-0001), 2026-09-28.

**Rationale (operator)**: the gateway must be fully provider-agnostic; a vendor SDK privileges
one provider and adds a dependency. The gateway itself owns what the SDK would have provided:
SSE parsing (R3), error mapping (R7), and bounded retry (R8).

**Consequence**: any vendor is reached through an OpenAI-compatible interface this slice.
A native adapter kind (for example `anthropic`, speaking `/v1/messages`) can be added later
behind the same `Provider` interface without changing callers.

## R3. Chat transport — OpenAI-compatible streaming

**Decision**: stdlib `fetch` POST `{baseUrl}/chat/completions` with
`{model, messages, max_tokens, stream: true, stream_options: {include_usage: true}}`.
Parse the body as SSE (`sse.ts`): split on blank lines, read `data:` lines, stop on
`data: [DONE]`. Each chunk's `choices[0].delta.content` → a `text` event. The final chunk's
`usage.{prompt_tokens, completion_tokens}` → the `done` usage. `finish_reason:
"content_filter"` → `error{kind:"refusal"}`.

**Rationale**: `/chat/completions` streaming with `include_usage` is the de facto shared
surface across hosted and local servers. A system prompt is sent as a `system` role message.

**Edge**: a stream that ends without `[DONE]` or without a usage chunk → `upstream` error,
usage recorded with counts seen (zero if none).

## R4. Usage persistence

**Decision**: no table this slice. `UsageSink` with `logSink` (one JSON line per call) and
`memorySink` (tests, benchmarks). A table sink comes later behind the same interface.

**Rationale**: TASK-0022 owns `apps/server/drizzle/` this wave; per-campaign attribution needs
M2's campaigns.

## R5. Configuration shape

**Decision**: three JSON env vars parsed with Zod, cross-validated at startup.

- `AI_PROVIDERS` — name → `{kind: "openai-compatible" | "fake", baseUrl: string, apiKeyEnv?: string}`
- `AI_PURPOSES` — purpose → `{provider: <name>, model: string, maxTokens?: number, batchSize?: number}`
- `AI_PRICES` — `"<provider>/<model>"` → `{inputPerMTok, outputPerMTok}` (USD)

Validation: every purpose's provider exists; its kind supports the purpose's operation
(the operation is named by the purpose: `embedding`-type purposes declare `op: "embed"`,
others default `op: "chat"`); every used provider's `apiKeyEnv`, when given, is set. Unset
`AI_PURPOSES` → gateway with no purposes; M0 behavior unchanged.

Provider and purpose names are operator-chosen strings. The code contains none.

## R6. Fake adapter

**Decision**: `kind: "fake"`, scripted chat events, deterministic hash-derived embeddings,
injectable failures and HTTP-status sequences, request recording.

## R7. Error mapping

HTTP → `ChatEvent` error kind: 400/404/422 → `config`; 401/403 → `auth`; 429 → `rate_limit`;
5xx and network failures → `upstream`; caller abort → `cancelled`; content filter → `refusal`.
Error messages carry status and the provider's error message; never request text.

## R8. Bounded retry

**Decision**: `retry.ts` wraps the request (not the stream). Retry on 429 and 5xx and network
errors, only before the first output byte is delivered. Defaults: 3 attempts total, base delay
500 ms, doubling, full jitter, capped at 8 s; `Retry-After` (seconds or HTTP date) overrides
the computed delay when present, capped at 30 s. The sleep is abort-aware. Each attempt's
failure is not a separate usage record; the call emits one record.

**Tested**: against a `fetch` double and an injected clock/sleep so tests do not wait.
