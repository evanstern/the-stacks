import { describe, expect, it } from "vitest";
import type { ChatEvent, ChatRequest } from "../../src/ai/types.js";
import { normalizeChronicle } from "../../src/dm/chronicle.js";
import { AuditModelOutput, normalizeAudit } from "../../src/dm/nodes/audit.js";
import { callJson } from "../../src/dm/pipeline/call.js";
import {
  audit,
  auditIssue,
  chronicle,
  SHAPES,
  type Shape,
  wrap,
} from "./fixtures/task-0203-shapes.js";

// Fixtures live in ./fixtures/task-0203-shapes.ts (rebuilt from the TASK-0203 note).
const usage = { inputTokens: 1, outputTokens: 1 };
const text = (t: string): ChatEvent[] => [
  { type: "text", text: t },
  { type: "done", usage },
];

function run(shape: Shape, scripts: ChatEvent[][]) {
  const gateway = {
    chat: async function* (_req: ChatRequest) {
      for (const e of scripts.shift() ?? []) yield e;
    },
  };
  return callJson(
    { gateway },
    {
      purpose: shape.purpose,
      promptVersion: "t",
      system: "s",
      user: "u",
      schema: shape.schema,
      normalize: shape.normalize,
      signal: new AbortController().signal,
    },
  );
}

describe("TASK-0203 shapes through callJson", () => {
  for (const shape of SHAPES) {
    if (shape.expect === "ok") {
      it(`${shape.id}: passes on attempt 1`, async () => {
        const r = await run(shape, [text(wrap(shape, shape.reply))]);
        expect(r.calls.map((c) => c.outcome)).toEqual(["ok"]);
        if (!r.ok) throw new Error("expected ok");
        shape.check?.(r.value);
      });
    } else {
      it(`${shape.id}: re-asks once, then passes`, async () => {
        const r = await run(shape, [
          text(wrap(shape, shape.reply)),
          text(wrap(shape, shape.good)),
        ]);
        expect(r.ok).toBe(true);
        expect(r.calls.map((c) => c.outcome)).toEqual([
          "schema-mismatch",
          "ok",
        ]);
      });
    }
  }
  it("a non-string audit kind is not coerced and re-asks", async () => {
    const shape = SHAPES[0] as Shape;
    const bad = audit(auditIssue({ kind: 7 }));
    const good = audit(auditIssue());
    const r = await run({ ...shape, schema: AuditModelOutput }, [
      text(wrap(shape, bad)),
      text(wrap(shape, good)),
    ]);
    expect(r.calls.map((c) => c.outcome)).toEqual(["schema-mismatch", "ok"]);
  });
});

describe("normalizer edge cases", () => {
  it("clips hard at 300 with no space", () => {
    const out = normalizeAudit(
      audit(auditIssue({ detail: "x".repeat(400) })),
    ) as { issues: { detail: string }[] };
    expect(out.issues[0]?.detail).toHaveLength(300);
  });
  it("adds the prefix before the clip", () => {
    const out = normalizeAudit(
      audit(auditIssue({ kind: "zz", detail: "word ".repeat(90) })),
    ) as { issues: { detail: string }[] };
    expect(out.issues[0]?.detail.startsWith("[zz] word")).toBe(true);
    expect(out.issues[0]?.detail.length).toBeLessThanOrEqual(300);
  });
  it("leaves empty detail, long actor and non-objects alone", () => {
    const i = auditIssue({ detail: "", actor: "a".repeat(81) });
    expect(normalizeAudit(audit(i))).toEqual(audit(i));
    for (const v of [null, 3, "x", [1], { issues: "x" }]) {
      expect(normalizeAudit(v)).toEqual(v);
      expect(normalizeChronicle(v)).toEqual(v);
    }
  });
  it("does not mutate its input", () => {
    const input = audit(auditIssue({ kind: "zz", actor: null }));
    const copy = structuredClone(input);
    normalizeAudit(input);
    expect(input).toEqual(copy);
  });
  it("leaves non-integer, negative and object chronicle ids", () => {
    const ids = [1.5, -1, { a: 1 }, "ok"];
    expect(normalizeChronicle(chronicle(ids))).toEqual(chronicle(ids));
  });
});
