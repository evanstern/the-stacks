import { describe, expect, it } from "vitest";
import type { ChatEvent, ChatRequest } from "../../src/ai/types.js";
import { assemble } from "../../src/dm/nodes/assemble.js";
import { check } from "../../src/dm/nodes/check.js";
import type { DirectorNodeOutput } from "../../src/dm/nodes/director.js";
import { narrate } from "../../src/dm/nodes/narrate.js";
import type { ResolveOutput } from "../../src/dm/nodes/resolve.js";
import type { NarrationPart } from "../../src/dm/pipeline/context.js";
import { buildSnapshot } from "../../src/dm/snapshot/index.js";
import { freeEventsThrough, makeCtx, projectDm } from "./helpers.js";
import { EMPTY_RESOLVE_SNAPSHOT } from "./snapshot-fixtures.js";

/** Spec 108 Phase 2: narrate sends rows first, parts stream in order, timing lands in the check record. */

const director: DirectorNodeOutput = {
  beat: { decision: "resolve" },
  tableMode: { to: "stay" },
  trackers: [],
  scene: { status: "continue" },
  pacing: { tension: "rising", spotlight: null, beatId: null },
  goalNote: "",
  companionPrompts: [],
  overrides: [],
};
const resolved: ResolveOutput = {
  submissions: [],
  actionResults: [],
  appendedRows: [],
  nextJob: null,
  chronicle: false,
  npcTurn: null,
  ...EMPTY_RESOLVE_SNAPSHOT,
  lastSeq: 0,
};

const TEXT =
  "[restate] Tamsin means to force the shutter.\n[describe] The shutter shrieks on its hinge. It swings wide. Grey light spills in. A boot scrapes below.\n[ask] What does Odo do?";

/** A gateway whose `chat` logs into `trace` and yields `deltas` (or an error). */
function run(opts: { deltas: string[] | "error"; stream?: boolean }) {
  const trace: string[] = [];
  const parts: NarrationPart[] = [];
  const gateway = {
    chat: async function* (_req: ChatRequest): AsyncGenerator<ChatEvent> {
      trace.push("chat");
      if (opts.deltas === "error") {
        yield {
          type: "error",
          kind: "provider",
          message: "boom",
          usage: { inputTokens: 0, outputTokens: 0 },
        } as unknown as ChatEvent;
        return;
      }
      for (const d of opts.deltas) {
        trace.push("delta");
        yield { type: "text", text: d };
      }
      yield {
        type: "done",
        usage: { inputTokens: 1, outputTokens: 1 },
      } as ChatEvent;
    },
  };
  return (async () => {
    const events = freeEventsThrough("action.resolved");
    const ctx0 = makeCtx({
      deps: {
        gateway,
        loadProjections: async () => projectDm(events),
        ...(opts.stream === false
          ? {}
          : {
              streamNarration: (p: NarrationPart) => {
                trace.push(`part:${p.slot}`);
                parts.push(p);
              },
            }),
      },
    });
    const assembled = await assemble(ctx0);
    if (!assembled.ok) throw new Error("assemble failed");
    const snapshot = buildSnapshot(assembled.output.projections, ctx0.seed);
    const ctx = {
      ...ctx0,
      results: {
        assemble: assembled.output,
        director,
        resolve: { ...resolved, snapshot },
      },
    };
    const n = await narrate(ctx);
    if (!n.ok) throw new Error("narrate failed");
    const c = await check({
      ...ctx,
      results: { ...ctx.results, narrate: n.output },
    });
    if (!c.ok) throw new Error("check failed");
    return { trace, parts, narrated: n.output, checked: c.output };
  })();
}

const chunks = (s: string, n: number) =>
  s.match(new RegExp(`[\\s\\S]{1,${n}}`, "g")) as string[];

