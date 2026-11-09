import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FakeProvider } from "../src/ai/adapters/fake.js";
import type { AiConfig } from "../src/ai/config.js";
import { createGateway } from "../src/ai/gateway.js";
import type { ChatEvent, UsageRecord } from "../src/ai/types.js";
import { memorySink } from "../src/ai/usage.js";

/** Builds a gateway wired to one or more named fake providers, keyed by purpose. */
function buildGateway(
  byPurpose: Record<string, FakeProvider>,
  maxTokens?: number,
) {
  const providers: AiConfig["providers"] = {};
  const purposes: AiConfig["purposes"] = {};
  const byBaseUrl: Record<string, FakeProvider> = {};

  for (const [purposeName, provider] of Object.entries(byPurpose)) {
    const providerName = `${purposeName}-provider`;
    const baseUrl = `http://fake/${providerName}`;
    providers[providerName] = { kind: "fake", baseUrl };
    purposes[purposeName] = {
      provider: providerName,
      model: `${purposeName}-model`,
      op: "chat",
      ...(maxTokens === undefined ? {} : { maxTokens }),
    };
    byBaseUrl[baseUrl] = provider;
  }

  const config: AiConfig = {
    providers,
    purposes,
    prices: {
      "answering-provider/answering-model": {
        inputPerMTok: 3,
        outputPerMTok: 15,
      },
    },
  };
  const sink = memorySink();
  const gateway = createGateway({
    config,
    sink,
    adapters: { fake: (cfg) => byBaseUrl[cfg.baseUrl] },
  });
  return { gateway, sink };
}

async function collect(
  iterable: AsyncIterable<ChatEvent>,
): Promise<ChatEvent[]> {
  const events: ChatEvent[] = [];
  for await (const event of iterable) events.push(event);
  return events;
}

