import { describe, expect, it } from "vitest";
import { FakeProvider } from "../../src/ai/adapters/fake.js";
import type { AiConfig } from "../../src/ai/config.js";
import { createGateway } from "../../src/ai/gateway.js";
import type { ChatEvent } from "../../src/ai/types.js";
import { memorySink } from "../../src/ai/usage.js";
import { DM_PURPOSES } from "../../src/dm/purposes.js";
import {
  budgetGateway,
  CEILING_MESSAGE,
  countingSink,
  estimate,
  providerPreflight,
} from "../../src/playtest/budget.js";

const scenario = {
  moves: {
    free: [{ text: "a" }, { text: "b" }, { text: "c" }],
    combat: { text: "c" },
    fallback: [{ text: "f" }],
  },
  limits: { maxMoves: 30, maxWallMs: 900000 },
};

function config(over: Partial<AiConfig> = {}): AiConfig {
  const names = [...DM_PURPOSES, "playtest.audit"];
  return {
    providers: { fake: { kind: "fake", baseUrl: "http://fake/x" } },
    purposes: {
      ...Object.fromEntries(
        names.map((p) => [
          p,
          { provider: "fake", model: "m", op: "chat" as const },
        ]),
      ),
      embedding: { provider: "fake", model: "e", op: "embed" as const },
    },
    prices: {
      "fake/m": { inputPerMTok: 1000, outputPerMTok: 1000 },
      "fake/e": { inputPerMTok: 100, outputPerMTok: 0 },
    },
    ...over,
  };
}

describe("estimate", () => {
  it("pins the per-purpose table of contracts/cost-guard.md", () => {
    const e = estimate({ scenario, aiConfig: config() });
    expect(e.turns).toEqual({ expected: 9, max: 60 });
    const table = Object.fromEntries(
      e.lines.map((l) => [
        l.purpose,
        [l.expectedCalls, l.upperCalls, l.inputTokensPerCall],
      ]),
    );
    expect(table).toEqual({
      "dm.director": [9, 60, 6000],
      "dm.interpret": [9, 60, 5500],
      "dm.adjudicate": [2, 60, 6500],
      "dm.narrate": [9, 180, 4500],
      "dm.audit": [9, 180, 2500],
      "dm.chronicle": [9, 60, 3500],
      "dm.companion": [18, 120, 4500],
      "playtest.audit": [9, 120, 5500],
      embedding: [2, 60, 200],
    });
  });

  it("uses configured maxTokens as the output size, else the purpose default", () => {
    const cfg = config();
    (cfg.purposes["dm.narrate"] as { maxTokens?: number }).maxTokens = 123;
    const e = estimate({ scenario, aiConfig: cfg });
    const out = Object.fromEntries(
      e.lines.map((l) => [l.purpose, l.outputTokensPerCall]),
    );
    expect(out["dm.narrate"]).toBe(123);
    expect(out["dm.director"]).toBe(4000);
    expect(out["playtest.audit"]).toBe(700);
    expect(out.embedding).toBe(0);
  });

  it("keeps expected at or under the upper bound for every purpose", () => {
    const e = estimate({ scenario, aiConfig: config() });
    for (const l of e.lines) {
      expect(l.expectedCalls).toBeLessThanOrEqual(l.upperCalls);
      expect(l.expectedUsd as number).toBeLessThanOrEqual(l.upperUsd as number);
    }
    expect(e.expectedUsd as number).toBeLessThanOrEqual(e.upperUsd as number);
  });

  it("estimates an audit alone from the segment count", () => {
    const e = estimate({
      scenario,
      aiConfig: config(),
      segments: 8,
      include: { dm: false, audit: true },
    });
    expect(e.lines).toHaveLength(1);
    expect(e.lines[0]).toMatchObject({
      purpose: "playtest.audit",
      expectedCalls: 8,
      upperCalls: 16,
    });
  });
});

