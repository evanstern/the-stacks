---
name: ai-gateway
description: The AI gateway (apps/server/src/ai/) — one Gateway with chat()/embed(), named providers/purposes from env config, no vendor SDK or hard-coded vendor name, and the DM_FAKE_SCRIPT script mode that replaces the whole config with a scripted fake. Load for any AI/model/provider/embedding question.
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
  - apps/server/src/dm/script/env.ts
  - apps/server/dm-scripts/greyhollow-live.json
verified_against: 753a40d24fb9ad9cf5874a29cca6736ed444a8a5
---

# AI gateway

`apps/server/src/ai/` is the one seam through which any feature calls a model: a `Gateway`
with `chat()` (an async-iterable stream of text ending in exactly one `done`/`error`) and
`embed()` (batch of 1024-length vectors). No vendor SDK is installed and no vendor or
provider name is hard-coded in this directory (decision-0007); a test greps the source for it.

## How it works

**Config is data, not code.** `apps/server/src/ai/config.ts`'s `loadAiConfig(env)` reads three
JSON env vars — `AI_PROVIDERS` (name → `{kind, baseUrl, apiKeyEnv?}`), `AI_PURPOSES` (name →
`{provider, model, op, maxTokens?, batchSize?, structured?}`), `AI_PRICES` (`"<provider>/<model>"` →
`{inputPerMTok, outputPerMTok}`) — Zod-parses and cross-validates them: every purpose names a
declared provider whose kind supports the purpose's op, and every provider actually used by a
purpose has its `apiKeyEnv` set. An unused provider's key is never checked. All three env vars
are optional; unset, `loadAiConfig` returns an empty config, not an error.

**Providers are named config entries**, keyed by an operator-chosen string (`"hosted"`,
`"local"`, anything) — never a vendor name in source. Two adapter kinds exist:
`openai-compatible` (stdlib `fetch` against `{baseUrl}/chat/completions` — streamed SSE — and
`{baseUrl}/embeddings`; `Authorization: Bearer` only when `apiKeyEnv` is set) and `fake`
(scripted chat/embed for tests, with hash-derived embeddings; `scriptChatFor(purpose, ...scripts)` queues per purpose; `strict = true` makes an unscripted chat call a `config` error). `createGateway({config, sink, fetch?, env?, adapters?})` looks up a purpose, resolves its
provider (lazily, cached) through a kind → `AdapterFactory` registry, and calls `provider.chat`/`provider.embed`. The adapter reads only `delta.content`, so router `<think>` text passes through; the DM strips it ([[dm-runtime]]).

`chat()` yields zero or more `{type:"text"}` then exactly one `{type:"done"}` or
`{type:"error", kind}` (`ErrorKind` is `config | auth | rate_limit | refusal | upstream |
cancelled`); an unknown purpose fails before any provider call, with no usage record. `embed()`
splits the input into `purpose.batchSize`-sized chunks (default 128), preserves order, rejects
the whole call if any returned vector isn't length 1024, and short-circuits `[]` input with no
provider call and no usage record. Every call — success, error, or cancellation — emits exactly
one `UsageRecord` to the injected `UsageSink` (`logSink` logs JSON; `memorySink()` collects); a record never carries prompt or completion text; an unpriced model gets `costUsd: null`, never `0`. `UsageRecord.truncated` (TASK-0192): `finish_reason: "length"` or `outputTokens >= maxTokens`. `ChatRequest.onUsage` (TASK-0116) receives that record after `sink.record`; a throw is swallowed ([[dm-turn-jobs]]).

`sse.ts`'s `parseSse` turns a fetch body into an async iterable of `data:` payloads (stops at
`[DONE]`; the OpenAI-compatible adapter also treats a non-null `finish_reason` as completion, since
some local routers never send `[DONE]`). `retry.ts`'s `retryFetch` wraps only the initial request in
bounded attempts (default 3) with full-jitter backoff, honoring `Retry-After`.

**Wiring**: `apps/server/src/index.ts` calls `createAiRuntime(process.env)` (`dm/script/env.ts`),
which runs `loadAiConfig` directly (not through `loadConfig`), and constructs the gateway once via
`createGateway({config: aiConfig, sink: logSink, adapters: runtime.adapters})` right after
`loadConfig()`. `config.ts` stays free of this import because it runs on the host under
`--experimental-strip-types` and takes no relative import ([[configuration]]).
With no `AI_*` env vars set, `aiConfig` is the empty config and calls into it fail (or, for
ingestion, are skipped) rather than no-op silently.