describe("gateway.chat", () => {
  it("streams text in order then one usage summary, with cost from the price table (US1 AC1, US4 AC1, invariant 2)", async () => {
    const provider = new FakeProvider();
    provider.scriptChat([
      { type: "text", text: "Hello" },
      { type: "text", text: " world" },
      { type: "done", usage: { inputTokens: 10, outputTokens: 4 } },
    ]);
    const { gateway, sink } = buildGateway({ answering: provider });

    const events = await collect(
      gateway.chat({
        purpose: "answering",
        messages: [{ role: "user", content: "secret prompt text" }],
      }),
    );

    expect(events).toEqual([
      { type: "text", text: "Hello" },
      { type: "text", text: " world" },
      { type: "done", usage: { inputTokens: 10, outputTokens: 4 } },
    ]);
    expect(sink.records).toHaveLength(1);
    expect(sink.records[0]).toMatchObject({
      purpose: "answering",
      provider: "answering-provider",
      model: "answering-model",
      inputTokens: 10,
      outputTokens: 4,
      costUsd: (10 * 3 + 4 * 15) / 1_000_000,
      outcome: "ok",
      attempts: 1,
    });
    // invariant 7: no prompt/completion text anywhere in the usage record.
    expect(JSON.stringify(sink.records[0])).not.toContain("secret prompt");
    expect(JSON.stringify(sink.records[0])).not.toContain("Hello");
  });

  it("fires onUsage once with the sink's record on done, error and cancel; never for an unknown purpose; a throwing onUsage is harmless", async () => {
    const run = async (
      script: ChatEvent[],
      opts: { abort?: boolean; purpose?: string; throws?: boolean } = {},
    ) => {
      const provider = new FakeProvider();
      provider.scriptChat(script);
      const { gateway, sink } = buildGateway({ answering: provider });
      const seen: UsageRecord[] = [];
      const controller = new AbortController();
      const events: ChatEvent[] = [];
      for await (const event of gateway.chat({
        purpose: opts.purpose ?? "answering",
        messages: [],
        signal: controller.signal,
        onUsage: (r) => {
          seen.push(r);
          if (opts.throws) throw new Error("observer boom");
        },
      })) {
        events.push(event);
        if (opts.abort && event.type === "text") controller.abort();
      }
      return { seen, sink, events };
    };
    const done: ChatEvent = {
      type: "done",
      usage: { inputTokens: 1, outputTokens: 1 },
    };

    const ok = await run([{ type: "text", text: "a" }, done]);
    expect(ok.seen).toHaveLength(1);
    expect(ok.seen[0]).toEqual(ok.sink.records[0]);

    const err = await run([
      {
        type: "error",
        kind: "upstream",
        message: "x",
        usage: { inputTokens: 0, outputTokens: 0 },
      },
    ]);
    expect(err.seen).toHaveLength(1);
    expect(err.seen[0]).toEqual(err.sink.records[0]);
    expect(err.seen[0]?.outcome).toBe("error");

    const cancel = await run(
      [{ type: "text", text: "a" }, { type: "text", text: "b" }, done],
      { abort: true },
    );
    expect(cancel.seen).toHaveLength(1);
    expect(cancel.seen[0]).toEqual(cancel.sink.records[0]);
    expect(cancel.seen[0]?.outcome).toBe("cancelled");

    const unknown = await run([], { purpose: "nope" });
    expect(unknown.seen).toHaveLength(0);

    const plain = await run([{ type: "text", text: "a" }, done]);
    const thrown = await run([{ type: "text", text: "a" }, done], {
      throws: true,
    });
    expect(thrown.events).toEqual(plain.events);
    expect(thrown.sink.records).toHaveLength(1);
  });

  it("fails immediately with a config error naming the purpose, without calling any provider (US1 AC2, invariant 1)", async () => {
    const provider = new FakeProvider();
    const { gateway, sink } = buildGateway({ answering: provider });

    const events = await collect(
      gateway.chat({ purpose: "missing", messages: [] }),
    );

    expect(events).toEqual([
      {
        type: "error",
        kind: "config",
        message: expect.stringContaining("missing"),
        usage: { inputTokens: 0, outputTokens: 0 },
      },
    ]);
    expect(provider.chatCalls).toHaveLength(0);
    expect(sink.records).toHaveLength(0);
  });

  it("ends the stream with a distinguishable error when the provider fails mid-stream, and still records usage (US1 AC3, US4 AC2)", async () => {
    const provider = new FakeProvider();
    provider.scriptChat([
      { type: "text", text: "partial" },
      {
        type: "error",
        kind: "upstream",
        message: "boom",
        usage: { inputTokens: 3, outputTokens: 1 },
      },
    ]);
    const { gateway, sink } = buildGateway({ answering: provider });

    const events = await collect(
      gateway.chat({ purpose: "answering", messages: [] }),
    );

    expect(events).toEqual([
      { type: "text", text: "partial" },
      {
        type: "error",
        kind: "upstream",
        message: "boom",
        usage: { inputTokens: 3, outputTokens: 1 },
      },
    ]);
    expect(sink.records).toHaveLength(1);
    expect(sink.records[0]).toMatchObject({
      outcome: "error",
      inputTokens: 3,
      outputTokens: 1,
    });
  });

  it("ends the stream with a cancelled error when the caller aborts, and records outcome cancelled (US1 AC4, invariant 3)", async () => {
    const provider = new FakeProvider();
    provider.scriptChat([
      { type: "text", text: "partial" },
      { type: "text", text: "more" },
      { type: "done", usage: { inputTokens: 1, outputTokens: 1 } },
    ]);
    const { gateway, sink } = buildGateway({ answering: provider });
    const controller = new AbortController();

    const events: ChatEvent[] = [];
    for await (const event of gateway.chat({
      purpose: "answering",
      messages: [],
      signal: controller.signal,
    })) {
      events.push(event);
      if (event.type === "text") controller.abort();
    }

    expect(events).toEqual([
      { type: "text", text: "partial" },
      {
        type: "error",
        kind: "cancelled",
        message: expect.any(String),
        usage: { inputTokens: 0, outputTokens: 0 },
      },
    ]);
    // the upstream (fake) request stopped producing events once aborted —
    // no further text was delivered.
    expect(sink.records).toHaveLength(1);
    expect(sink.records[0]).toMatchObject({ outcome: "cancelled" });
  });

  it("uses and reports each purpose's own provider name and model (US3 AC1)", async () => {
    const hosted = new FakeProvider();
    hosted.scriptChat([
      { type: "done", usage: { inputTokens: 1, outputTokens: 1 } },
    ]);
    const local = new FakeProvider();
    local.scriptChat([
      { type: "done", usage: { inputTokens: 2, outputTokens: 2 } },
    ]);
    const { gateway, sink } = buildGateway({
      answering: hosted,
      summarizing: local,
    });

    await collect(gateway.chat({ purpose: "answering", messages: [] }));
    await collect(gateway.chat({ purpose: "summarizing", messages: [] }));

    expect(hosted.chatCalls).toHaveLength(1);
    expect(local.chatCalls).toHaveLength(1);
    expect(sink.records.map((r) => [r.provider, r.model])).toEqual([
      ["answering-provider", "answering-model"],
      ["summarizing-provider", "summarizing-model"],
    ]);
  });

  it("records cost as unknown (null), never 0, for a model with no configured price (US4 AC3, invariant 6)", async () => {
    const provider = new FakeProvider();
    provider.scriptChat([
      { type: "done", usage: { inputTokens: 5, outputTokens: 5 } },
    ]);
    // "summarizing" gets no price-table entry in buildGateway's config.
    const { gateway, sink } = buildGateway({ summarizing: provider });

    await collect(gateway.chat({ purpose: "summarizing", messages: [] }));

    expect(sink.records[0]?.costUsd).toBeNull();
  });
});