describe("narrate streaming (spec 108)", () => {
  it("sends the rows part before the gateway chat() call (AC #2)", async () => {
    const { trace, parts, narrated } = await run({ deltas: chunks(TEXT, 9) });
    expect(trace[0]).toBe("part:rows");
    expect(trace.indexOf("part:rows")).toBeLessThan(trace.indexOf("chat"));
    expect(parts[0]?.text).toBe(
      narrated.sheet.rows
        .map((r) => r.text)
        .concat(narrated.sheet.state ?? [])
        .join("\n"),
    );
  });

  it("orders parts rows, restate, describe..., ask; describe leaves before the call ends (SC-001)", async () => {
    const { trace, parts, checked } = await run({ deltas: chunks(TEXT, 9) });
    const slots = parts.map((p) => p.slot);
    expect(slots[0]).toBe("rows");
    expect(slots[1]).toBe("restate");
    // `ask` ships only when parseSlots keeps it; the stream sends it last, from the settled slot.
    const askKept =
      checked.shipped?.text.includes("What does Odo do?") ?? false;
    expect(slots.includes("ask")).toBe(askKept);
    expect(slots.at(-1)).toBe(askKept ? "ask" : "describe");
    expect(slots.filter((s) => s === "describe").length).toBeGreaterThan(1);
    // A describe part is emitted between deltas, before the last delta.
    const firstDescribe = trace.indexOf("part:describe");
    expect(trace.slice(firstDescribe).includes("delta")).toBe(true);
    const joined = parts
      .filter((p) => p.slot === "describe")
      .map((p) => p.text)
      .join("");
    expect(joined).toBe(
      "The shutter shrieks on its hinge. It swings wide. Grey light spills in. A boot scrapes below.",
    );
  });

  it("streams nothing but still ships when no streamNarration is wired", async () => {
    const { parts, checked, narrated } = await run({
      deltas: chunks(TEXT, 9),
      stream: false,
    });
    expect(parts).toEqual([]);
    expect(narrated.stream).toBeUndefined();
    expect(checked.record.firstTokenMs).toBeUndefined();
    expect(checked.shipped?.text).toContain("A boot scrapes below.");
  });

  it("on a call error sends rows only, and the row ships rows (no prose parts)", async () => {
    const { parts, checked, narrated } = await run({ deltas: "error" });
    expect(narrated.narrateError).toBe("gateway");
    expect(parts.map((p) => p.slot)).not.toContain("describe");
    expect(parts[0]?.slot).toBe("rows");
    expect(checked.record.narrateError).toBe("gateway");
  });

  it("records firstTokenMs, firstProseMs and firstProseAt in the check record (AC #5)", async () => {
    const { checked } = await run({ deltas: chunks(TEXT, 9) });
    expect(checked.record.firstTokenMs).toBeGreaterThanOrEqual(0);
    expect(checked.record.firstProseMs).toBeGreaterThanOrEqual(
      checked.record.firstTokenMs as number,
    );
    expect(new Date(checked.record.firstProseAt as string).toISOString()).toBe(
      checked.record.firstProseAt,
    );
  });

  it("logs dm.narrate.first-token with the three values", async () => {
    // Re-run capturing the log through makeCtx deps.
    const lines: Record<string, unknown>[] = [];
    const events = freeEventsThrough("action.resolved");
    const gateway = {
      chat: async function* (): AsyncGenerator<ChatEvent> {
        yield { type: "text", text: TEXT };
        yield {
          type: "done",
          usage: { inputTokens: 1, outputTokens: 1 },
        } as ChatEvent;
      },
    };
    const ctx0 = makeCtx({
      deps: {
        gateway,
        loadProjections: async () => projectDm(events),
        streamNarration: () => {},
        log: (l) => lines.push(l),
      },
    });
    const a = await assemble(ctx0);
    if (!a.ok) throw new Error("assemble failed");
    const snapshot = buildSnapshot(a.output.projections, ctx0.seed);
    const ctx = {
      ...ctx0,
      results: {
        assemble: a.output,
        director,
        resolve: { ...resolved, snapshot },
      },
    };
    const n = await narrate(ctx);
    if (!n.ok) throw new Error("narrate failed");
    await check({ ...ctx, results: { ...ctx.results, narrate: n.output } });
    const line = lines.find((l) => l.event === "dm.narrate.first-token");
    expect(line).toMatchObject({
      jobId: ctx.job.id,
      sessionId: ctx.job.sessionId,
    });
    expect(Object.keys(line ?? {})).toEqual(
      expect.arrayContaining(["firstTokenMs", "firstProseMs", "firstProseAt"]),
    );
  });
});
