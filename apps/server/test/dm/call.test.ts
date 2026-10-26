import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { ChatEvent, ChatRequest } from "../../src/ai/types.js";
import { callJson, callText, stripFence } from "../../src/dm/pipeline/call.js";

const usage = { inputTokens: 1, outputTokens: 1 };

function gatewayOf(scripts: ChatEvent[][]) {
  const requests: ChatRequest[] = [];
  return {
    requests,
    gateway: {
      chat: async function* (req: ChatRequest) {
        requests.push({ ...req, messages: [...req.messages] });
        for (const e of scripts.shift() ?? []) yield e;
      },
    },
  };
}

const text = (t: string): ChatEvent[] => [
  { type: "text", text: t },
  { type: "done", usage },
];
const Schema = z.object({ n: z.number() });
const req = (signal = new AbortController().signal) => ({
  purpose: "dm.director" as const,
  promptVersion: "dm.director-v1",
  system: "sys",
  user: "usr",
  schema: Schema,
  signal,
});

describe("callJson", () => {
  it("parses fenced JSON", async () => {
    const { gateway } = gatewayOf([text('```json\n{"n": 3}\n```')]);
    const r = await callJson({ gateway }, req());
    expect(r).toMatchObject({ ok: true, value: { n: 3 } });
    expect(r.calls).toEqual([
      {
        purpose: "dm.director",
        promptVersion: "dm.director-v1",
        attempt: 1,
        outcome: "ok",
        errorKind: null,
      },
    ]);
  });

  it("joins text events and names exactly one purpose per call", async () => {
    const { gateway, requests } = gatewayOf([
      [
        { type: "text", text: '{"n":' },
        { type: "text", text: " 7}" },
        { type: "done", usage },
      ],
    ]);
    const r = await callJson({ gateway }, req());
    expect(r.ok).toBe(true);
    expect(requests.map((q) => q.purpose)).toEqual(["dm.director"]);
  });

  it("re-asks once with the bad text and the issues", async () => {
    const { gateway, requests } = gatewayOf([
      text("not json"),
      text('{"n": 1}'),
    ]);
    const r = await callJson({ gateway }, req());
    expect(r).toMatchObject({ ok: true, value: { n: 1 } });
    expect(r.calls.map((c) => [c.attempt, c.outcome])).toEqual([
      [1, "invalid-json"],
      [2, "ok"],
    ]);
    const second = requests[1]?.messages ?? [];
    expect(second.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(second[1]?.content).toBe("not json");
    expect(second[2]?.content).toContain("rejected");
  });

  it("returns invalid-output after a second failure", async () => {
    const { gateway, requests } = gatewayOf([text('{"n":"x"}'), text("{}")]);
    const r = await callJson({ gateway }, req());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.kind).toBe("invalid-output");
    expect(requests).toHaveLength(2);
    expect(r.calls.map((c) => c.outcome)).toEqual([
      "invalid-json",
      "invalid-json",
    ]);
  });

  it("passes a gateway error kind through without a re-ask", async () => {
    const { gateway, requests } = gatewayOf([
      [{ type: "error", kind: "rate_limit", message: "slow down", usage }],
    ]);
    const r = await callJson({ gateway }, req());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.kind).toBe("gateway");
    expect(r.error.detail).toMatchObject({ errorKind: "rate_limit" });
    expect(r.calls[0]).toMatchObject({
      outcome: "error",
      errorKind: "rate_limit",
    });
    expect(requests).toHaveLength(1);
  });

  it("reports aborted when the signal is aborted", async () => {
    const controller = new AbortController();
    const gateway = {
      chat: async function* () {
        controller.abort();
        yield { type: "done" as const, usage };
      },
    };
    const r = await callJson({ gateway }, req(controller.signal));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("aborted");
  });
});

describe("callText", () => {
  it("returns the joined prose", async () => {
    const { gateway } = gatewayOf([
      [
        { type: "text", text: "The ferry " },
        { type: "text", text: "groans." },
        { type: "done", usage },
      ],
    ]);
    const { schema: _schema, ...rest } = req();
    const r = await callText({ gateway }, rest);
    expect(r).toMatchObject({ ok: true, text: "The ferry groans." });
  });
});

describe("stripFence", () => {
  it("strips one surrounding fence and leaves bare text alone", () => {
    expect(stripFence('```\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripFence('  {"a":1}  ')).toBe('{"a":1}');
  });
});
