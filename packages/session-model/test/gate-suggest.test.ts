import { scriptedRng } from "@the-stacks/dnd5e-engine";
import { describe, expect, it } from "vitest";
import {
  type GateRequest,
  GateRequestSchema,
  type PlannedRow,
  type PlanResult,
  type Proposer,
  planProposal,
  project,
  type SessionProjections,
} from "../src/index.js";
import {
  aiDm,
  ana,
  CADE_USER,
  outsider,
  seatedDm,
  stream,
} from "./gate-helpers.js";
import type { RowSpec } from "./helpers.js";

const stranger: Proposer = {
  kind: "human",
  userId: "99999999-9999-4999-8999-999999999999",
  role: "player",
};
const cade: Proposer = { kind: "human", userId: CADE_USER, role: "player" };

const item = (
  itemId: string,
  sug: string,
  over: Record<string, unknown> = {},
) => ({
  itemId,
  text: "The DM's wording.",
  intent: {
    id: `${sug}.${itemId}`,
    kind: "drop_prone",
    actor: { kind: "pc", id: "ana" },
    targets: [],
    params: {},
    source: "ai",
    commit: "declared",
    ...over,
  },
});
const suggestSpec = (
  sug: string,
  items: unknown[],
  readSeq = 0,
  actor = "ai:dm",
): RowSpec => ({
  type: "action.suggested",
  payload: { suggestionId: sug, readSeq, items },
  opts: { actor },
});
const fold = (extra: RowSpec[] = []): SessionProjections =>
  project(stream({ twoHumans: true, extra }), { role: "dm" });

const req = (r: unknown): GateRequest => GateRequestSchema.parse(r);
const suggest = (sug: string, items: unknown[], readSeq = 0): GateRequest =>
  req({
    kind: "action.suggest",
    suggestion: { suggestionId: sug, readSeq, items },
  });
const accept = (sug: string, itemId = "i1"): GateRequest =>
  req({ kind: "action.accept", suggestionId: sug, itemId });

function plan(
  p: SessionProjections,
  who: Proposer,
  r: GateRequest,
  faces: number[] = [12, 12, 12],
): PlanResult {
  return planProposal(
    p,
    who,
    r as never,
    scriptedRng(faces),
    { batchId: "b-plan" },
    null,
  );
}
const rowsOf = (r: PlanResult): PlannedRow[] => {
  if (!r.ok) throw new Error(`refused ${r.refusal.code}: ${r.refusal.message}`);
  return r.rows;
};
const codeOf = (r: PlanResult): string => {
  if (r.ok) throw new Error("expected a refusal");
  return r.refusal.code;
};
const carrierOf = (rows: PlannedRow[]) =>
  rows[rows.length - 1]?.payload as {
    outcome: string;
    intent: { actor: { id: string }; commit: string; source: string };
  };
const asSpecs = (rows: PlannedRow[]): RowSpec[] =>
  rows.map((r) => ({
    type: r.type,
    payload: r.payload,
    opts: { actor: r.actor, visibility: r.visibility },
  }));

describe("action.suggest", () => {
  const p = fold();

  it("plans one public action.suggested row", () => {
    const rows = rowsOf(plan(p, aiDm, suggest("sug-1", [item("i1", "sug-1")])));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "action.suggested",
      actor: "ai:dm",
      visibility: "public",
    });
  });

  it("reusing a suggestion id is INVALID_PROPOSAL", () => {
    const q = fold([suggestSpec("sug-1", [item("i1", "sug-1")])]);
    expect(codeOf(plan(q, aiDm, suggest("sug-1", [item("i1", "sug-1")])))).toBe(
      "INVALID_PROPOSAL",
    );
  });

  it("an item actor must be a pc a human controls", () => {
    for (const actor of [
      { kind: "pc", id: "bram" }, // a companion's character
      { kind: "pc", id: "nobody" },
      { kind: "companion", id: "bram" },
      { kind: "npc", id: "goblin" },
    ]) {
      expect(
        codeOf(
          plan(p, aiDm, suggest("sug-1", [item("i1", "sug-1", { actor })])),
        ),
      ).toBe("INVALID_PROPOSAL");
    }
  });

  it("an item Intent id is <suggestionId>.<itemId>", () => {
    expect(
      codeOf(
        plan(p, aiDm, suggest("sug-1", [item("i1", "sug-1", { id: "x-1" })])),
      ),
    ).toBe("INVALID_PROPOSAL");
  });

  it("ai:dm with an older readSeq than the latest readable post is SUGGESTION_STALE", () => {
    const talk: RowSpec[] = [
      {
        type: "intent.recorded",
        payload: {
          intent: {
            id: "say-1",
            kind: "say",
            actor: { kind: "pc", id: "ana" },
            channel: { kind: "scene" },
            targets: [],
            params: {},
            text: "wait",
            source: "composer",
            commit: "confirmed",
          },
          schemaVersion: 1,
          outcome: "settled",
          batchId: null,
          facts: [],
          request: null,
          answers: null,
          stopped: null,
        },
        opts: { actor: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
      },
    ];
    const q = fold(talk);
    const latest = q.throughSeq;
    expect(
      codeOf(plan(q, aiDm, suggest("sug-1", [item("i1", "sug-1")], 1))),
    ).toBe("SUGGESTION_STALE");
    expect(
      plan(q, aiDm, suggest("sug-1", [item("i1", "sug-1")], latest)).ok,
    ).toBe(true);
  });

  it("a seated human DM is not held to the readSeq guard", () => {
    const q = project(stream({ humanDm: true, twoHumans: true }), {
      role: "dm",
    });
    expect(
      plan(q, seatedDm, suggest("sug-1", [item("i1", "sug-1")], 0)).ok,
    ).toBe(true);
  });
});

