/**
 * The `openai-compatible` provider kind (research R3, R7): stdlib `fetch`
 * against `{baseUrl}/chat/completions` (streamed SSE) and `{baseUrl}/embeddings`.
 * No vendor SDK, no provider name (decision-0007) — everything provider-specific
 * is `cfg.baseUrl` and the key named by `cfg.apiKeyEnv`.
 */

import {
  RetryExhaustedError,
  type RetryOptions,
  retryFetch,
} from "../retry.js";
import { parseSse } from "../sse.js";
import type {
  AdapterFactory,
  ChatEvent,
  ChatRequest,
  ErrorKind,
  Provider,
  ProviderConfig,
  UsageSummary,
} from "../types.js";

const EMBED_DIM = 1024;

interface Deps {
  fetch: typeof fetch;
  env: NodeJS.ProcessEnv;
}

interface ChatCompletionChunk {
  choices?: { delta?: { content?: string }; finish_reason?: string | null }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

interface EmbeddingsResponse {
  data: { embedding: number[]; index: number }[];
  usage?: { prompt_tokens?: number };
}

/** HTTP status → `ChatEvent` error kind (research R7). */
function statusToErrorKind(status: number): ErrorKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate_limit";
  if (status >= 500) return "upstream";
  return "config"; // 400/404/422 and other client errors
}

/** Never includes request/prompt text — only the provider's own error body. */
async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  if (!text) return `HTTP ${response.status}`;
  try {
    const body = JSON.parse(text) as {
      error?: { message?: string };
      message?: string;
    };
    const message = body.error?.message ?? body.message;
    if (message) return message;
  } catch {
    // not JSON — fall through to the raw text
  }
  return text.slice(0, 500);
}

export class OpenAiCompatibleProvider implements Provider {
  readonly ops: ReadonlySet<"chat" | "embed"> = new Set(["chat", "embed"]);

  constructor(
    private readonly cfg: ProviderConfig,
    private readonly deps: Deps,
    private readonly retryOptions: RetryOptions = {},
  ) {}

  private authHeaders(): Record<string, string> {
    const key = this.cfg.apiKeyEnv
      ? this.deps.env[this.cfg.apiKeyEnv]
      : undefined;
    return key ? { authorization: `Bearer ${key}` } : {};
  }

  async *chat(
    model: string,
    req: ChatRequest,
    opts: { maxTokens?: number },
  ): AsyncIterable<ChatEvent> {
    const messages = req.system
      ? [{ role: "system", content: req.system }, ...req.messages]
      : req.messages;
    const body = JSON.stringify({
      model,
      messages,
      ...(opts.maxTokens !== undefined ? { max_tokens: opts.maxTokens } : {}),
      stream: true,
      stream_options: { include_usage: true },
    });

    let response: Response;
    let attempts: number;
    try {
      const outcome = await retryFetch(
        () =>
          this.deps.fetch(`${this.cfg.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...this.authHeaders(),
            },
            body,
            signal: req.signal,
          }),
        { ...this.retryOptions, signal: req.signal },
      );
      response = outcome.response;
      attempts = outcome.attempts;
    } catch (err) {
      if (req.signal?.aborted) return; // gateway maps the missing terminal event to cancelled
      yield {
        type: "error",
        kind: "upstream",
        message: err instanceof Error ? err.message : String(err),
        usage: { inputTokens: 0, outputTokens: 0, attempts: attemptsOf(err) },
      };
      return;
    }

    if (!response.ok) {
      yield {
        type: "error",
        kind: statusToErrorKind(response.status),
        message: await readErrorMessage(response),
        usage: { inputTokens: 0, outputTokens: 0, attempts },
      };
      return;
    }
    if (!response.body) {
      yield {
        type: "error",
        kind: "upstream",
        message: "empty response body",
        usage: { inputTokens: 0, outputTokens: 0, attempts },
      };
      return;
    }

    const { events, sawDone } = parseSse(response.body);
    let usage: UsageSummary = { inputTokens: 0, outputTokens: 0, attempts };
    let refusal = false;
    let sawFinish = false;

    try {
      for await (const data of events) {
        if (req.signal?.aborted) return;
        let chunk: ChatCompletionChunk;
        try {
          chunk = JSON.parse(data) as ChatCompletionChunk;
        } catch {
          continue;
        }
        const choice = chunk.choices?.[0];
        const text = choice?.delta?.content;
        if (text) yield { type: "text", text };
        if (choice?.finish_reason) sawFinish = true;
        if (choice?.finish_reason === "content_filter") refusal = true;
        if (chunk.usage) {
          usage = {
            inputTokens: chunk.usage.prompt_tokens ?? 0,
            outputTokens: chunk.usage.completion_tokens ?? 0,
            attempts,
          };
        }
      }
    } catch (err) {
      if (req.signal?.aborted) return;
      yield {
        type: "error",
        kind: "upstream",
        message: err instanceof Error ? err.message : String(err),
        usage,
      };
      return;
    }

    if (req.signal?.aborted) return;
    if (refusal) {
      yield {
        type: "error",
        kind: "refusal",
        message: "content filtered",
        usage,
      };
      return;
    }
    // Complete = `[DONE]` seen OR any chunk carried a finish_reason. Some local
    // routers send finish_reason + usage and never `[DONE]`.
    if (!sawDone() && !sawFinish) {
      yield {
        type: "error",
        kind: "upstream",
        message: "stream ended without a completion signal",
        usage,
      };
      return;
    }
    yield { type: "done", usage };
  }

  async embed(
    model: string,
    texts: string[],
    signal?: AbortSignal,
  ): Promise<{ vectors: number[][]; inputTokens: number; attempts?: number }> {
    const body = JSON.stringify({ model, input: texts, dimensions: EMBED_DIM });
    const { response, attempts } = await retryFetch(
      () =>
        this.deps.fetch(`${this.cfg.baseUrl}/embeddings`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...this.authHeaders(),
          },
          body,
          signal,
        }),
      { ...this.retryOptions, signal },
    );
    if (!response.ok) {
      throw new Error(
        `embeddings request failed (${response.status}): ${await readErrorMessage(response)}`,
      );
    }
    const payload = (await response.json()) as EmbeddingsResponse;
    const vectors = [...payload.data]
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);
    return {
      vectors,
      inputTokens: payload.usage?.prompt_tokens ?? 0,
      attempts,
    };
  }
}

function attemptsOf(err: unknown): number {
  return err instanceof RetryExhaustedError ? err.attempts : 1;
}

export const createOpenAiCompatibleProvider: AdapterFactory = (cfg, deps) =>
  new OpenAiCompatibleProvider(cfg, deps);