/** Builds a gateway wired to one named fake embedding provider. */
function buildEmbedGateway(
  provider: FakeProvider,
  purposeOverrides: Partial<AiConfig["purposes"][string]> = {},
) {
  const config: AiConfig = {
    providers: {
      "embed-provider": { kind: "fake", baseUrl: "http://fake/embed-provider" },
    },
    purposes: {
      embedding: {
        provider: "embed-provider",
        model: "embed-model",
        op: "embed",
        ...purposeOverrides,
      },
    },
    prices: {},
  };
  const sink = memorySink();
  const gateway = createGateway({
    config,
    sink,
    adapters: { fake: () => provider },
  });
  return { gateway, sink };
}

/** A 1024-length vector identifiable by its first element, for order assertions. */
function marker(n: number): number[] {
  const vector = new Array(1024).fill(0);
  vector[0] = n;
  return vector;
}

describe("gateway.embed", () => {
  it("returns one vector per text in input order, each length 1024, labeled with model and dim (US2 AC1, invariant 4)", async () => {
    const provider = new FakeProvider();
    const { gateway, sink } = buildEmbedGateway(provider);

    const result = await gateway.embed({
      purpose: "embedding",
      texts: ["a", "b", "c"],
    });

    expect(result.vectors).toHaveLength(3);
    for (const v of result.vectors) {
      expect(v.vector).toHaveLength(1024);
      expect(v.model).toBe("embed-model");
      expect(v.dim).toBe(1024);
    }
    expect(sink.records).toHaveLength(1);
    expect(sink.records[0]).toMatchObject({
      purpose: "embedding",
      provider: "embed-provider",
      model: "embed-model",
      outcome: "ok",
      attempts: 1,
    });
  });

  it("rejects the whole call, naming expected and actual dimension, when the provider returns a wrong-length vector (US2 AC2, invariant 4)", async () => {
    const provider = new FakeProvider();
    provider.scriptEmbed({ vectors: [new Array(512).fill(0)] });
    const { gateway, sink } = buildEmbedGateway(provider);

    await expect(
      gateway.embed({ purpose: "embedding", texts: ["only"] }),
    ).rejects.toThrow(/512/);
    expect(sink.records).toHaveLength(1);
    expect(sink.records[0]).toMatchObject({ outcome: "error" });
  });

  it("returns an empty result without calling the provider or recording usage for an empty batch (US2 AC3, invariant 5)", async () => {
    const provider = new FakeProvider();
    const { gateway, sink } = buildEmbedGateway(provider);

    const result = await gateway.embed({ purpose: "embedding", texts: [] });

    expect(result).toEqual({
      vectors: [],
      usage: { inputTokens: 0, outputTokens: 0 },
    });
    expect(provider.embedCalls).toHaveLength(0);
    expect(sink.records).toHaveLength(0);
  });

  it("splits a batch larger than batchSize into multiple provider calls, preserving input order (spec edge case)", async () => {
    const provider = new FakeProvider();
    provider.scriptEmbed(
      { vectors: [marker(1), marker(2)] },
      { vectors: [marker(3), marker(4)] },
      { vectors: [marker(5)] },
    );
    const { gateway } = buildEmbedGateway(provider, { batchSize: 2 });

    const result = await gateway.embed({
      purpose: "embedding",
      texts: ["a", "b", "c", "d", "e"],
    });

    expect(provider.embedCalls.map((c) => c.texts)).toEqual([
      ["a", "b"],
      ["c", "d"],
      ["e"],
    ]);
    expect(result.vectors.map((v) => v.vector[0])).toEqual([1, 2, 3, 4, 5]);
  });

  it("fails immediately with an error naming the purpose for an unknown purpose, without calling any provider (invariant 1 symmetry)", async () => {
    const provider = new FakeProvider();
    const { gateway } = buildEmbedGateway(provider);

    await expect(
      gateway.embed({ purpose: "missing", texts: ["x"] }),
    ).rejects.toThrow(/missing/);
    expect(provider.embedCalls).toHaveLength(0);
  });
});

