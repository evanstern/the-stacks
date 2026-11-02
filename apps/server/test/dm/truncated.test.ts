import { describe, expect, it } from "vitest";
import { z } from "zod";
import { FakeProvider } from "../../src/ai/adapters/fake.js";
import type { AiConfig } from "../../src/ai/config.js";
import { createGateway } from "../../src/ai/gateway.js";
import { memorySink } from "../../src/ai/usage.js";
import { callJson } from "../../src/dm/pipeline/call.js";
import type { RecordedCall } from "../../src/dm/pipeline/context.js";

// TASK-0192 merge condition: the real gateway over a fake provider records
// `truncated` when output equals maxTokens, `invalid-json` one token below.
function run(outputTokens: number) {
  const provider = new FakeProvider();
  const reply = (n: number) => [
    { type: "text" as const, text: "no json here" },
    { type: "done" as const, usage: { inputTokens: 10, outputTokens: n } },
  ];
  provider.scriptChat(reply(outputTokens), reply(outputTokens));
  const config: AiConfig = {
    providers: { fake: { kind: "fake", baseUrl: "http://fake/p" } },
    purposes: {
      "dm.interpret": {
        provider: "fake",
        model: "m",
        op: "chat",
        maxTokens: 1200,
      },
    },
    prices: {},
  };
  const gateway = createGateway({
    config,
    sink: memorySink(),
    adapters: { fake: () => provider },
  });
  const calls: RecordedCall[] = [];
  return callJson(
    {
      gateway,
      recordCall: async (c) => {
        calls.push(c);
      },
    },
    {
      purpose: "dm.interpret",
      promptVersion: "t",
      system: "s",
      user: "u",
      schema: z.object({ n: z.number() }),
      signal: new AbortController().signal,
    },
  ).then(() => calls);
}

describe("truncated outcome through the real gateway", () => {
  it("records truncated at 1200/1200", async () => {
    expect((await run(1200)).map((c) => c.outcome)).toEqual([
      "truncated",
      "truncated",
    ]);
  });
  it("records invalid-json at 1199/1200", async () => {
    expect((await run(1199)).map((c) => c.outcome)).toEqual([
      "invalid-json",
      "invalid-json",
    ]);
  });
});
