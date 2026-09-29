# Contract: Gateway

```ts
interface Gateway {
  chat(req: ChatRequest): AsyncIterable<ChatEvent>;   // exactly one terminal event: done | error
  embed(req: { purpose: string; texts: string[]; signal?: AbortSignal }): Promise<EmbedResult>;
}
interface Provider {               // one instance per named AI_PROVIDERS entry
  readonly ops: ReadonlySet<"chat" | "embed">;
  chat?(model: string, req: ChatRequest, opts: { maxTokens?: number }): AsyncIterable<ChatEvent>;
  embed?(model: string, texts: string[], signal?: AbortSignal): Promise<{ vectors: number[][]; inputTokens: number }>;
}
type AdapterFactory = (cfg: ProviderConfig, deps: { fetch: typeof fetch; env: NodeJS.ProcessEnv }) => Provider;
interface UsageSink { record(r: UsageRecord): void }
```

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
10. No provider name, vendor name, or key variable name appears in `apps/server/src/ai/` (checked by a test that greps the source).
