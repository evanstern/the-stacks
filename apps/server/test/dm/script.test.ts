import { describe, expect, it } from "vitest";
import { createGateway } from "../../src/ai/gateway.js";
import type { ChatEvent } from "../../src/ai/types.js";
import { memorySink } from "../../src/ai/usage.js";
import {
  DM_PURPOSES,
  missingDmPurposes,
  PURPOSE_OF,
} from "../../src/dm/purposes.js";
import { createScriptedDm, loadDmScript } from "../../src/dm/script/load.js";

async function collect(it: AsyncIterable<ChatEvent>): Promise<ChatEvent[]> {
  const out: ChatEvent[] = [];
  for await (const e of it) out.push(e);
  return out;
}

const SCRIPT = {
  v: 1,
  name: "unit",
  dice: [4, 17],
  calls: [
    {
      purpose: "dm.narrate",
      respond: { type: "text", value: "first" },
      usage: { inputTokens: 3, outputTokens: 2 },
    },
    { purpose: "dm.narrate", respond: { type: "text", value: "second" } },
    {
      purpose: "dm.director",
      respond: { type: "json", value: { pace: "slow" } },
    },
    {
      purpose: "dm.companion",
      respond: { type: "error", kind: "upstream", message: "boom" },
    },
  ],
};

function gatewayFor(script: unknown) {
  const dm = createScriptedDm(loadDmScript(script));
  const sink = memorySink();
  const gateway = createGateway({
    config: dm.aiConfig,
    sink,
    adapters: { fake: () => dm.provider },
  });
  return { dm, gateway };
}

describe("DM purposes", () => {
  it("names six purposes, one per caller, with no vendor in source", () => {
    expect(DM_PURPOSES).toHaveLength(6);
    expect(Object.values(PURPOSE_OF).sort()).toEqual([...DM_PURPOSES].sort());
    expect(missingDmPurposes({ "dm.narrate": {} })).toHaveLength(5);
  });
});

describe("DM script", () => {
  it("rejects a malformed script", () => {
    expect(() => loadDmScript({ v: 2 })).toThrow();
    expect(() =>
      loadDmScript({
        v: 1,
        name: "x",
        dice: [],
        calls: [{ purpose: "dm.bogus", respond: { type: "text", value: "a" } }],
      }),
    ).toThrow();
  });

  it("serves each purpose from its own queue in document order", async () => {
    const { dm, gateway } = gatewayFor(SCRIPT);
    expect(dm.remaining()).toEqual({
      calls: {
        "dm.director": 1,
        "dm.interpret": 0,
        "dm.adjudicate": 0,
        "dm.narrate": 2,
        "dm.chronicle": 0,
        "dm.companion": 1,
      },
      dice: 2,
    });
    const narrate1 = await collect(
      gateway.chat({ purpose: "dm.narrate", messages: [] }),
    );
    expect(narrate1[0]).toEqual({ type: "text", text: "first" });
    expect(narrate1[1]).toEqual({
      type: "done",
      usage: { inputTokens: 3, outputTokens: 2 },
    });
    const director = await collect(
      gateway.chat({ purpose: "dm.director", messages: [] }),
    );
    expect(director[0]).toEqual({
      type: "text",
      text: JSON.stringify({ pace: "slow" }),
    });
    const narrate2 = await collect(
      gateway.chat({ purpose: "dm.narrate", messages: [] }),
    );
    expect(narrate2[0]).toEqual({ type: "text", text: "second" });
    const companion = await collect(
      gateway.chat({ purpose: "dm.companion", messages: [] }),
    );
    expect(companion[0]).toMatchObject({
      type: "error",
      kind: "upstream",
      message: "boom",
    });
    expect(dm.remaining().calls["dm.narrate"]).toBe(0);
    expect(Object.values(dm.remaining().calls).every((n) => n === 0)).toBe(
      true,
    );
  });

  it("fails an unscripted call loudly (strict)", async () => {
    const { gateway } = gatewayFor(SCRIPT);
    const events = await collect(
      gateway.chat({ purpose: "dm.chronicle", messages: [] }),
    );
    expect(events[0]).toMatchObject({ type: "error", kind: "config" });
    expect((events[0] as { message: string }).message).toContain(
      "unscripted call for dm.chronicle",
    );
  });

  it("feeds one shared scripted rng", () => {
    const { dm } = gatewayFor(SCRIPT);
    expect(dm.gateRng()).toBe(dm.rng);
    expect(dm.rng.rollDie(6)).toBe(4);
    expect(dm.gateRng().rollDie(20)).toBe(17);
    expect(dm.remaining().dice).toBe(0);
  });
});
