# Contract: Gateway

```ts
interface Gateway {
  chat(req: ChatRequest): AsyncIterable<ChatEvent>;   // exactly one terminal event: done | error
  embed(req: { purpose: string; texts: string[]; signal?: AbortSignal }): Promise<EmbedResult>;
}
interface Provider {
  chat?(model: string, req: ChatRequest): AsyncIterable<ChatEvent>;
  embed?(model: string, texts: string[], signal?: AbortSignal): Promise<{ vectors: number[][]; inputTokens: number }>;
}
interface UsageSink { record(r: UsageRecord): void }
```

Invariants (each has a test):

1. Unknown purpose → throws/emits `config` error before any provider call.
2. `chat` yields zero or more `text`, then exactly one `done` or `error`; one usage record per call.
3. Caller abort → upstream aborted, terminal `error{kind:"cancelled"}`, usage outcome `cancelled`.
4. `embed` returns `texts.length` vectors in input order; any vector length ≠ 1024 → rejects, no partial result.
5. `embed([])` → empty result, provider not called, no usage record.
6. Unpriced model → `costUsd: null`, never 0.
7. Usage records contain no prompt or completion text.