describe("action.accept", () => {
  const sugged = (...items: unknown[]) => fold([suggestSpec("sug-1", items)]);

  it("settled: a confirmed drop_prone plans the carrier as confirmed, source composer", () => {
    const rows = rowsOf(
      plan(sugged(item("i1", "sug-1")), ana, accept("sug-1")),
    );
    expect(carrierOf(rows)).toMatchObject({
      outcome: "settled",
      intent: { commit: "confirmed", source: "composer" },
    });
    expect(rows[rows.length - 1]?.type).toBe("intent.recorded");
  });

  it("needs_ruling: a confirmed attempt asks the DM", () => {
    const q = sugged(
      item("i1", "sug-1", {
        kind: "attempt",
        params: { scope: "character" },
        text: "climb to the loft",
      }),
    );
    const rows = rowsOf(plan(q, ana, accept("sug-1")));
    expect(carrierOf(rows).outcome).toBe("needs_ruling");
  });

  it("refusal: the item Intent's planner refusal surfaces and plans no rows", () => {
    const q = sugged(
      item("i1", "sug-1", {
        kind: "attack",
        targets: [{ kind: "actor", id: "nobody" }],
        params: { weapon: "Longsword" },
      }),
    );
    const r = plan(q, ana, accept("sug-1"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal.code).not.toBe("INTENT_EXISTS");
  });

  it("a party item is re-stamped to the acceptor's first controlled character", () => {
    const q = sugged(
      item("i1", "sug-1", {
        kind: "attempt",
        params: { scope: "party" },
        text: "we sneak in",
      }),
    );
    const byCade = rowsOf(plan(q, cade, accept("sug-1")));
    expect(carrierOf(byCade).intent.actor).toEqual({ kind: "pc", id: "cade" });
    const byAna = rowsOf(plan(q, ana, accept("sug-1")));
    expect(carrierOf(byAna).intent.actor).toEqual({ kind: "pc", id: "ana" });
    expect(codeOf(plan(q, stranger, accept("sug-1")))).toBe("NOT_AUTHORIZED");
  });

  it("a second 👍 is INTENT_EXISTS", () => {
    const q = sugged(item("i1", "sug-1"));
    const rows = rowsOf(plan(q, ana, accept("sug-1")));
    const again = fold([
      suggestSpec("sug-1", [item("i1", "sug-1")]),
      ...asSpecs(rows),
    ]);
    expect(codeOf(plan(again, ana, accept("sug-1")))).toBe("INTENT_EXISTS");
  });

  it("SUGGESTION_NOT_FOUND for an unknown suggestion or item", () => {
    const q = sugged(item("i1", "sug-1"));
    expect(codeOf(plan(q, ana, accept("sug-9")))).toBe("SUGGESTION_NOT_FOUND");
    expect(codeOf(plan(q, ana, accept("sug-1", "i2")))).toBe(
      "SUGGESTION_NOT_FOUND",
    );
  });

  it("a stale 👍 is SUGGESTION_STALE; a confirmed item reads confirmed, not stale", () => {
    const q = fold([
      suggestSpec("sug-1", [item("i1", "sug-1")]),
      suggestSpec("sug-2", [item("i1", "sug-2")]),
    ]);
    expect(codeOf(plan(q, ana, accept("sug-1")))).toBe("SUGGESTION_STALE");
    expect(plan(q, ana, accept("sug-2")).ok).toBe(true);
  });

  it("the acceptor must control the item's character (NOT_AUTHORIZED)", () => {
    const q = sugged(item("i1", "sug-1"));
    expect(codeOf(plan(q, cade, accept("sug-1")))).toBe("NOT_AUTHORIZED");
    expect(codeOf(plan(q, outsider, accept("sug-1")))).toBe("NOT_AUTHORIZED");
    expect(codeOf(plan(q, seatedDm, accept("sug-1")))).toBe("NOT_AUTHORIZED");
  });

  it("a character who cannot act is CHARACTER_UNABLE", () => {
    const q = fold([
      suggestSpec("sug-1", [item("i1", "sug-1")]),
      {
        type: "scene-presence.changed",
        payload: {
          actorId: "ana",
          before: "present",
          after: "absent",
          reason: "left",
          actionId: null,
        },
      },
    ]);
    const r = plan(q, ana, accept("sug-1"));
    expect(codeOf(r)).toBe("CHARACTER_UNABLE");
  });

  it("the checks run in order: not found, stale, authorized", () => {
    const q = fold([
      suggestSpec("sug-1", [item("i1", "sug-1")]),
      suggestSpec("sug-2", [item("i1", "sug-2")]),
    ]);
    // stale AND unauthorised: stale wins
    expect(codeOf(plan(q, cade, accept("sug-1")))).toBe("SUGGESTION_STALE");
  });
});

describe("action.accept is human-only (FR-020)", () => {
  it("ai:dm cannot accept: the route refuses it", async () => {
    const { routeProposal, checkPermission } = await import("../src/index.js");
    const p = fold([suggestSpec("sug-1", [item("i1", "sug-1")])]);
    const r = accept("sug-1");
    expect(routeProposal(p, aiDm, r as never)).toEqual({
      route: "refuse",
      code: "NOT_AUTHORIZED",
    });
    expect(checkPermission(p, aiDm, r).ok).toBe(false);
    expect(
      checkPermission(p, { kind: "ai", actor: "ai:companion:bram" }, r).ok,
    ).toBe(false);
  });
});
