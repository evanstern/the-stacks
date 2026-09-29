import { describe, expect, it } from "vitest";
import { FakeProvider } from "../src/ai/adapters/fake.js";
import type { AiConfig } from "../src/ai/config.js";
import { createGateway } from "../src/ai/gateway.js";
import type { ChatEvent } from "../src/ai/types.js";
import { memorySink } from "../src/ai/usage.js";

/** Builds a gateway wired to one or more named fake providers, keyed by purpose. */
function buildGateway(byPurpose: Record<string, FakeProvider>) {
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
