import { describe, expect, it, vi } from "vitest";
import { OpenAiCompatibleProvider } from "../src/ai/adapters/openai-compatible.js";
import type { AiConfig } from "../src/ai/config.js";
import { createGateway } from "../src/ai/gateway.js";
import type {
  ChatEvent,
  ChatRequest,
  ProviderConfig,
} from "../src/ai/types.js";
import { memorySink } from "../src/ai/usage.js";

const CFG: ProviderConfig = {
  kind: "openai-compatible",
  baseUrl: "https://api.example/v1",
};
const REQUEST: ChatRequest = {
  purpose: "answering",
  messages: [{ role: "user", content: "hi" }],
};
const noSleep = async () => {};

function sseChunk(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function sseResponse(parts: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) controller.enqueue(encoder.encode(part));
      controller.close();
    },
  });
  return new Response(stream, { status });
}

async function collect(
  iterable: AsyncIterable<ChatEvent>,
): Promise<ChatEvent[]> {
  const events: ChatEvent[] = [];
  for await (const event of iterable) events.push(event);
  return events;
}

describe("OpenAiCompatibleProvider.chat", () => {
  it("POSTs the chat body with stream options and headers, streaming text then usage from the final chunk", async () => {
    const fetchDouble = vi.fn().mockResolvedValue(
      sseResponse([
        sseChunk({ choices: [{ delta: { content: "Hello" } }] }),
        sseChunk({ choices: [{ delta: { content: " world" } }] }),
        sseChunk({
          choices: [{ delta: {}, finish_reason: "stop" }],
          usage: { prompt_tokens: 10, completion_tokens: 4 },
        }),
        "data: [DONE]\n\n",
      ]),
    );
    const provider = new OpenAiCompatibleProvider(
      CFG,
      { fetch: fetchDouble as unknown as typeof fetch, env: {} },
      { sleep: noSleep },
    );

    const events = await collect(
      provider.chat(
        "gpt-x",
        { ...REQUEST, system: "be terse" },
        { maxTokens: 128 },
      ),
    );

    expect(events).toEqual([
      { type: "text", text: "Hello" },
      { type: "text", text: " world" },
      {
        type: "done",
        usage: { inputTokens: 10, outputTokens: 4, attempts: 1 },
      },
    ]);
    expect(fetchDouble).toHaveBeenCalledTimes(1);
    const [url, init] = fetchDouble.mock.calls[0];
    expect(url).toBe("https://api.example/v1/chat/completions");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "content-type": "application/json" });
    expect(init.headers.authorization).toBeUndefined();
    expect(JSON.parse(init.body)).toMatchObject({
      model: "gpt-x",
      messages: [
        { role: "system", content: "be terse" },
        { role: "user", content: "hi" },
      ],
      max_tokens: 128,
      stream: true,
      stream_options: { include_usage: true },
    });
  });

  it("sends a Bearer token from the env var named by apiKeyEnv (invariant 9)", async () => {
    const fetchDouble = vi
      .fn()
      .mockResolvedValue(sseResponse(["data: [DONE]\n\n"]));
    const provider = new OpenAiCompatibleProvider(
      {
        kind: "openai-compatible",
        baseUrl: "https://api.example/v1",
        apiKeyEnv: "PROVIDER_KEY",
      },
      {
        fetch: fetchDouble as unknown as typeof fetch,
        env: { PROVIDER_KEY: "s3cr3t" },
      },
      { sleep: noSleep },
    );

    await collect(provider.chat("m", REQUEST, {}));

    const [, init] = fetchDouble.mock.calls[0];
    expect(init.headers.authorization).toBe("Bearer s3cr3t");
  });

  it("maps a content_filter finish reason to a refusal error, carrying the final chunk's usage", async () => {
    const fetchDouble = vi.fn().mockResolvedValue(
      sseResponse([
        sseChunk({ choices: [{ delta: { content: "partial" } }] }),
        sseChunk({
          choices: [{ delta: {}, finish_reason: "content_filter" }],
          usage: { prompt_tokens: 5, completion_tokens: 1 },
        }),
        "data: [DONE]\n\n",
      ]),
    );
    const provider = new OpenAiCompatibleProvider(
      CFG,
      { fetch: fetchDouble as unknown as typeof fetch, env: {} },
      { sleep: noSleep },
    );

    const events = await collect(provider.chat("m", REQUEST, {}));

    expect(events).toEqual([
      { type: "text", text: "partial" },
      {
        type: "error",
        kind: "refusal",
        message: "content filtered",
        usage: { inputTokens: 5, outputTokens: 1, attempts: 1 },
      },
    ]);
  });

  it.each([
    [400, "config"],
    [401, "auth"],
    [403, "auth"],
    [429, "rate_limit"],
    [500, "upstream"],
  ] as const)(
    "maps an HTTP %i response to error kind %s",
    async (status, kind) => {
      const fetchDouble = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "nope" } }), {
          status,
        }),
      );
      const provider = new OpenAiCompatibleProvider(
        CFG,
        { fetch: fetchDouble as unknown as typeof fetch, env: {} },
        { sleep: noSleep, maxAttempts: 1 },
      );

      const events = await collect(provider.chat("m", REQUEST, {}));

      expect(events).toEqual([
        {
          type: "error",
          kind,
          message: "nope",
          usage: { inputTokens: 0, outputTokens: 0, attempts: 1 },
        },
      ]);
    },
  );

  it("completes with done when a finish_reason arrives but no [DONE] follows", async () => {
    const fetchDouble = vi.fn().mockResolvedValue(
      sseResponse([
        sseChunk({
          choices: [{ delta: { content: "hi" }, finish_reason: null }],
        }),
        sseChunk({ choices: [{ delta: {}, finish_reason: "stop" }] }),
        sseChunk({
          choices: [],
          usage: { prompt_tokens: 3, completion_tokens: 1 },
        }),
      ]),
    );
    const provider = new OpenAiCompatibleProvider(
      CFG,
      { fetch: fetchDouble as unknown as typeof fetch, env: {} },
      { sleep: noSleep },
    );

    const events = await collect(provider.chat("m", REQUEST, {}));

    expect(events).toEqual([
      { type: "text", text: "hi" },
      { type: "done", usage: { inputTokens: 3, outputTokens: 1, attempts: 1 } },
    ]);
  });

  it("completes with done on [DONE] alone, without a finish_reason", async () => {
    const fetchDouble = vi
      .fn()
      .mockResolvedValue(
        sseResponse([
          sseChunk({ choices: [{ delta: { content: "hi" } }] }),
          "data: [DONE]\n\n",
        ]),
      );
    const provider = new OpenAiCompatibleProvider(
      CFG,
      { fetch: fetchDouble as unknown as typeof fetch, env: {} },
      { sleep: noSleep },
    );

    const events = await collect(provider.chat("m", REQUEST, {}));

    expect(events.at(-1)).toMatchObject({ type: "done" });
  });

  it("reports an upstream error when the stream ends with neither [DONE] nor a finish_reason, with counts seen (zero)", async () => {
    const fetchDouble = vi
      .fn()
      .mockResolvedValue(
        sseResponse([
          sseChunk({ choices: [{ delta: { content: "partial" } }] }),
        ]),
      );
    const provider = new OpenAiCompatibleProvider(
      CFG,
      { fetch: fetchDouble as unknown as typeof fetch, env: {} },
      { sleep: noSleep },
    );

    const events = await collect(provider.chat("m", REQUEST, {}));

    expect(events).toEqual([
      { type: "text", text: "partial" },
      {
        type: "error",
        kind: "upstream",
        message: expect.stringContaining("completion signal"),
        usage: { inputTokens: 0, outputTokens: 0, attempts: 1 },
      },
    ]);
  });

  it("never retries once output has started, even when the stream itself errors mid-flight", async () => {
    const encoder = new TextEncoder();
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls++;
        if (pulls === 1) {
          controller.enqueue(
            encoder.encode(
              sseChunk({ choices: [{ delta: { content: "Hi" } }] }),
            ),
          );
        } else {
          controller.error(new Error("socket reset"));
        }
      },
    });
    const fetchDouble = vi
      .fn()
      .mockResolvedValue(new Response(stream, { status: 200 }));
    const provider = new OpenAiCompatibleProvider(
      CFG,
      { fetch: fetchDouble as unknown as typeof fetch, env: {} },
      { sleep: noSleep, maxAttempts: 3 },
    );

    const events = await collect(provider.chat("m", REQUEST, {}));

    expect(events[0]).toEqual({ type: "text", text: "Hi" });
    expect(events[1]).toMatchObject({ type: "error", kind: "upstream" });
    expect(fetchDouble).toHaveBeenCalledTimes(1);
  });

  it("retries a 500 before the first output, then succeeds through the gateway with one usage record carrying the real attempt count", async () => {
    const fetchDouble = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(
        sseResponse([
          sseChunk({ choices: [{ delta: { content: "ok" } }] }),
          sseChunk({
            choices: [{ delta: {}, finish_reason: "stop" }],
            usage: { prompt_tokens: 2, completion_tokens: 1 },
          }),
          "data: [DONE]\n\n",
        ]),
      );
    const config: AiConfig = {
      providers: { hosted: CFG },
      purposes: { answering: { provider: "hosted", model: "m", op: "chat" } },
      prices: {},
    };
    const sink = memorySink();
    const gateway = createGateway({
      config,
      sink,
      adapters: {
        "openai-compatible": (cfg, deps) =>
          new OpenAiCompatibleProvider(
            cfg,
            { ...deps, fetch: fetchDouble as unknown as typeof fetch },
            { sleep: noSleep },
          ),
      },
    });

    const events = await collect(gateway.chat(REQUEST));

    expect(events.at(-1)).toEqual({
      type: "done",
      usage: { inputTokens: 2, outputTokens: 1, attempts: 2 },
    });
    expect(fetchDouble).toHaveBeenCalledTimes(2);
    expect(sink.records).toHaveLength(1);
    expect(sink.records[0]).toMatchObject({ attempts: 2, outcome: "ok" });
  });
});

