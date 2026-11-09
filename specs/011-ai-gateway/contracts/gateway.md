# Contract: Gateway

```ts
interface Gateway {
  chat(req: ChatRequest): AsyncIterable<ChatEvent>;   // exactly one terminal event: done | error
  embed(req: { purpose: string; texts: string[]; signal?: AbortSignal }): Promise<EmbedResult>;
}
interface Provider {               // one instance per named AI_PROVIDERS entry
  readonly ops: ReadonlySet<"chat" | "embed">;
  chat?(model: string, req: ChatRequest, opts: { maxTokens?: number; structured?: "tool" | "json-schema" }): AsyncIterable<ChatEvent>;
  embed?(model: string, texts: string[], signal?: AbortSignal): Promise<{ vectors: number[][]; inputTokens: number }>;
}
type AdapterFactory = (cfg: ProviderConfig, deps: { fetch: typeof fetch; env: NodeJS.ProcessEnv }) => Provider;
interface UsageSink { record(r: UsageRecord): void }
// ChatRequest also carries (TASK-0116): onUsage?: (r: UsageRecord) => void
// ChatRequest also carries (TASK-0273): output?: { name: string; schema: Record<string, unknown> }
// PurposeConfig also carries (TASK-0273): structured?: "tool" | "json-schema"
```

## Structured output (TASK-0273)

`PurposeConfig.structured` is the per-purpose mode. `ChatRequest.output` is a vendor-neutral
`{name, schema}` (JSON Schema). The gateway passes `purpose.structured` in the provider `opts` and
`req` unchanged. It never inspects the schema. An adapter reads `req.output` only when `opts.structured` is set.
A request without both sends today's body byte for byte.

`openai-compatible` wire mapping:

- `tool`: `tools: [{type:"function", function:{name, description:"Return the reply.", parameters: schema}}]` and
  `tool_choice: {type:"function", function:{name}}`. Index-0 `delta.tool_calls[].function.arguments`
  fragments stream as `text` events, in order. `delta.content` is held and yielded as one `text` only
  when no argument arrived. `finish_reason: "tool_calls"` completes the stream; `"length"` marks `truncated`.
- `json-schema`: `response_format: {type:"json_schema", json_schema:{name, schema, strict:false}}`. Content streams as `text`.

Startup rejects `structured` on an `op: "embed"` purpose, naming the purpose.

Invariants (each has a test):

1. Unknown purpose → `config` error before any provider call.
2. `chat` yields zero or more `text`, then exactly one `done` or `error`; one usage record per call.
3. Caller abort → upstream aborted, terminal `error{kind:"cancelled"}`, usage outcome `cancelled`.
4. `embed` returns `texts.length` vectors in input order; any vector length ≠ 1024 → rejects, no partial result.
5. `embed([])` → empty result, provider not called, no usage record.
6. Unpriced provider/model → `costUsd: null`, never 0.
7. Usage records contain no prompt or completion text.
8. Startup rejects: purpose → undeclared provider; purpose op unsupported by provider kind; used provider's `apiKeyEnv` unset.
9. 429/5xx before output → retried up to the bound, honoring `Retry-After`; other 4xx never retried; no retry after the first `text` event; abort during backoff stops retrying.
10. `ChatRequest.onUsage`, when set, is called once per call that emits a usage record, with the record the sink receives, on `done`, `error` and cancel. It is not called for an unknown purpose. A throwing callback never changes the events the stream yields.
11. No provider name, vendor name, or key variable name appears in `apps/server/src/ai/` (checked by a test that greps the source).

## `.env.example` block (verbatim target for T017)

```sh
# --- AI gateway (all optional; unset = no model features) ---
# Providers are named by YOU. Each has an adapter kind, a base URL, and optionally the
# NAME of the env var holding its key. No provider is built in or preferred.
# Kinds today: openai-compatible, fake. A native kind (e.g. anthropic) can be added later
# behind the same Provider interface.
# AI_PROVIDERS={"hosted":{"kind":"openai-compatible","baseUrl":"https://api.example.com/v1","apiKeyEnv":"HOSTED_API_KEY"},"local":{"kind":"openai-compatible","baseUrl":"http://localhost:11434/v1"}}
# HOSTED_API_KEY=
#
# Purposes map to a provider name and a model. op defaults to "chat".
# AI_PURPOSES={"answering":{"provider":"hosted","model":"your-chat-model"},"embedding":{"provider":"local","model":"your-embedding-model","op":"embed"}}
#
# Prices per provider/model, USD per million tokens. Unpriced calls record cost as unknown.
# AI_PRICES={"hosted/your-chat-model":{"inputPerMTok":0,"outputPerMTok":0}}
```

> Extended by specs/031-dm-runtime/contracts/turn-jobs.md (the fake adapter gains purpose-keyed queues and a strict mode).
