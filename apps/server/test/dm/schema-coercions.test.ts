import { describe, expect, it } from "vitest";
import type { ChatEvent, ChatRequest } from "../../src/ai/types.js";
import { ChronicleOutput, normalizeChronicle } from "../../src/dm/chronicle.js";
import { CompanionOutput } from "../../src/dm/companion.js";
import { AuditModelOutput, normalizeAudit } from "../../src/dm/nodes/audit.js";
import { DirectorOutput, InterpretOutput } from "../../src/dm/nodes/schemas.js";
import { callJson } from "../../src/dm/pipeline/call.js";

// Fixtures are rebuilt from the TASK-0203 root-cause note (specs/086 evidence limits).
const usage = { inputTokens: 1, outputTokens: 1 };
const text = (t: string): ChatEvent[] => [
  { type: "text", text: t },
  { type: "done", usage },
];
const fenced = (o: unknown) => text(`\`\`\`json\n${JSON.stringify(o)}\n\`\`\``);
const thinking = (o: unknown) => text(`<think></think>${JSON.stringify(o)}`);

function run<T>(
  schema: import("zod").ZodType<T>,
  scripts: ChatEvent[][],
  normalize?: (j: unknown) => unknown,
) {
  const gateway = {
    chat: async function* (_req: ChatRequest) {
      for (const e of scripts.shift() ?? []) yield e;
    },
  };
  return callJson(
    { gateway },
    {
      purpose: "dm.audit",
      promptVersion: "t",
      system: "s",
      user: "u",
      schema,
      normalize,
      signal: new AbortController().signal,
    },
  );
}

const auditIssue = (over: Record<string, unknown> = {}) => ({
  kind: "doctrine",
  detail: "ok",
  ...over,
});
const audit = (issue: Record<string, unknown>) => ({
  verdict: "fail",
  issues: [issue],
});
const chronicle = (ids: unknown[]) => ({
  entries: [
    { title: "t", body: "b", sourceActionIds: ids, visibility: "public" },
  ],
});
const director = {
  beat: { decision: "resolve" },
  tableMode: { to: "stay" },
  trackers: [],
  scene: { status: "continue" },
  pacing: { tension: "low", spotlight: null, beatId: null },
  goalNote: "g",
  companionPrompts: [],
};
const companion = { say: null, comment: null, act: null, pending: [] };
const check = (stakes: object) => ({
  step: "check",
  reason: "r",
  combatantId: null,
  kind: "ability-check",
  ability: "dex",
  skill: null,
  difficulty: "medium",
  circumstance: null,
  autoFail: null,
  onSuccess: [],
  onFailure: [],
  stakes,
});
const reading = (steps: unknown[]) => ({
  readings: [
    {
      actionId: "a1",
      intent: "attack",
      uncertain: false,
      needsAdjudication: false,
      rulesQuestion: null,
      clarify: null,
      steps,
    },
  ],
});
const attack = {
  step: "attack",
  reason: "r",
  attackerId: "goblin",
  targetId: "rook",
  attack: "Scimitar",
  circumstance: null,
  onHit: [],
};

describe("safe coercions pass on attempt 1 (S1 to S4)", () => {
  it("S1: unknown audit kind becomes other with a prefix", async () => {
    const r = await run(
      AuditModelOutput,
      [fenced(audit(auditIssue({ kind: "turn-mode", detail: "Rook acts." })))],
      normalizeAudit,
    );
    expect(r.calls.map((c) => c.outcome)).toEqual(["ok"]);
    if (!r.ok) throw new Error("expected ok");
    expect(r.value.issues[0]).toMatchObject({
      kind: "other",
      detail: "[turn-mode] Rook acts.",
    });
  });
  it("S2: a 450-character detail is clipped at a space within 300", async () => {
    const detail = "word ".repeat(90).trim();
    const r = await run(
      AuditModelOutput,
      [thinking(audit(auditIssue({ detail })))],
      normalizeAudit,
    );
    expect(r.calls).toHaveLength(1);
    if (!r.ok) throw new Error("expected ok");
    const d = r.value.issues[0]?.detail ?? "";
    expect(d.length).toBeLessThanOrEqual(300);
    expect(d.endsWith("word")).toBe(true);
  });
  it("S3: a null actor is dropped", async () => {
    const r = await run(
      AuditModelOutput,
      [fenced(audit(auditIssue({ actor: null })))],
      normalizeAudit,
    );
    expect(r.calls).toHaveLength(1);
    if (!r.ok) throw new Error("expected ok");
    expect("actor" in (r.value.issues[0] ?? {})).toBe(false);
  });
  it("S4: numeric chronicle ids become strings", async () => {
    const r = await run(
      ChronicleOutput,
      [thinking(chronicle([12, 14]))],
      normalizeChronicle,
    );
    expect(r.calls).toHaveLength(1);
    if (!r.ok) throw new Error("expected ok");
    expect(r.value.entries[0]?.sourceActionIds).toEqual(["12", "14"]);
  });
});

describe("other mismatches still re-ask (S5 to S8)", () => {
  const reask = async (
    schema: import("zod").ZodType<unknown>,
    bad: unknown,
    good: unknown,
  ) => {
    const r = await run(schema, [fenced(bad), fenced(good)]);
    expect(r.ok).toBe(true);
    expect(r.calls.map((c) => c.outcome)).toEqual(["schema-mismatch", "ok"]);
  };
  it("S5: companion without comment", async () => {
    const { comment: _c, ...bad } = companion;
    await reask(CompanionOutput, bad, companion);
  });
  it("S6: director with goalNote inside pacing", async () => {
    const { goalNote: _g, ...rest } = director;
    await reask(
      DirectorOutput,
      { ...rest, pacing: { ...director.pacing, goalNote: "g" } },
      director,
    );
  });
  it("S7: NPC attack step without attack", async () => {
    const { attack: _a, ...bad } = attack;
    await reask(InterpretOutput, reading([bad]), reading([attack]));
  });
  it("S8: ability check with stakes.severe null", async () => {
    const stakes = { success: "s", cost: "c", failure: "f" };
    await reask(
      InterpretOutput,
      reading([check({ ...stakes, severe: null })]),
      reading([check({ ...stakes, severe: "x" })]),
    );
  });
  it("a non-string audit kind is not coerced and re-asks", async () => {
    const r = await run(
      AuditModelOutput,
      [fenced(audit(auditIssue({ kind: 7 }))), fenced(audit(auditIssue()))],
      normalizeAudit,
    );
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