describe("OpenAiCompatibleProvider.embed", () => {
  it("POSTs dimensions:1024, sorts returned vectors by index, and maps usage.prompt_tokens", async () => {
    const fetchDouble = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { index: 1, embedding: [1, 0] },
            { index: 0, embedding: [0, 1] },
          ],
          usage: { prompt_tokens: 7 },
        }),
        { status: 200 },
      ),
    );
    const provider = new OpenAiCompatibleProvider(
      CFG,
      { fetch: fetchDouble as unknown as typeof fetch, env: {} },
      { sleep: noSleep },
    );

    const result = await provider.embed("embed-model", ["a", "b"]);

    expect(result).toEqual({
      vectors: [
        [0, 1],
        [1, 0],
      ],
      inputTokens: 7,
      attempts: 1,
    });
    const [url, init] = fetchDouble.mock.calls[0];
    expect(url).toBe("https://api.example/v1/embeddings");
    expect(JSON.parse(init.body)).toMatchObject({
      model: "embed-model",
      input: ["a", "b"],
      dimensions: 1024,
    });
  });

  it("throws naming the status and the provider's message on an error response", async () => {
    const fetchDouble = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "bad request" } }), {
        status: 400,
      }),
    );
    const provider = new OpenAiCompatibleProvider(
      CFG,
      { fetch: fetchDouble as unknown as typeof fetch, env: {} },
      { sleep: noSleep, maxAttempts: 1 },
    );

    await expect(provider.embed("embed-model", ["a"])).rejects.toThrow(
      /400.*bad request/,
    );
  });
});

