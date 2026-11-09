import { describe, expect, it } from "vitest";
import { z } from "zod";
import type {
  ChatEvent,
  ChatRequest,
  UsageRecord,
} from "../../src/ai/types.js";
import {
  callJson,
  callText,
  excerptOf,
  extractObject,
  stripFence,
  stripThink,
} from "../../src/dm/pipeline/call.js";
import type { RecordedCall } from "../../src/dm/pipeline/context.js";

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

const usageRecord = (over: Partial<UsageRecord> = {}): UsageRecord => ({
  purpose: "dm.director",
  provider: "fake-provider",
  model: "fake-model",
  inputTokens: 11,
  outputTokens: 7,
  costUsd: 0.002,
  durationMs: 15,
  attempts: 1,
  truncated: false,
  outcome: "ok",
  at: "2026-10-26T00:00:00.000Z",
  ...over,
});

/** Like gatewayOf, but each script also fires onUsage the way the real gateway does. */
function usageGatewayOf(
  scripts: { events: ChatEvent[]; record: UsageRecord | null }[],
) {
  return {
    gateway: {
      chat: async function* (req: ChatRequest) {
        const next = scripts.shift();
        // Like the real gateway: the record fires in `finally`, so an early
        // return by the consumer still delivers it.
        try {
          for (const e of next?.events ?? []) yield e;
        } finally {
          if (next?.record) req.onUsage?.(next.record);
        }
      },
    },
  };
}

const NULL_USAGE = {
  provider: null,
  model: null,
  inputTokens: null,
  outputTokens: null,
  costUsd: null,
  durationMs: null,
};

