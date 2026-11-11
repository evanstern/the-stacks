import { describe, expect, it } from "vitest";
import { openRulings, project, type Viewer } from "../src/index.js";
import { makeRows, PLAYER_A, type RowSpec } from "./helpers.js";

const dm: Viewer = { role: "dm" };
const attempt = (id: string) => ({
  id,
  kind: "attempt",
  actor: { kind: "pc", id: "ana" },
  params: { scope: "character" },
  text: "I climb the rope.",
  source: "composer",
  commit: "confirmed",
});
const request = (id: string) => ({
  requestId: id,
  intent: attempt(id),
  ask: "outcome",
  roll: null,
  opposition: null,
  stakes: "self",
  rule: null,
});
const carrier = (
  over: Record<string, unknown>,
  visibility = "public",
): RowSpec => ({
  type: "intent.recorded",
  payload: {
    intent: attempt("i-1"),
    schemaVersion: 1,
    outcome: "settled",
    batchId: null,
    facts: [],
    request: null,
    answers: null,
    stopped: null,
    ...over,
  },
  opts: { actor: PLAYER_A, visibility },
});
const open: RowSpec = carrier({
  outcome: "needs_ruling",
  request: request("i-1"),
});

describe("intents projection", () => {
  it("folds a settled Intent", () => {
    const p = project(makeRows([carrier({})]), dm);
    expect(p.intents).toMatchObject([
      { id: "i-1", seq: 1, actor: PLAYER_A, status: "settled" },
    ]);
    expect(openRulings(p)).toEqual({});
  });

  it("lists an open request, with its proposal id once a proposal names it", () => {
    const rows: RowSpec[] = [
      open,
      {
        type: "proposal.created",
        payload: {
          proposalId: "p1",
          policy: "ask",
          proposal: {
            kind: "intent",
            summary: null,
            rationale: null,
            intent: attempt("i-1"),
          },
        },
        opts: { visibility: "dm" },
      },
    ];
    const p = project(makeRows(rows), dm);
    expect(Object.keys(openRulings(p))).toEqual(["i-1"]);
    expect(openRulings(p)["i-1"]).toMatchObject({
      proposalId: "p1",
      ask: "outcome",
    });
  });

  it("an answer row closes the request", () => {
    const answer = carrier({
      intent: {
        ...attempt("i-2"),
        kind: "ruling",
        params: { requestId: "i-1", decision: "accept" },
        text: undefined,
      },
      answers: "i-1",
    });
    const p = project(makeRows([open, answer]), dm);
    expect(p.intents.find((v) => v.id === "i-1")?.status).toBe("answered");
    expect(openRulings(p)).toEqual({});
  });

  it("a confirm of a declared id replaces the entry and keeps its first seq", () => {
    const p = project(
      makeRows([carrier({ outcome: "declared" }), carrier({})]),
      dm,
    );
    expect(p.intents).toHaveLength(1);
    expect(p.intents[0]).toMatchObject({ seq: 1, status: "settled" });
  });

  it("a player viewer never sees a dm-visibility carrier", () => {
    const p = project(makeRows([carrier({}, "dm")]), {
      role: "player",
      userId: PLAYER_A,
    });
    expect(p.intents).toEqual([]);
  });
});