describe("OpenAiCompatibleProvider.chat truncation (TASK-0192)", () => {
  it("sets usage.truncated on finish_reason length, even when a later usage chunk replaces usage", async () => {
    const fetchDouble = vi.fn().mockResolvedValue(
      sseResponse([
        sseChunk({
          choices: [{ delta: { content: "hi" }, finish_reason: "length" }],
        }),
        sseChunk({
          choices: [],
          usage: { prompt_tokens: 3, completion_tokens: 9 },
        }),
        "data: [DONE]\n\n",
      ]),
    );
    const provider = new OpenAiCompatibleProvider(
      CFG,
      { fetch: fetchDouble as unknown as typeof fetch, env: {} },
      { sleep: noSleep },
    );
    const events = await collect(provider.chat("m", REQUEST, {}));
    expect(events.at(-1)).toEqual({
      type: "done",
      usage: { inputTokens: 3, outputTokens: 9, attempts: 1, truncated: true },
    });
  });
});

describe("OpenAiCompatibleProvider.chat structured output (TASK-0273)", () => {
  const OUTPUT = {
    name: "dm_audit",
    schema: { type: "object", properties: { a: { type: "string" } } },
  };
  const run = async (
    chunks: unknown[],
    structured?: "tool" | "json-schema",
    withOutput = true,
  ) => {
    const fetchDouble = vi
      .fn()
      .mockResolvedValue(
        sseResponse([...chunks.map(sseChunk), "data: [DONE]\n\n"]),
      );
    const provider = new OpenAiCompatibleProvider(
      CFG,
      { fetch: fetchDouble as unknown as typeof fetch, env: {} },
      { sleep: noSleep },
    );
    const events = await collect(
      provider.chat(
        "m",
        withOutput ? { ...REQUEST, output: OUTPUT } : REQUEST,
        { structured },
      ),
    );
    const init = fetchDouble.mock.calls[0]?.[1] as { body: string };
    const body = JSON.parse(init.body) as Record<string, unknown>;
    return { events, body, raw: init.body };
  };
  const text = (events: ChatEvent[]) =>
    events
      .filter((e) => e.type === "text")
      .map((e) => (e as { text: string }).text);
  const tc = (args: string, index = 0) => ({
    choices: [
      { delta: { tool_calls: [{ index, function: { arguments: args } }] } },
    ],
  });

  it("tool mode sends tools and a forced tool_choice", async () => {
    const { body } = await run(
      [{ choices: [{ delta: {}, finish_reason: "stop" }] }],
      "tool",
    );
    expect(body.tools).toEqual([
      {
        type: "function",
        function: {
          name: "dm_audit",
          description: "Return the reply.",
          parameters: OUTPUT.schema,
        },
      },
    ]);
    expect(body.tool_choice).toEqual({
      type: "function",
      function: { name: "dm_audit" },
    });
    expect(body.response_format).toBeUndefined();
  });

  it("json-schema mode sends response_format", async () => {
    const { body } = await run(
      [{ choices: [{ delta: {}, finish_reason: "stop" }] }],
      "json-schema",
    );
    expect(body.response_format).toEqual({
      type: "json_schema",
      json_schema: { name: "dm_audit", schema: OUTPUT.schema, strict: false },
    });
    expect(body.tools).toBeUndefined();
  });

  it("sends today's body byte for byte without a mode or without output", async () => {
    const stop = [{ choices: [{ delta: {}, finish_reason: "stop" }] }];
    const plain = await run(stop, undefined, false);
    expect((await run(stop, undefined, true)).raw).toBe(plain.raw);
    expect((await run(stop, "tool", false)).raw).toBe(plain.raw);
    expect(plain.body).not.toHaveProperty("tools");
    expect(plain.body).not.toHaveProperty("response_format");
  });

  it("streams tool-call fragments as text in order and completes on tool_calls", async () => {
    const { events } = await run(
      [
        tc('{"a":'),
        tc('"x"}'),
        { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
      ],
      "tool",
    );
    expect(text(events)).toEqual(['{"a":', '"x"}']);
    expect(events.at(-1)?.type).toBe("done");
  });

  it("yields one held text for a content-only reply in tool mode", async () => {
    const { events } = await run(
      [
        { choices: [{ delta: { content: '{"a":' } }] },
        { choices: [{ delta: { content: '"x"}' }, finish_reason: "stop" }] },
      ],
      "tool",
    );
    expect(text(events)).toEqual(['{"a":"x"}']);
  });

  it("yields arguments only when content and arguments are mixed", async () => {
    const { events } = await run(
      [
        { choices: [{ delta: { content: "Sure, here:" } }] },
        tc('{"a":"x"}'),
        { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
      ],
      "tool",
    );
    expect(text(events)).toEqual(['{"a":"x"}']);
  });

  it("ignores arguments of other tool-call indexes", async () => {
    const { events } = await run(
      [
        tc('{"a":"x"}'),
        tc("junk", 1),
        { choices: [{ delta: {}, finish_reason: "stop" }] },
      ],
      "tool",
    );
    expect(text(events)).toEqual(['{"a":"x"}']);
  });

  it("marks truncated on finish_reason length in tool mode", async () => {
    const { events } = await run(
      [tc('{"a":'), { choices: [{ delta: {}, finish_reason: "length" }] }],
      "tool",
    );
    expect(events.at(-1)).toMatchObject({
      type: "done",
      usage: { truncated: true },
    });
  });
});
