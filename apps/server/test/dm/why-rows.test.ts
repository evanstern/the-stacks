import { describe, expect, it } from "vitest";
import {
  buildFactSheet,
  type FactSheetInput,
  type PlanFact,
  renderWhyRows,
} from "../../src/dm/fact-sheet.js";
import type { NarrationFacts } from "../../src/dm/facts.js";

const nameOf = (id: string | null) =>
  ({ snag: "Snag", odo: "Odo", tamsin: "Tamsin" })[id ?? ""] ??
  id ??
  "The scene";
const text = (f: PlanFact, ruleTitle?: (id: string) => string | undefined) =>
  renderWhyRows([f], nameOf, ruleTitle).map((r) => r.text);

describe("renderWhyRows (spec 098 contract §6)", () => {
  it("rule: the SRD title, else the id", () => {
    expect(
      text({ kind: "rule", rule: "grappling" }, () => "Grappling"),
    ).toEqual(["Rule: Grappling"]);
    expect(text({ kind: "rule", rule: "grappling" })).toEqual([
      "Rule: grappling",
    ]);
  });
  it("dc: number plus difficulty, opposition, or bare difficulty", () => {
    expect(text({ kind: "dc", source: "dc", dc: 15 })).toEqual(["DC 15"]);
    expect(
      text({ kind: "dc", source: "difficulty", difficulty: "hard", dc: 20 }),
    ).toEqual(["DC 20 (hard)"]);
    expect(
      text({
        kind: "dc",
        source: "opposition",
        opposition: { opponentId: "snag", rule: "influence" },
      }),
    ).toEqual(["Opposed by Snag (influence)"]);
    expect(
      text({ kind: "dc", source: "difficulty", difficulty: "easy" }),
    ).toEqual(["Difficulty: easy"]);
  });
  it("reach, pull-in, reaction", () => {
    expect(text({ kind: "reach", band: "near", use: "melee" })).toEqual([
      "Reach: near, melee",
    ]);
    expect(text({ kind: "pull-in", actorId: "snag" })).toEqual([
      "Snag joins the fight",
    ]);
    expect(
      text({ kind: "reaction", reactorId: "odo", trigger: "leaves-zone" }),
    ).toEqual(["Odo may react as the mover leaves"]);
  });
  it("ruling with and without a reason", () => {
    expect(
      text({ kind: "ruling", requestId: "r", decision: "accept", by: "dm" }),
    ).toEqual(["DM ruling: accept"]);
    expect(
      text({
        kind: "ruling",
        requestId: "r",
        decision: "amend",
        by: "ai:dm",
        reason: "slippery",
      }),
    ).toEqual(["DM ruling: amend: slippery"]);
  });
  it("no-roll and ignored", () => {
    expect(text({ kind: "no-roll", reason: "uncontested" })).toEqual([
      "No roll needed",
    ]);
    expect(text({ kind: "ignored", field: "dc", why: "player-seat" })).toEqual([
      "The DM sets the dc",
    ]);
  });
  it("unserved renders no row", () => {
    expect(text({ kind: "unserved", part: "x", owner: "y" })).toEqual([]);
  });
  it("rows sit after change rows and before the State line", () => {
    const settled = {
      trigger: "commit",
      actions: [
        {
          actionId: "a1",
          characterName: "Tamsin",
          text: "I push",
          outcome: "applied",
          refusalCode: null,
          rolls: [],
          outcomes: [],
          changes: [
            { kind: "life-state", target: "Snag", before: "a", after: "b" },
          ],
          followUps: [],
        },
      ],
      npcTurn: null,
      director: {
        pacing: { tension: "low", spotlight: null, beatId: null },
        goalNote: "",
        sceneEnded: false,
      },
      modeChange: null,
      presentNpcs: [],
      rulings: [],
      clarify: [],
      party: [],
      events: [],
      setting: { locationName: "x", openingFraming: "x" },
    } as unknown as NarrationFacts;
    const sheet = buildFactSheet({
      settled,
      planFacts: [{ kind: "no-roll", reason: "uncontested" }],
      beat: [],
      projections: {
        party: [],
        tableMode: { mode: "free" },
        encounter: null,
      } as never,
      nameOf,
      submissions: [],
    } satisfies FactSheetInput);
    expect(sheet.rows.map((r) => r.kind)).toEqual(["life-state", "why"]);
  });
});