const text = (t: string): ChatEvent[] => [
  { type: "text", text: t },
  { type: "done", usage },
];
const Schema = z.object({ n: z.number() });
const req = (signal = new AbortController().signal) => ({
  purpose: "dm.director" as const,
  promptVersion: "dm.director-v2",
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
        promptVersion: "dm.director-v2",
        attempt: 1,
        outcome: "ok",
        errorKind: null,
        ...NULL_USAGE,
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
      "schema-mismatch",
      "schema-mismatch",
    ]);
  });

  it("records purpose, version, issues and one excerpt per failed attempt", async () => {
    const { gateway } = gatewayOf([
      [
        { type: "text", text: '{"n":"x"}' },
        { type: "done", usage: { inputTokens: 1, outputTokens: 42 } },
      ],
      text("{}"),
    ]);
    const r = await callJson({ gateway }, req());
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const detail = r.error.detail as {
      purpose: string;
      promptVersion: string;
      issues: string;
      attempts: Record<string, unknown>[];
    };
    expect(detail.purpose).toBe("dm.director");
    expect(detail.promptVersion).toBe("dm.director-v2");
    expect(detail.issues).toContain("n:");
    expect(detail.attempts).toHaveLength(2);
    expect(detail.attempts[0]).toMatchObject({
      attempt: 1,
      outputTokens: 42,
      chars: 9,
      excerpt: '{"n":"x"}',
    });
    expect(detail.attempts[0]?.issues).toContain("n:");
    expect(detail.attempts[1]).toMatchObject({ attempt: 2, chars: 2 });
  });

  it("records outputTokens as null when the stream has no usage", async () => {
    const { gateway } = gatewayOf([[{ type: "text", text: "{}" }], text("{}")]);
    const r = await callJson({ gateway }, req());
    if (r.ok) return;
    const attempts = (
      r.error.detail as { attempts: { outputTokens: unknown }[] }
    ).attempts;
    expect(attempts[0]?.outputTokens).toBeNull();
    expect(attempts[1]?.outputTokens).toBe(1);
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

describe("usage fields and recordCall", () => {
  it("fills the usage fields on a first-try ok", async () => {
    const { gateway } = usageGatewayOf([
      { events: text('{"n": 1}'), record: usageRecord() },
    ]);
    const r = await callJson({ gateway }, req());
    expect(r.calls).toEqual([
      {
        purpose: "dm.director",
        promptVersion: "dm.director-v2",
        attempt: 1,
        outcome: "ok",
        errorKind: null,
        provider: "fake-provider",
        model: "fake-model",
        inputTokens: 11,
        outputTokens: 7,
        costUsd: 0.002,
        durationMs: 15,
      },
    ]);
  });

  it("gives a repaired invalid-json two records with two usages", async () => {
    const { gateway } = usageGatewayOf([
      { events: text("nope"), record: usageRecord({ inputTokens: 1 }) },
      { events: text('{"n": 2}'), record: usageRecord({ inputTokens: 2 }) },
    ]);
    const r = await callJson({ gateway }, req());
    expect(r.calls.map((c) => [c.outcome, c.inputTokens])).toEqual([
      ["invalid-json", 1],
      ["ok", 2],
    ]);
  });

  it("fills the usage fields on a gateway error", async () => {
    const { gateway } = usageGatewayOf([
      {
        events: [{ type: "error", kind: "upstream", message: "x", usage }],
        record: usageRecord({ outcome: "error", costUsd: null }),
      },
    ]);
    const r = await callJson({ gateway }, req());
    expect(r.calls[0]).toMatchObject({
      outcome: "error",
      errorKind: "upstream",
      provider: "fake-provider",
      inputTokens: 11,
      costUsd: null,
    });
  });

  it("uses nulls when the gateway emits no usage record", async () => {
    const { gateway } = usageGatewayOf([
      { events: text('{"n": 1}'), record: null },
    ]);
    const r = await callJson({ gateway }, req());
    expect(r.calls[0]).toMatchObject(NULL_USAGE);
  });

  it("hands recordCall one call per attempt, with http attempts", async () => {
    const { gateway } = usageGatewayOf([
      { events: text("nope"), record: usageRecord({ attempts: 3 }) },
      { events: text('{"n": 2}'), record: usageRecord() },
    ]);
    const recorded: RecordedCall[] = [];
    const r = await callJson(
      {
        gateway,
        recordCall: async (c) => {
          recorded.push(c);
        },
      },
      req(),
    );
    expect(recorded.map((c) => [c.attempt, c.outcome, c.httpAttempts])).toEqual(
      [
        [1, "invalid-json", 3],
        [2, "ok", 1],
      ],
    );
    expect(r.calls).toHaveLength(2);
  });

  it("records an aborted attempt but keeps it out of calls", async () => {
    const controller = new AbortController();
    const gateway = {
      chat: async function* (r: ChatRequest) {
        try {
          controller.abort();
          yield { type: "done" as const, usage };
        } finally {
          r.onUsage?.(usageRecord({ outcome: "cancelled" }));
        }
      },
    };
    const recorded: RecordedCall[] = [];
    const r = await callJson(
      {
        gateway,
        recordCall: async (c) => {
          recorded.push(c);
        },
      },
      req(controller.signal),
    );
    expect(r.ok).toBe(false);
    expect(r.calls).toEqual([]);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ outcome: "aborted", attempt: 1 });
  });

  it("records the callText attempt too", async () => {
    const { gateway } = usageGatewayOf([
      { events: text("prose"), record: usageRecord() },
    ]);
    const recorded: RecordedCall[] = [];
    const { schema: _schema, ...rest } = req();
    const r = await callText(
      {
        gateway,
        recordCall: async (c) => {
          recorded.push(c);
        },
      },
      rest,
    );
    expect(r.calls[0]).toMatchObject({ inputTokens: 11 });
    expect(recorded).toHaveLength(1);
  });

  it("stores exactly the documented keys and no prompt or completion text", async () => {
    const secret = "SCRIPTED-OUTPUT-TEXT-9f3a";
    const { gateway } = usageGatewayOf([
      { events: text(`{"n": 1, "x": "${secret}"}`), record: usageRecord() },
    ]);
    const recorded: RecordedCall[] = [];
    const r = await callJson(
      {
        gateway,
        recordCall: async (c) => {
          recorded.push(c);
        },
      },
      req(),
    );
    expect(Object.keys(r.calls[0] ?? {}).sort()).toEqual(
      [
        "purpose",
        "promptVersion",
        "attempt",
        "outcome",
        "errorKind",
        "provider",
        "model",
        "inputTokens",
        "outputTokens",
        "costUsd",
        "durationMs",
      ].sort(),
    );
    expect(JSON.stringify(r.calls)).not.toContain(secret);
    expect(JSON.stringify(r.calls)).not.toContain("usr");
    expect(JSON.stringify(recorded)).not.toContain(secret);
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

describe("stripThink", () => {
  it("strips leading think blocks only", () => {
    expect(stripThink('<think></think>{"a":1}')).toBe('{"a":1}');
    expect(stripThink('<think>step one\nstep two</think>\n\n{"a":1}')).toBe(
      '{"a":1}',
    );
    expect(stripThink('  \n<think>x</think>{"a":1}')).toBe('{"a":1}');
    expect(stripThink('<think>a</think> <think>b</think>{"a":1}')).toBe(
      '{"a":1}',
    );
    expect(stripThink('{"a":"<think>x</think>"}')).toBe(
      '{"a":"<think>x</think>"}',
    );
    expect(stripThink('<think>reasoning {"a":1}')).toBe(
      '<think>reasoning {"a":1}',
    );
    expect(stripThink('{"a":1}')).toBe('{"a":1}');
    expect(stripThink("<think></think>")).toBe("");
  });
});

describe("think blocks in callJson/callText", () => {
  it("parses a think-prefixed reply on attempt 1", async () => {
    for (const prefix of [
      "<think></think>",
      "<think>The player wants to search.</think>",
    ]) {
      const { gateway, requests } = gatewayOf([text(`${prefix}{"n": 3}`)]);
      const r = await callJson({ gateway }, req());
      expect(r).toMatchObject({ ok: true, value: { n: 3 } });
      expect(r.calls).toHaveLength(1);
      expect(r.calls[0]).toMatchObject({ attempt: 1, outcome: "ok" });
      expect(requests).toHaveLength(1);
    }
  });

  it("parses a fenced body after the block", async () => {
    const { gateway } = gatewayOf([
      text('<think></think>\n```json\n{"n": 3}\n```'),
    ]);
    expect(await callJson({ gateway }, req())).toMatchObject({
      ok: true,
      value: { n: 3 },
    });
  });

  it("re-asks on a think-only reply with the raw text", async () => {
    const { gateway, requests } = gatewayOf([
      text("<think></think>"),
      text('{"n": 1}'),
    ]);
    const r = await callJson({ gateway }, req());
    expect(r).toMatchObject({ ok: true });
    expect(r.calls.map((c) => c.outcome)).toEqual(["invalid-json", "ok"]);
    const msgs = requests[1]!.messages;
    expect(msgs[1]).toEqual({ role: "assistant", content: "<think></think>" });
    expect(msgs[2]!.content).toContain("the reply held only a think block");
  });

  it("keeps the raw think text in the failure excerpt", async () => {
    const { gateway } = gatewayOf([
      text("<think></think>"),
      text("<think></think>"),
    ]);
    const r = await callJson({ gateway }, req());
    expect(r).toMatchObject({ ok: false, error: { kind: "invalid-output" } });
    if (r.ok) throw new Error("expected failure");
    const detail = r.error.detail as { attempts: { excerpt: string }[] };
    expect(detail.attempts[0]?.excerpt).toBe("<think></think>");
  });

  it("callText drops the think block", async () => {
    const { gateway } = gatewayOf([
      text("<think>plan</think>\nThe door creaks."),
    ]);
    const { schema: _schema, ...rest } = req();
    expect(await callText({ gateway }, rest)).toMatchObject({
      ok: true,
      text: "The door creaks.",
    });
  });
});

describe("stripFence", () => {
  it("strips one surrounding fence and leaves bare text alone", () => {
    expect(stripFence('```\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripFence('  {"a":1}  ')).toBe('{"a":1}');
  });
});

describe("excerptOf", () => {
  it("keeps text up to 8000 characters whole", () => {
    const t = "a".repeat(8000);
    expect(excerptOf(t)).toBe(t);
  });

  it("keeps the head 6000 and tail 2000 around an elided count at 8001", () => {
    const t = `${"h".repeat(6000)}${"m".repeat(1)}${"t".repeat(2000)}`;
    expect(t).toHaveLength(8001);
    const out = excerptOf(t);
    expect(out).toBe(
      `${"h".repeat(6000)}\n…[1 characters elided]…\n${"t".repeat(2000)}`,
    );
  });
});

describe("truncated outcome (TASK-0192)", () => {
  const trunc = (over: Partial<UsageRecord> = {}) =>
    usageRecord({ truncated: true, ...over });

  it("records ok when a truncated reply still parses", async () => {
    const calls: RecordedCall[] = [];
    const { gateway } = usageGatewayOf([
      { events: text('{"n": 1}'), record: trunc() },
    ]);
    const res = await callJson(
      {
        gateway,
        recordCall: async (c) => {
          calls.push(c);
        },
      },
      req(),
    );
    expect(res.ok).toBe(true);
    expect(calls.map((c) => c.outcome)).toEqual(["ok"]);
  });

  it("records truncated for an unparsable truncated attempt, then re-asks", async () => {
    const calls: RecordedCall[] = [];
    const { gateway } = usageGatewayOf([
      { events: text("nope"), record: trunc() },
      { events: text("nope"), record: usageRecord() },
    ]);
    await callJson(
      {
        gateway,
        recordCall: async (c) => {
          calls.push(c);
        },
      },
      req(),
    );
    expect(calls.map((c) => c.outcome)).toEqual(["truncated", "invalid-json"]);
  });

  it("records truncated for a truncated callText", async () => {
    const calls: RecordedCall[] = [];
    const { gateway } = usageGatewayOf([
      { events: text("The door"), record: trunc() },
    ]);
    const { schema: _s, ...rest } = req();
    const res = await callText(
      {
        gateway,
        recordCall: async (c) => {
          calls.push(c);
        },
      },
      rest,
    );
    expect(res).toMatchObject({ ok: true, text: "The door" });
    expect(calls.map((c) => c.outcome)).toEqual(["truncated"]);
  });

  it("keeps error as error", async () => {
    const calls: RecordedCall[] = [];
    const { gateway } = usageGatewayOf([
      {
        events: [
          {
            type: "error",
            kind: "upstream",
            message: "boom",
            usage: { inputTokens: 0, outputTokens: 0 },
          },
        ],
        record: trunc({ outcome: "error" }),
      },
    ]);
    await callJson(
      {
        gateway,
        recordCall: async (c) => {
          calls.push(c);
        },
      },
      req(),
    );
    expect(calls.map((c) => c.outcome)).toEqual(["error"]);
  });
});

describe("loose parse (TASK-0203)", () => {
  const ok = async (reply: string) =>
    callJson({ gateway: gatewayOf([text(reply)]).gateway }, req());

  it("accepts prose before and after one object", async () => {
    const r = await ok('Here is the JSON:\n{"n": 3}\nHope that helps!');
    expect(r).toMatchObject({ ok: true, value: { n: 3 } });
    expect(r.calls).toHaveLength(1);
  });
  it("accepts a fence wrapped in prose", async () => {
    const r = await ok('Sure!\n```json\n{"n": 4}\n```\nDone.');
    expect(r).toMatchObject({ ok: true, value: { n: 4 } });
    expect(r.calls).toHaveLength(1);
  });
  it("accepts an unclosed think block before the object", async () => {
    const r = await ok('<think>planning the reply\n{"n": 5}');
    expect(r).toMatchObject({ ok: true, value: { n: 5 } });
  });
  it("handles braces and escaped quotes inside strings", async () => {
    const s = z.object({ n: z.string() });
    const r = await callJson(
      { gateway: gatewayOf([text('ok {"n": "a } \\" {"} bye')]).gateway },
      { ...req(), schema: s },
    );
    expect(r).toMatchObject({ ok: true, value: { n: 'a } " {' } });
  });
  it("rejects two top-level objects, unbalanced and object-free replies", async () => {
    expect(extractObject('{"n":1} and {"n":2}')).toBeNull();
    expect(extractObject('{"n": 1')).toBeNull();
    expect(extractObject("no json here")).toBeNull();
    const r = await callJson(
      { gateway: gatewayOf([text('{"n":1} {"n":2}'), text("nope")]).gateway },
      req(),
    );
    expect(r.ok).toBe(false);
  });
  it("logs a bounded head/tail of an unparsable reply", async () => {
    const lines: Record<string, unknown>[] = [];
    const long = `${"a".repeat(500)}${"b".repeat(500)}`;
    await callJson(
      {
        gateway: gatewayOf([text(long), text('{"n":1}')]).gateway,
        log: (l) => lines.push(l),
      },
      req(),
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      event: "dm.call.invalid-json",
      attempt: 1,
      chars: 1000,
      head: "a".repeat(200),
      tail: "b".repeat(200),
    });
  });

  it("logs dm.call.schema-mismatch for a reply that parses but fails the schema", async () => {
    const lines: Record<string, unknown>[] = [];
    await callJson(
      {
        gateway: gatewayOf([text('{"n":"x"}'), text('{"n":1}')]).gateway,
        log: (l) => lines.push(l),
      },
      req(),
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      event: "dm.call.schema-mismatch",
      attempt: 1,
    });
  });

  it("records truncated for a truncated schema failure", async () => {
    const calls: RecordedCall[] = [];
    const { gateway } = usageGatewayOf([
      { events: text('{"n":"x"}'), record: usageRecord({ truncated: true }) },
      { events: text('{"n":1}'), record: usageRecord() },
    ]);
    await callJson(
      {
        gateway,
        recordCall: async (c) => {
          calls.push(c);
        },
      },
      req(),
    );
    expect(calls.map((c) => c.outcome)).toEqual(["truncated", "ok"]);
  });
});

describe("output spec and truncated log (TASK-0273)", () => {
  it("sends the same output spec on both attempts, named after the purpose", async () => {
    const { gateway, requests } = gatewayOf([text("nope"), text('{"n":1}')]);
    await callJson({ gateway }, { ...req(), purpose: "dm.audit" });
    expect(requests).toHaveLength(2);
    expect(requests[0]?.output?.name).toBe("dm_audit");
    expect(requests[0]?.output?.schema).toMatchObject({ type: "object" });
    expect(requests[0]?.output?.schema).not.toHaveProperty("$schema");
    expect(requests[1]?.output).toBe(requests[0]?.output);
  });

  it("sends no output on callText", async () => {
    const { gateway, requests } = gatewayOf([text("prose")]);
    const { schema: _s, ...rest } = req();
    await callText({ gateway }, rest);
    expect(requests[0]).not.toHaveProperty("output");
  });

  const trunc = usageRecord({ truncated: true });
  const logs = async (scripts: Parameters<typeof usageGatewayOf>[0]) => {
    const lines: Record<string, unknown>[] = [];
    await callJson(
      { ...usageGatewayOf(scripts), log: (l) => lines.push(l) },
      req(),
    );
    return lines;
  };

  it("logs dm.call.truncated with parse invalid-json for a capped unparsable reply", async () => {
    const lines = await logs([
      { events: text('{"n":'), record: trunc },
      { events: text('{"n":1}'), record: usageRecord() },
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      event: "dm.call.truncated",
      parse: "invalid-json",
      attempt: 1,
    });
  });

  it("logs dm.call.truncated with parse schema-mismatch for a capped schema failure", async () => {
    const lines = await logs([
      { events: text('{"n":"x"}'), record: trunc },
      { events: text('{"n":1}'), record: usageRecord() },
    ]);
    expect(lines[0]).toMatchObject({
      event: "dm.call.truncated",
      parse: "schema-mismatch",
    });
  });

  it("logs a capped second attempt too", async () => {
    const lines = await logs([
      { events: text("nope"), record: usageRecord() },
      { events: text("nope"), record: trunc },
    ]);
    expect(lines.map((l) => l.event)).toEqual([
      "dm.call.invalid-json",
      "dm.call.truncated",
    ]);
  });

  it("logs a capped callText attempt with parse null", async () => {
    const lines: Record<string, unknown>[] = [];
    const { schema: _s, ...rest } = req();
    await callText(
      {
        ...usageGatewayOf([{ events: text("The door"), record: trunc }]),
        log: (l) => lines.push(l),
      },
      rest,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      event: "dm.call.truncated",
      parse: null,
      issues: "",
      head: "The door",
    });
  });

  it("logs no invalid-json line for a capped reply", async () => {
    const lines = await logs([
      { events: text("{"), record: trunc },
      { events: text('{"n":1}'), record: usageRecord() },
    ]);
    expect(lines.some((l) => l.event === "dm.call.invalid-json")).toBe(false);
  });
});
