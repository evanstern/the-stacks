/**
 * The AI gateway's types (data-model.md, contracts/gateway.md). Providers are
 * named configuration entries — no provider name, vendor, or key variable is
 * ever named in this file (decision-0007).
 */

/** One `AI_PROVIDERS` entry, keyed by an operator-chosen name. */
export interface ProviderConfig {
  kind: "openai-compatible" | "fake";
  baseUrl: string;
  /** Name of the env var holding the key; omitted for a keyless (e.g. local) provider. */
  apiKeyEnv?: string;
}

/** One `AI_PURPOSES` entry, keyed by an operator-chosen purpose name. */
export interface PurposeConfig {
  /** Name of a `ProviderConfig` declared in `AI_PROVIDERS`. */
  provider: string;
  model: string;
  op: "chat" | "embed";
  maxTokens?: number;
  batchSize?: number;
}

/** One `AI_PRICES` entry, keyed `"<provider>/<model>"`, USD per million tokens. */
export interface Price {
  inputPerMTok: number;
  outputPerMTok: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  purpose: string;
  system?: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  /**
   * Called once per call that emits a usage record, with the record the sink
   * receives. Not called for an unknown purpose (no record exists). A throwing
   * callback never breaks the stream.
   */
  onUsage?: (r: UsageRecord) => void;
}

export type ErrorKind =
  | "config"
  | "auth"
  | "rate_limit"
  | "refusal"
  | "upstream"
  | "cancelled";

export interface UsageSummary {
  inputTokens: number;
  outputTokens: number;
  /** HTTP attempts the provider made for this call (retry.ts); default 1 when omitted. */
  attempts?: number;
  /** True when the provider stopped on its output cap (`finish_reason: "length"`). */
  truncated?: boolean;
}

/** `chat()` yields zero or more `text`, then exactly one `done` or `error`. */
export type ChatEvent =
  | { type: "text"; text: string }
  | { type: "done"; usage: UsageSummary }
  | { type: "error"; kind: ErrorKind; message: string; usage: UsageSummary };

export interface EmbedVector {
  vector: number[];
  model: string;
  dim: number;
}

export interface EmbedResult {
  vectors: EmbedVector[];
  usage: UsageSummary;
}

/** One per call (FR-007). Never carries prompt or completion text (FR-011). */
export interface UsageRecord {
  purpose: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** `null` when the provider/model has no configured price — never 0 (FR-008). */
  costUsd: number | null;
  durationMs: number;
  attempts: number;
  /** True when the call hit its output cap: the provider said so, or outputTokens reached `maxTokens`. */
  truncated: boolean;
  outcome: "ok" | "error" | "cancelled";
  at: string;
}

export interface UsageSink {
  record(r: UsageRecord): void;
}

/** One instance per named `AI_PROVIDERS` entry. */
export interface Provider {
  readonly ops: ReadonlySet<"chat" | "embed">;
  chat?(
    model: string,
    req: ChatRequest,
    opts: { maxTokens?: number },
  ): AsyncIterable<ChatEvent>;
  embed?(
    model: string,
    texts: string[],
    signal?: AbortSignal,
  ): Promise<{ vectors: number[][]; inputTokens: number; attempts?: number }>;
}

export type AdapterFactory = (
  cfg: ProviderConfig,
  deps: { fetch: typeof fetch; env: NodeJS.ProcessEnv },
) => Provider;
