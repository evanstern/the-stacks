---
name: ai-gateway
description: The AI gateway (apps/server/src/ai/) — one Gateway with chat()/embed(), named providers/purposes from env config, no vendor SDK or hard-coded vendor name. Load for any AI/model/provider/embedding question.
kind: component
sources:
  - apps/server/src/ai/types.ts
  - apps/server/src/ai/config.ts
  - apps/server/src/ai/gateway.ts
  - apps/server/src/ai/usage.ts
  - apps/server/src/ai/sse.ts
  - apps/server/src/ai/retry.ts
  - apps/server/src/ai/adapters/fake.ts
  - apps/server/src/ai/adapters/openai-compatible.ts
  - apps/server/src/config.ts
  - apps/server/src/index.ts
  - .env.example
verified_against: 323f96c45e738dd79c84e00f970a18dc8180ddf0
---

# AI gateway

`apps/server/src/ai/` is the one seam through which any feature calls a model: a `Gateway`
with `chat()` (an async-iterable stream of text ending in exactly one `done`/`error`) and
`embed()` (batch of 1024-length vectors). No vendor SDK is installed and no vendor or
provider name is ever hard-coded in this directory (decision-0007) — a test enforces that by
grepping the source (see "Operational notes"). As of TASK-0024 (specs/017-ingestion-pipeline),
[[ingestion]]'s worker is the gateway's first real caller: it calls `embed()` for each stored
book's chunks. No HTTP route calls it yet (TASK-0027 onward will).

## How it works

**Config is data, not code.** `apps/server/src/ai/config.ts`'s `loadAiConfig(env)` reads three
JSON env vars — `AI_PROVIDERS` (name → `{kind, baseUrl, apiKeyEnv?}`), `AI_PURPOSES` (name →
`{provider, model, op, maxTokens?, batchSize?}`), `AI_PRICES` (`"<provider>/<model>"` →
`{inputPerMTok, outputPerMTok}`) — Zod-parses them, and cross-validates: every purpose names a
declared provider whose kind supports the purpose's op, and every provider actually used by a
purpose has its `apiKeyEnv` set. An unused provider's key is never checked. All three env vars
are optional; unset, `loadAiConfig` returns `{providers: {}, purposes: {}, prices: {}}` — an
empty, harmless config, not an error.

**Providers are named config entries**, keyed by an operator-chosen string (`"hosted"`,
`"local"`, anything) — never a vendor name in source. Two adapter kinds exist:
`openai-compatible` (stdlib `fetch` against `{baseUrl}/chat/completions` — streamed SSE — and
`{baseUrl}/embeddings`; `Authorization: Bearer` only when `apiKeyEnv` is set) and `fake`
(scripted chat/embed for tests, with deterministic hash-derived embeddings). `gateway.ts`'s
`createGateway({config, sink, fetch?, env?, adapters?})` looks up a purpose, resolves its
provider (lazily, cached by name) through a kind → `AdapterFactory` registry, and calls
`provider.chat`/`provider.embed`.

`chat()` yields zero or more `{type:"text"}` then exactly one `{type:"done"}` or
`{type:"error", kind}` (`ErrorKind` is `config | auth | rate_limit | refusal | upstream |
cancelled`); an unknown purpose fails before any provider call, with no usage record. `embed()`
splits the input into `purpose.batchSize`-sized chunks (default 128), preserves order, rejects
the whole call if any returned vector isn't length 1024, and short-circuits `[]` input with no
provider call and no usage record. Every call — success, error, or cancellation — emits exactly
one `UsageRecord` to the injected `UsageSink` (`usage.ts`'s `logSink` logs a JSON line;
`memorySink()` collects records for tests); a record never carries prompt or completion text,
and an unpriced provider/model gets `costUsd: null`, never `0`.

`sse.ts`'s `parseSse` turns a fetch response body into an async iterable of `data:` payloads
(blank-line framing, multi-line joins, `:`-comments ignored, stops at `[DONE]`, and reports via
`sawDone()` whether the stream actually closed with one; the OpenAI-compatible adapter also treats any non-null `finish_reason` as completion, since some local routers never send `[DONE]`). `retry.ts`'s `retryFetch` wraps only
the initial request (never a stream already producing text) in bounded attempts (default 3)
with full-jitter exponential backoff, honoring `Retry-After` (seconds or HTTP-date), abort-aware
sleeping, and an injectable clock/jitter for tests.

**Wiring**: `apps/server/src/index.ts` calls `loadAiConfig(process.env)` directly (not through
`loadConfig`) and constructs the gateway once via `createGateway({config: aiConfig, sink:
logSink})` right after `loadConfig()`. `config.ts` stays free of this import deliberately — it
runs on the host under `node --experimental-strip-types` (see [[configuration]]) and must not
gain a relative import, so AI config loading lives in `index.ts` instead of `ServerConfig`.
With no `AI_*` env vars set, `aiConfig` is the empty config and calls into it fail (or, for
ingestion, are skipped — see below) rather than silently no-op-ing at startup.

`index.ts` passes this same `aiGateway` into `startIngestWorker({db, gateway: aiGateway,
embedPurpose, uploadDir})`. `embedPurpose` is [[retrieval]]'s `loadRetrievalConfig(process.env
).embedPurpose` name, resolved to that name only when `aiConfig.purposes[name]?.op ===
"embed"` — otherwise it's `null` and the worker's `embed()` call is skipped (`embedding.status
=== "skipped"`) rather than thrown. A bad or unconfigured embed purpose degrades ingestion (no
vectors), it never crashes the server at boot.

Since TASK-0027 (specs/018-rules-answerer), `index.ts` also passes the same `aiGateway` into
`createApp`'s `library.answer.gateway`, so [[rules-answerer]]'s `answer()` is the gateway's
second caller — it calls both `chat()` (purpose fixed at the code constant `"answering"`, not
an env var) and, transitively via `retrieve()`, `embed()`. An unconfigured `"answering"`
purpose degrades the same way ingestion's does: `answer()` maps `chat()`'s own `{type:"error"}`
event (or a thrown `retrieve()`/`embed()` failure) to a terminal SSE `error` event rather than
crashing the server — see [[rules-answerer]].

## Connections

Constructed in [[server-entrypoint-and-app]]'s `index.ts`, via `loadAiConfig(process.env)`
called directly (not through [[configuration]]'s `loadConfig`), alongside the WebSocket
gateway. `.env.example` documents the three env vars under "AI gateway". [[ingestion]]'s
worker (library plane, TASK-0024) is its first caller, via `embed()`; [[rules-answerer]]'s
`answer()` (TASK-0027) is its second, via `chat()` and `embed()` — see [[overview]] for the
three data planes.

## Operational notes

All AI env vars are optional; unset, the server starts exactly as before this slice existed.
`apps/server/test/ai.gateway.test.ts` includes a standing test (invariant 10) that recursively
greps every `.ts` file under `apps/server/src/ai/` for vendor/provider name tokens (openai,
anthropic, google, azure, …) and all-caps `*_KEY`/`*_API_KEY` variable names, failing the
suite if one appears — the literal protocol string `"openai-compatible"` is the one allowed
exception. This is the mechanical backstop for decision-0007 ("no vendor is privileged"): a
native vendor-specific adapter kind can still be added later (one file, one registry entry),
but it may never be assumed or hard-coded by name in this directory.
