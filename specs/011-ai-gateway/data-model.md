# Data Model: AI Gateway — First Slice

No persisted entities. In-process types (Zod-validated where they cross a trust boundary):

| Type | Fields | Notes |
|---|---|---|
| `ProviderConfig` | `kind: "openai-compatible" \| "fake"`, `baseUrl: string`, `apiKeyEnv?: string` | keyed by operator-chosen name in `AI_PROVIDERS` |
| `PurposeConfig` | `provider: string` (a declared name), `model: string`, `op: "chat" \| "embed"` (default `chat`), `maxTokens?`, `batchSize?` | from `AI_PURPOSES` |
| `Price` | `inputPerMTok ≥ 0`, `outputPerMTok ≥ 0` | from `AI_PRICES`, key `"<provider>/<model>"`, USD |
| `ChatRequest` | `purpose`, `system?`, `messages: {role:"user"\|"assistant", content:string}[]`, `signal?` | |
| `ChatEvent` | `text{text}` \| `done{usage}` \| `error{kind, message, usage}` | kinds: `config`, `auth`, `rate_limit`, `refusal`, `upstream`, `cancelled` |
| `EmbedResult` | `vectors: {vector: number[1024], model, dim: 1024}[]`, `usage` | input order preserved |
| `UsageRecord` | `purpose, provider (name), model, inputTokens, outputTokens, costUsd: number \| null, durationMs, attempts, outcome: "ok"\|"error"\|"cancelled", at` | never contains text (FR-011) |
