import { expect } from "vitest";
import type { ZodType } from "zod";
import {
  ChronicleOutput,
  normalizeChronicle,
} from "../../../src/dm/chronicle.js";
import { CompanionOutput } from "../../../src/dm/companion.js";
import {
  AuditModelOutput,
  normalizeAudit,
} from "../../../src/dm/nodes/audit.js";
import {
  DirectorOutput,
  InterpretOutput,
} from "../../../src/dm/nodes/schemas.js";
import type { DmPurpose } from "../../../src/dm/purposes.js";

/**
 * The TASK-0203 reply shapes, rebuilt from the root-cause note (specs/086
 * "Evidence limits"). One module feeds both the call-level coercion tests and
 * the tool-mode stream tests (TASK-0273). `ok` shapes pass on attempt 1;
 * `schema-mismatch` shapes fail attempt 1 and pass on `good` after a re-ask.
 */
export interface Shape {
  id: string;
  purpose: DmPurpose;
  schema: ZodType;
  normalize?: (json: unknown) => unknown;
  wrapper: "fence" | "think" | "bare";
  reply: unknown;
  expect: "ok" | "schema-mismatch";
  /** The corrected reply for a re-ask (schema-mismatch shapes). */
  good?: unknown;
  /** `ok` shapes: asserts the coerced value. */
  check?: (value: unknown) => void;
}

export const wrap = (shape: Pick<Shape, "wrapper">, o: unknown): string => {
  const json = JSON.stringify(o);
  if (shape.wrapper === "fence") return `\`\`\`json\n${json}\n\`\`\``;
  if (shape.wrapper === "think") return `<think></think>${json}`;
  return json;
};

export const auditIssue = (over: Record<string, unknown> = {}) => ({
  kind: "doctrine",
  detail: "ok",
  ...over,
});
export const audit = (issue: Record<string, unknown>) => ({
  verdict: "fail",
  issues: [issue],
});
export const chronicle = (ids: unknown[]) => ({
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
export const reading = (steps: unknown[]) => ({
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
const { comment: _c, ...companionNoComment } = companion;
const { goalNote: _g, ...directorRest } = director;
const { attack: _a, ...attackNoAttack } = attack;
const stakes = { success: "s", cost: "c", failure: "f" };
const longDetail = "word ".repeat(90).trim();

export const SHAPES: Shape[] = [
  {
    id: "S1",
    purpose: "dm.audit",
    schema: AuditModelOutput,
    normalize: normalizeAudit,
    wrapper: "fence",
    reply: audit(auditIssue({ kind: "turn-mode", detail: "Rook acts." })),
    expect: "ok",
    check: (v) =>
      expect((v as { issues: unknown[] }).issues[0]).toMatchObject({
        kind: "other",
        detail: "[turn-mode] Rook acts.",
      }),
  },
  {
    id: "S2",
    purpose: "dm.audit",
    schema: AuditModelOutput,
    normalize: normalizeAudit,
    wrapper: "think",
    reply: audit(auditIssue({ detail: longDetail })),
    expect: "ok",
    check: (v) => {
      const d = (v as { issues: { detail: string }[] }).issues[0]?.detail ?? "";
      expect(d.length).toBeLessThanOrEqual(300);
      expect(d.endsWith("word")).toBe(true);
    },
  },
  {
    id: "S3",
    purpose: "dm.audit",
    schema: AuditModelOutput,
    normalize: normalizeAudit,
    wrapper: "fence",
    reply: audit(auditIssue({ actor: null })),
    expect: "ok",
    check: (v) =>
      expect("actor" in ((v as { issues: object[] }).issues[0] ?? {})).toBe(
        false,
      ),
  },
  {
    id: "S4",
    purpose: "dm.chronicle",
    schema: ChronicleOutput,
    normalize: normalizeChronicle,
    wrapper: "think",
    reply: chronicle([12, 14]),
    expect: "ok",
    check: (v) =>
      expect(
        (v as { entries: { sourceActionIds: unknown }[] }).entries[0]
          ?.sourceActionIds,
      ).toEqual(["12", "14"]),
  },
  {
    id: "S5",
    purpose: "dm.companion",
    schema: CompanionOutput,
    wrapper: "fence",
    reply: companionNoComment,
    good: companion,
    expect: "schema-mismatch",
  },
  {
    id: "S6",
    purpose: "dm.director",
    schema: DirectorOutput,
    wrapper: "fence",
    reply: { ...directorRest, pacing: { ...director.pacing, goalNote: "g" } },
    good: director,
    expect: "schema-mismatch",
  },
  {
    id: "S7",
    purpose: "dm.interpret",
    schema: InterpretOutput,
    wrapper: "fence",
    reply: reading([attackNoAttack]),
    good: reading([attack]),
    expect: "schema-mismatch",
  },
  {
    id: "S8",
    purpose: "dm.interpret",
    schema: InterpretOutput,
    wrapper: "fence",
    reply: reading([check({ ...stakes, severe: null })]),
    good: reading([check({ ...stakes, severe: "x" })]),
    expect: "schema-mismatch",
  },
];