function pricedGateway(responses: number) {
  const provider = new FakeProvider();
  provider.strict = true;
  for (let i = 0; i < responses; i += 1) {
    const events: ChatEvent[] = [
      { type: "text", text: "ok" },
      { type: "done", usage: { inputTokens: 1000, outputTokens: 1000 } },
    ];
    provider.scriptChatFor("dm.narrate", events);
  }
  const sink = countingSink(memorySink());
  const gateway = createGateway({
    config: config(),
    sink,
    adapters: { fake: () => provider },
  });
  return { provider, sink, gateway };
}

async function drain(it: AsyncIterable<ChatEvent>): Promise<ChatEvent[]> {
  const out: ChatEvent[] = [];
  for await (const ev of it) out.push(ev);
  return out;
}

describe("budgetGateway", () => {
  const req = {
    purpose: "dm.narrate",
    messages: [{ role: "user" as const, content: "hi" }],
  };

  it("lets one call through at a one-call ceiling and cancels the next without a provider call", async () => {
    const { provider, sink, gateway } = pricedGateway(2);
    // One call costs (1000*1000 + 1000*1000) / 1e6 = 2 USD.
    const guarded = budgetGateway(gateway, sink, 2);
    const first = await drain(guarded.chat(req));
    expect(first.at(-1)?.type).toBe("done");
    expect(sink.totals().costUsd).toBe(2);
    const second = await drain(guarded.chat(req));
    expect(second).toHaveLength(1);
    expect(second[0]).toMatchObject({
      type: "error",
      kind: "cancelled",
      message: CEILING_MESSAGE,
    });
    expect(provider.pendingFor("dm.narrate")).toBe(1);
    expect(sink.totals().calls).toBe(1);
  });

  it("throws from embed past the ceiling without a provider call", async () => {
    const { sink, gateway } = pricedGateway(1);
    const guarded = budgetGateway(gateway, sink, 2);
    await drain(guarded.chat(req));
    await expect(
      guarded.embed({ purpose: "embedding", texts: ["q"] }),
    ).rejects.toThrow(CEILING_MESSAGE);
    expect(sink.totals().calls).toBe(1);
  });

  it("totals tokens and cost across records", async () => {
    const { sink, gateway } = pricedGateway(1);
    await drain(gateway.chat(req));
    expect(sink.totals()).toEqual({
      calls: 1,
      inputTokens: 1000,
      outputTokens: 1000,
      costUsd: 2,
    });
  });
});

describe("providerPreflight", () => {
  const needs = { dm: true, audit: true };

  it("returns nothing for a complete priced config outside CI", () => {
    expect(providerPreflight({}, config(), needs)).toEqual([]);
  });

  it("refuses under CI", () => {
    const r = providerPreflight({ CI: "1" }, config(), needs);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ step: 1 });
    expect(r[0]?.message).toContain("refused under CI");
  });

  it("names every missing purpose", () => {
    const cfg = config();
    delete cfg.purposes["dm.narrate"];
    delete cfg.purposes["playtest.audit"];
    const r = providerPreflight({}, cfg, needs);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ step: 2 });
    expect(r[0]?.message).toContain("dm.narrate");
    expect(r[0]?.message).toContain("playtest.audit");
  });

  it("names every unpriced model", () => {
    const cfg = config({ prices: {} });
    const r = providerPreflight({}, cfg, needs);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ step: 3 });
    expect(r[0]?.message).toContain("fake/m");
    expect(r[0]?.message).toContain("fake/e");
  });

  it("orders CI, then missing purposes, then unpriced models", () => {
    const cfg = config({ prices: {} });
    delete cfg.purposes["dm.audit"];
    const r = providerPreflight({ CI: "true" }, cfg, needs);
    expect(r.map((x) => x.step)).toEqual([1, 2, 3]);
  });

  it("skips dm purposes for an audit-only need", () => {
    const cfg = config();
    for (const p of DM_PURPOSES) delete cfg.purposes[p];
    expect(providerPreflight({}, cfg, { dm: false, audit: true })).toEqual([]);
  });
});
