import type {
  ChatEvent,
  ChatRequest,
  Provider,
  UsageSummary,
} from "../types.js";

const EMBED_DIM = 1024;

export interface ChatCall {
  model: string;
  request: ChatRequest;
  maxTokens?: number;
}

export interface EmbedCall {
  model: string;
  texts: string[];
}

/** One scripted `chat()` response: the exact events to yield, in order. */
export type ChatScript = ChatEvent[];

/** One scripted `embed()` response: explicit vectors/usage, or an error to throw instead. */
export interface EmbedScript {
  vectors?: number[][];
  usage?: UsageSummary;
  error?: Error;
}

/**
 * Deterministic, hash-derived embedding (research R6) — the same text always
 * yields the same vector, with no network and no real model.
 */
function hashEmbed(text: string): number[] {
  let seed = 0;
  for (let i = 0; i < text.length; i++) {
    seed = (seed * 31 + text.charCodeAt(i)) | 0;
  }
  const vector = new Array<number>(EMBED_DIM);
  for (let i = 0; i < EMBED_DIM; i++) {
    seed = (seed * 1103515245 + 12345) | 0;
    vector[i] = (seed % 1000) / 1000;
  }
  return vector;
}

/**
 * Scripted provider for tests (research R6, FR-009). Each call consumes the
 * next queued script (FIFO); an unscripted call gets a safe default. Every
 * call is recorded for assertions.
 */
export class FakeProvider implements Provider {
  readonly ops: ReadonlySet<"chat" | "embed"> = new Set(["chat", "embed"]);
  readonly chatCalls: ChatCall[] = [];
  readonly embedCalls: EmbedCall[] = [];

  private readonly chatScripts: ChatScript[] = [];
  private readonly embedScripts: EmbedScript[] = [];

  /** Queue the events `chat()` yields for the next call(s), one script per call. */
  scriptChat(...scripts: ChatScript[]): this {
    this.chatScripts.push(...scripts);
    return this;
  }

  /** Queue what `embed()` returns (or throws) for the next call(s), one script per call. */
  scriptEmbed(...scripts: EmbedScript[]): this {
    this.embedScripts.push(...scripts);
    return this;
  }

  async *chat(
    model: string,
    request: ChatRequest,
    opts: { maxTokens?: number },
  ): AsyncIterable<ChatEvent> {
    this.chatCalls.push({ model, request, maxTokens: opts.maxTokens });
    const script = this.chatScripts.shift() ?? [
      { type: "done", usage: { inputTokens: 0, outputTokens: 0 } },
    ];
    for (const event of script) {
      if (request.signal?.aborted) return;
      yield event;
    }
  }

  async embed(
    model: string,
    texts: string[],
  ): Promise<{ vectors: number[][]; inputTokens: number }> {
    this.embedCalls.push({ model, texts });
    const script = this.embedScripts.shift();
    if (script?.error) throw script.error;
    return {
      vectors: script?.vectors ?? texts.map(hashEmbed),
      inputTokens: script?.usage?.inputTokens ?? texts.length,
    };
  }
}
