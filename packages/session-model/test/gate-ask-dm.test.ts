import { scriptedRng } from "@the-stacks/dnd5e-engine";
import { type Intent, IntentSchema } from "@the-stacks/intent";
import { describe, expect, it } from "vitest";
import {
  type PlannedRow,
  type PlanResult,
  type Proposer,
  planProposal,
  project,
  type SessionProjections,
} from "../src/index.js";
import { aiDm, ana, bram, seatedDm, stream } from "./gate-helpers.js";
import { PLAYER_A, type RowSpec } from "./helpers.js";

const ask = (text = "@dm how high is the loft?"): Intent =>
  IntentSchema.parse({
    id: "q-1",
    kind: "ask_dm",
    actor: { kind: "pc", id: "ana" },
    text,
    source: "composer",
    commit: "confirmed",
  });

function plan(
  p: SessionProjections,
  who: Proposer,
  intent: Intent,
): PlanResult {
  return planProposal(
    p,
    who,
    { kind: "intent", summary: null, rationale: null, intent },
    scriptedRng([]),
    { batchId: "b-plan" },
    null,
  );
}
const rowsOf = (r: PlanResult): PlannedRow[] => {
  if (!r.ok) throw new Error(`refused ${r.refusal.code}`);
  return r.rows;
};
const asSpecs = (rows: PlannedRow[]): RowSpec[] =>
  rows.map((r) => ({
    type: r.type,
    payload: r.payload,
    opts: { actor: r.actor, visibility: r.visibility },
  }));
const fold = (extra: RowSpec[] = [], turn = false) =>
  project(
    stream({
      extra,
      ...(turn
        ? { turn: { activeActor: PLAYER_A, activeCharacterId: "ana" } }
        : {}),
    }),
    { role: "dm" },
  );

describe("ask_dm over the gate (spec 066 FR-028, OQ-6)", () => {
  const p = fold();

  it("plans a talk row (ooc, null character) and the carrier, both the asker's", () => {
    const rows = rowsOf(plan(p, ana, ask()));
    expect(rows.map((r) => r.type)).toEqual(["talk", "intent.recorded"]);
    expect(rows[0]?.payload).toEqual({
      text: "@dm how high is the loft?",
      channel: "ooc",
      characterId: null,
    });
    for (const r of rows) {
      expect(r.visibility).toBe(PLAYER_A);
      expect(r.actor).toBe(PLAYER_A);
    }
    expect(rows[1]?.payload).toMatchObject({
      outcome: "settled",
      batchId: null,
      facts: [],
    });
  });

  it("is served in turn mode too, off turn or not", () => {
    expect(rowsOf(plan(fold([], true), ana, ask())).length).toBe(2);
  });

  it("a companion, the AI DM and a seated DM are refused", () => {
    for (const who of [bram, aiDm, seatedDm]) {
      expect(plan(p, who, ask()).ok, JSON.stringify(who)).toBe(false);
    }
  });

  it("a second ask with the same id is INTENT_EXISTS", () => {
    const rows = rowsOf(plan(p, ana, ask()));
    const r = plan(fold(asSpecs(rows)), ana, ask());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal.code).toBe("INTENT_EXISTS");
  });

  it("SC-004a: the question changes no projection but transcript, intents, throughSeq and diagnostics", () => {
    const rows = rowsOf(plan(p, ana, ask()));
    const after = fold(asSpecs(rows));
    const strip = (x: SessionProjections) => {
      const {
        transcript: _t,
        intents: _i,
        throughSeq: _s,
        diagnostics: _d,
        ...rest
      } = x;
      return rest;
    };
    expect(strip(after)).toEqual(strip(p));
    expect(after.engine).toEqual(p.engine);
    expect(after.actions).toEqual(p.actions);
    expect(after.party).toEqual(p.party);
    expect(after.encounter).toEqual(p.encounter);
    expect(after.tableMode).toEqual(p.tableMode);
  });

  it("only the asker and the DM see the rows", () => {
    const rows = rowsOf(plan(p, ana, ask()));
    const specs = asSpecs(rows);
    const as = (userId: string) =>
      project(stream({ extra: specs }), { role: "player", userId });
    expect(as(PLAYER_A).intents.some((i) => i.id === "q-1")).toBe(true);
    expect(
      as("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb").intents.some(
        (i) => i.id === "q-1",
      ),
    ).toBe(false);
    expect(fold(specs).intents.some((i) => i.id === "q-1")).toBe(true);
  });
});