describe("FakeProvider purpose queues (spec 031)", () => {
  const done = {
    type: "done" as const,
    usage: { inputTokens: 1, outputTokens: 1 },
  };

  it("consumes a purpose's queue before the global FIFO", async () => {
    const provider = new FakeProvider();
    provider.scriptChat([{ type: "text", text: "global" }, done]);
    provider.scriptChatFor("answering", [
      { type: "text", text: "purpose" },
      done,
    ]);
    const { gateway } = buildGateway({ answering: provider });

    const first = await collect(
      gateway.chat({ purpose: "answering", messages: [] }),
    );
    expect(first[0]).toEqual({ type: "text", text: "purpose" });
    const second = await collect(
      gateway.chat({ purpose: "answering", messages: [] }),
    );
    expect(second[0]).toEqual({ type: "text", text: "global" });
  });

  it("keeps queues independent per purpose", async () => {
    const provider = new FakeProvider();
    provider.scriptChatFor("a", [{ type: "text", text: "for-a" }, done]);
    provider.scriptChatFor("b", [{ type: "text", text: "for-b" }, done]);
    const { gateway } = buildGateway({ a: provider, b: provider });
    const b = await collect(gateway.chat({ purpose: "b", messages: [] }));
    const a = await collect(gateway.chat({ purpose: "a", messages: [] }));
    expect(b[0]).toEqual({ type: "text", text: "for-b" });
    expect(a[0]).toEqual({ type: "text", text: "for-a" });
  });

  it("strict mode fails an unscripted call with a config error", async () => {
    const provider = new FakeProvider();
    provider.strict = true;
    const { gateway } = buildGateway({ answering: provider });
    const events = await collect(
      gateway.chat({ purpose: "answering", messages: [] }),
    );
    expect(events[0]).toMatchObject({
      type: "error",
      kind: "config",
      message: "unscripted call for answering",
    });
  });

  it("non-strict default is unchanged: an unscripted call is a bare done", async () => {
    const provider = new FakeProvider();
    const { gateway } = buildGateway({ answering: provider });
    const events = await collect(
      gateway.chat({ purpose: "answering", messages: [] }),
    );
    expect(events).toEqual([
      { type: "done", usage: { inputTokens: 0, outputTokens: 0 } },
    ]);
  });
});

