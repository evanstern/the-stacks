import { scriptedRng } from "@the-stacks/dnd5e-engine";
import { IntentSchema, parse, toText } from "@the-stacks/intent";
import { describe, expect, it } from "vitest";
import { proposalExamples } from "../src/fixtures/index.js";
import {
  declareIntent,
  type Proposal,
  ProposalSchema,
  planProposal,
} from "../src/index.js";
import { ana, bram, dmFold, floorFold } from "./gate-helpers.js";

const action = (over: Record<string, unknown> = {}) => ({
  actionId: "act-new",
  characterId: "ana",
  scope: "character" as const,
  text: "Ana waits.",
  ...over,
});

describe("declareIntent (FR-026)", () => {
  const p = dmFold();

  it("maps a declare to a schema-valid declared attempt", () => {
    const r = declareIntent(action(), ana, p);
    if (!r.ok) throw new Error(r.message);
    expect(IntentSchema.safeParse(r.intent).success).toBe(true);
    expect(r.intent).toMatchObject({
      id: "act-new",
      kind: "attempt",
      actor: { kind: "pc", id: "ana" },
      params: { scope: "character" },
      text: "Ana waits.",
      source: "composer",
      commit: "declared",
    });
  });

  it("round-trips through toText and parse", () => {
    const r = declareIntent(action(), ana, p);
    if (!r.ok) throw new Error(r.message);
    const back = parse(toText(r.intent), {
      actor: r.intent.actor,
      id: r.intent.id,
      source: r.intent.source,
      commit: r.intent.commit,
    } as never);
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.intent).toEqual(r.intent);
  });

  it("a party scope with a null character uses the first member the proposer controls", () => {
    const r = declareIntent(
      action({ scope: "party", characterId: null }),
      ana,
      p,
    );
    if (!r.ok) throw new Error(r.message);
    expect(r.intent.actor).toEqual({ kind: "pc", id: "ana" });
    expect(r.intent.params).toEqual({ scope: "party" });
  });

  it("an AI companion maps to a companion actor with source ai", () => {
    const r = declareIntent(action({ characterId: "bram" }), bram, p);
    if (!r.ok) throw new Error(r.message);
    expect(r.intent).toMatchObject({
      actor: { kind: "companion", id: "bram" },
      source: "ai",
    });
  });

  it("a party scope with no controlled member fails", () => {
    const q = floorFold();
    const r = declareIntent(
      action({ scope: "party", characterId: null }),
      { kind: "human", userId: "nobody", role: "player" },
      q,
    );
    expect(r.ok).toBe(false);
  });

  it("the fixture example maps to a valid Intent", () => {
    const ex = proposalExamples["action.declare"];
    if (ex.kind !== "action.declare") throw new Error("kind");
    const r = declareIntent(ex.action, ana, p);
    expect(r.ok).toBe(true);
  });
});

describe("the action.declare path (FR-027)", () => {
  const p = dmFold();
  const plan = (a: Record<string, unknown>) =>
    planProposal(
      p,
      ana,
      ProposalSchema.parse({ kind: "action.declare", action: a }) as Proposal,
      scriptedRng([]),
      { batchId: "b" },
      null,
    );

  it("plans today's single action.declared row", () => {
    const r = plan(action());
    expect(r.ok && r.rows.map((x) => x.type)).toEqual(["action.declared"]);
  });

  it("refuses INVALID_PROPOSAL when the text trims to empty", () => {
    const r = plan(action({ text: "   " }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal.code).toBe("INVALID_PROPOSAL");
  });
});
