# Data Model: AI Gateway — First Slice

No persisted entities. In-process types (Zod-validated where they cross a trust boundary):

| Type | Fields | Notes |
|---|---|---|
| `PurposeConfig` | `provider: "anthropic" \| "openai-compatible" \| "fake"`, `model: string`, `maxTokens?: number` | from `AI_PURPOSES` |
| `Price` | `inputPerMTok: number ≥ 0`, `outputPerMTok: number ≥ 0` | from `AI_PRICES`, USD |
| `ChatRequest` | `purpose`, `system?`, `messages: {role:"user"\|"assistant", content:string}[]`, `signal?` | |
| `ChatEvent` | `text{text}` \| `done{usage}` \| `error{kind, message, usage}` | kinds: `config`, `auth`, `rate_limit`, `refusal`, `upstream`, `cancelled` |
| `EmbedResult` | `vectors: {vector: number[1024], model, dim: 1024}[]`, `usage` | input order preserved |
| `UsageRecord` | `purpose, provider, model, inputTokens, outputTokens, costUsd: number \| null, durationMs, outcome: "ok"\|"error"\|"cancelled", at` | never contains text (FR-011) |