**Script mode** (TASK-0158, specs/053). `DM_FAKE_SCRIPT=<name>` makes `createAiRuntime` load
`apps/server/dm-scripts/<name>.json` (shipped in the image, [[container-image]]) through
`loadDmScript` and `createScriptedDm` (`dm/script/load.ts`): a strict `FakeProvider` queues each
call per purpose, and the returned `aiConfig` names it for the six `dm.*` purposes and the
`embedding` purpose, with `prices: {}`. That config replaces the whole AI config: `AI_*` are not
read, and the `adapters` map registers `fake` to that one provider instance. `gateRng` is the
script's dice, then `seededRng(0)` (`facesThenSeed`); a face outside `1..sides` throws. A spent
queue fails the call loudly; `dm_model_calls` rows read provider `scripted`, cost null. Boot throws `DmScriptEnvError` on a bad `STACKS_ENV` (unset, empty, `default`, `main`, `dev`), a bad name, a missing file or an invalid script. Unset, `createAiRuntime`
is exactly `loadAiConfig(env)`. `greyhollow-live.json` (8 calls, 1 die) scripts scene start and
one `act-search` turn (Intent stages). Walkthrough: `specs/053-env-fake-dm-script/quickstart.md`.

`index.ts` passes `aiGateway` into `startIngestWorker({db, gateway: aiGateway,
embedPurpose, uploadDir})`. `embedPurpose` is [[retrieval]]'s name, only when
`aiConfig.purposes[name]?.op === "embed"`; otherwise `null` and the worker skips `embed()`
(`embedding.status === "skipped"`). A bad embed purpose degrades ingestion, never boot.

`index.ts` also passes `aiGateway` into `createApp`'s
`library.answer.gateway`: [[rules-answerer]]'s `answer()` calls `chat()` (purpose `"answering"`) and, via `retrieve()`, `embed()`. An unconfigured purpose
degrades to a terminal SSE `error` event, never a crash.

Since TASK-0046 (specs/031-dm-runtime), the DM runtime is the gateway's third caller. It uses
six `op: "chat"` purposes whose names are code constants in `dm/purposes.ts` (`DM_PURPOSES`):
`dm.director`, `dm.interpret`, `dm.adjudicate`, `dm.narrate`, `dm.chronicle`,
`dm.companion`. Model choice and `maxTokens` per purpose stay in `AI_PURPOSES` (4000 each; `dm.interpret` 8000); `.env.example`
carries a commented six-purpose example with `"structured":"tool"` on every purpose but `dm.narrate`. `index.ts` passes the same `aiGateway` into
`startDmWorker` and warns `missingDmPurposes(aiConfig.purposes)` and `unstructuredDmPurposes(aiConfig.purposes)` at boot; a missing purpose
never blocks boot, it fails only its node.

**Structured output (TASK-0273, spec 093).** `PurposeConfig.structured` is `"tool"` or `"json-schema"`
(not on `embed`). When set and the request carries `ChatRequest.output`
(`{name, schema}`), the gateway passes the mode to `Provider.chat`, and the OpenAI-compatible adapter
sends a forced tool call (`tools` + `tool_choice`) or `response_format: json_schema` (`strict: false`).
Tool-call arguments stream back as ordinary `text` events; content is held and yielded only when no
argument arrived.

Since TASK-0048, the playtest auditor adds an eighth chat purpose, `playtest.audit`
(`PLAYTEST_AUDIT_PURPOSE`, 700 `maxTokens` default), one call per transcript segment.
`playtest/budget.ts` wraps the gateway in a spend-ceiling gateway ([[playtest-harness]]).

## Connections

Constructed in [[server-entrypoint-and-app]]'s `index.ts` (config from `createAiRuntime`, not
[[configuration]]'s `loadConfig`). `.env.example` documents the env vars.
Callers: [[ingestion]]'s worker (`embed()`), [[rules-answerer]]'s `answer()` (`chat()`, `embed()`),
[[dm-runtime]]'s nodes (`chat()`) and the [[playtest-harness]] auditor (`chat()`); see [[overview]].

## Operational notes

`apps/server/test/ai.gateway.test.ts` includes a standing test (invariant 10) that recursively
greps every `.ts` file under `apps/server/src/ai/` for vendor/provider name tokens (openai,
anthropic, google, azure, …) and all-caps `*_KEY`/`*_API_KEY` variable names, failing the
suite if one appears — the literal protocol string `"openai-compatible"` is the one allowed
exception. This is the backstop for decision-0007 ("no vendor is privileged"): a native adapter kind
may be added later (one file, one registry entry) but never hard-coded by name here.
