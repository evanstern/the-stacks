# Research: AI Gateway — First Slice

## R1. Stream shape exposed to callers

**Decision**: `chat()` returns `AsyncIterable<ChatEvent>` where `ChatEvent` is
`{type:"text", text}` | `{type:"done", usage}` | `{type:"error", error, usage}`.
Cancellation is an `AbortSignal` on the request.

**Rationale**: async iteration composes with Hono's `streamSSE` for TASK-0027 without an
adapter; a terminal event makes the error-vs-complete distinction explicit (spec US1 #3).

**Alternatives**: callback/EventEmitter (harder to cancel and test); Web `ReadableStream`
(no advantage over async iterables in Node here).

## R2. Anthropic transport — SDK vs fetch (OPERATOR CHECKPOINT)

**Decision (proposed)**: `@anthropic-ai/sdk`, `client.messages.stream(...)`, iterate events
for `content_block_delta`/`text_delta`, then `await stream.finalMessage()` for `usage`.
Pass `signal` in request options for cancellation. Catch `Anthropic.APIError` subclasses and
map to gateway error kinds.

**Rationale**: the claude-api reference makes the SDK the default for TypeScript and warns
against hand-rolling streaming; the SDK owns retries (408/409/429/5xx), typed errors, and
usage accounting at stream end. The API surface drifts (thinking config, refusal stop
reason); the SDK absorbs that.

**Alternative**: `fetch` + hand-written SSE parser — no dependency, but ~150 lines of
protocol code the project must keep current. Rejected unless the operator prefers zero deps.

**Model defaults** (config, not code): answering → `claude-opus-5-5`; extraction →
`claude-haiku-4-5`. `stop_reason: "refusal"` surfaces as an `error` event of kind `refusal`.
Server-side fallbacks are not enabled in this slice; noted for TASK-0027.

## R3. Embeddings transport

**Decision**: stdlib `fetch` POST `{baseUrl}/embeddings` with
`{model, input: string[], dimensions: 1024, encoding_format: "float"}`; read
`data[].embedding` (sorted by `index`) and `usage.prompt_tokens`. No SDK.

**Rationale**: decision-0002 fixes the OpenAI-compatible interface; the request is one POST
with a flat JSON body; Voyage, OpenAI, and local servers (Ollama, vLLM) accept it. Providers
that ignore `dimensions` are caught by the gateway's length check (FR-005).

## R4. Usage persistence

**Decision**: no table in this slice. `UsageSink` interface with `logSink` (one structured
JSON line per call via `console.log`) and `memorySink` (tests, benchmarks).

**Rationale**: TASK-0022 owns `apps/server/drizzle/` this wave; a migration here would
conflict on the journal. Per-campaign attribution (A7) needs M2's campaigns table anyway.
A later task adds a `usage` table sink behind the same interface.

## R5. Configuration shape

**Decision**: two JSON env vars parsed with Zod, plus per-provider keys.

- `AI_PURPOSES` — `{"answering":{"provider":"anthropic","model":"claude-opus-5-5"}, "embedding":{"provider":"openai-compatible","model":"voyage-3.5"}}`
- `AI_PRICES` — `{"claude-opus-5-5":{"inputPerMTok":4,"outputPerMTok":20}}` (USD)
- `ANTHROPIC_API_KEY`; `EMBEDDINGS_BASE_URL`, `EMBEDDINGS_API_KEY`; `EMBEDDINGS_BATCH_SIZE` (default 128)

All optional at startup: an unset `AI_PURPOSES` yields a gateway with no purposes (M0 behavior
unchanged). A purpose that names a provider whose key/URL is missing fails startup.

**Alternatives**: a config file (new mount path for self-hosters; env matches the existing
`loadConfig` contract).

## R6. Fake provider

**Decision**: `createFakeProvider({chat: [...scripted events], embed: (texts) => vectors,
fail?: {...}})`, recording every request it received. Deterministic vectors derived from
text hash so retrieval tests in later tasks get stable output.