describe("no vendor lock-in (decision-0007, invariant 10)", () => {
  it("names no provider, vendor, or key variable anywhere in apps/server/src/ai/", () => {
    const aiDir = fileURLToPath(new URL("../src/ai/", import.meta.url));
    const files = readdirSync(aiDir, { recursive: true })
      .filter((f): f is string => typeof f === "string" && f.endsWith(".ts"))
      .map((f) => join(aiDir, f));
    expect(files.length).toBeGreaterThan(0);

    // Vendors/providers no source file may hard-code by name. The literal
    // protocol kind "openai-compatible" is allowed and stripped before matching.
    const vendorPattern =
      /\b(openai|anthropic|claude|gpt|azure|google|gemini|cohere|mistral|groq|together|perplexity|huggingface|bedrock|vertex|palm|ollama|deepseek|xai|grok)\b/i;
    // A literal, all-caps env var name for a key (e.g. OPENAI_API_KEY) — the
    // generic `apiKeyEnv` identifier is camelCase and does not match.
    const keyVarPattern = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_(API_)?KEY\b/;

    for (const file of files) {
      const content = readFileSync(file, "utf8").replaceAll(
        "openai-compatible",
        "",
      );
      expect(content, file).not.toMatch(vendorPattern);
      expect(content, file).not.toMatch(keyVarPattern);
    }
  });
});

describe("gateway.chat truncated flag (TASK-0192)", () => {
  const run = async (outputTokens: number, maxTokens?: number) => {
    const provider = new FakeProvider();
    provider.scriptChat([
      { type: "text", text: "x" },
      { type: "done", usage: { inputTokens: 1, outputTokens } },
    ]);
    const { gateway, sink } = buildGateway({ answering: provider }, maxTokens);
    await collect(
      gateway.chat({
        purpose: "answering",
        messages: [{ role: "user", content: "hi" }],
      }),
    );
    return sink.records[0]?.truncated;
  };

  it("is true at the cap, false below it, false with no maxTokens", async () => {
    expect(await run(1200, 1200)).toBe(true);
    expect(await run(1199, 1200)).toBe(false);
    expect(await run(5000)).toBe(false);
  });
});

describe("gateway.chat structured mode (TASK-0273)", () => {
  const run = async (structured?: "tool" | "json-schema") => {
    const seen: unknown[] = [];
    const gateway = createGateway({
      config: {
        providers: { p: { kind: "fake", baseUrl: "http://x" } },
        purposes: {
          a: {
            provider: "p",
            model: "m",
            op: "chat",
            ...(structured ? { structured } : {}),
          },
        },
        prices: {},
      },
      sink: memorySink(),
      adapters: {
        fake: () => ({
          ops: new Set(["chat"]),
          async *chat(_m, _r, opts) {
            seen.push(opts.structured);
            yield { type: "done", usage: { inputTokens: 0, outputTokens: 0 } };
          },
        }),
      },
    });
    await collect(
      gateway.chat({
        purpose: "a",
        messages: [{ role: "user", content: "x" }],
        output: { name: "a", schema: { type: "object" } },
      }),
    );
    return seen;
  };

  it("forwards the purpose's mode to the provider opts", async () => {
    expect(await run("tool")).toEqual(["tool"]);
    expect(await run("json-schema")).toEqual(["json-schema"]);
  });

  it("passes undefined when the purpose sets no mode", async () => {
    expect(await run()).toEqual([undefined]);
  });
});
