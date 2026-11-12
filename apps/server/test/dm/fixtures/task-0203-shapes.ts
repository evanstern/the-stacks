import { expect } from "vitest";
import type { ZodType } from "zod";
import {
  ChronicleOutput,
  normalizeChronicle,
} from "../../../src/dm/chronicle.js";
import { CompanionOutput } from "../../../src/dm/companion.js";
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
/** Spec 104: a `check` stage with beside data; `stakes` is the part a shape breaks. */
const check = (stakes: object) => ({
  intent: { kind: "check", targets: [], params: { skill: "athletics" } },
  beside: {
    stakes,
    onSuccess: [],
    onFailure: [],
    onCost: [],
    onSevere: [],
    newRisk: null,
    reveals: null,
    autoFail: null,
  },
});
export const reading = (stages: unknown[]) => ({
  readings: [{ actionId: "a1", stages, clarify: null, followUps: [] }],
});
/** An `attack` stage; a missing `weapon` is the shape that fails attempt 1. */
const attack = {
  intent: {
    kind: "attack",
    targets: [{ kind: "actor", id: "rook" }],
    params: { weapon: "Scimitar" },
  },
  beside: null,
};
const { comment: _c, ...companionNoComment } = companion;
const { goalNote: _g, ...directorRest } = director;
const attackNoAttack = {
  ...attack,
  intent: { ...attack.intent, params: { mode: "sideways" } },
};
const stakes = { success: "s", cost: "c", failure: "f" };

export const SHAPES: Shape[] = [
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
