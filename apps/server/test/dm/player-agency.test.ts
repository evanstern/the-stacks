import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  type FactAction,
  type FactRoll,
  type NarrationFacts,
  renderDiceLines,
} from "../../src/dm/facts.js";
import { deterministicChecks } from "../../src/dm/nodes/audit.js";
import { EMPTY_RESOLVE_SNAPSHOT } from "./snapshot-fixtures.js";

const here = dirname(fileURLToPath(import.meta.url));
const captures = JSON.parse(
  readFileSync(join(here, "fixtures/player-agency-captures.json"), "utf8"),
) as Record<"seq10" | "seq82" | "seq87" | "seq126", string>;

const PARTY: NarrationFacts["party"] = [
  { characterId: "tamsin", name: "Tamsin Vale", controller: "human" },
  { characterId: "odo", name: "Brother Odo", controller: "ai-companion" },
  { characterId: "kestrel", name: "Kestrel", controller: "ai-companion" },
];

const miss = (): FactRoll => ({
  name: "Goblin-4",
  reason: "Goblin-4 stabs at Tamsin",
  expression: "1d20+4",
  shown: "10",
  total: 14,
  against: { kind: "AC", value: 16 },
  outcome: "miss",
  autoFail: false,
  target: "Tamsin Vale",
});

function facts(over: Partial<NarrationFacts> = {}): NarrationFacts {
  return {
    trigger: "commit",
    actions: [],
    npcTurn: {
      name: "Goblin-4",
      rolls: [miss()],
      outcomes: ["miss"],
      changes: [],
    },
    director: {
      pacing: { tension: "low", spotlight: null, beatId: null },
      goalNote: "",
      sceneEnded: false,
    },
    modeChange: null,
    presentNpcs: [],
    rulings: [],
    clarify: [],
    party: PARTY,
    events: [],
    setting: { locationName: "The Ford", openingFraming: "" },
    ...over,
  };
}

const agency = (f: NarrationFacts, prose: string) =>
  deterministicChecks(
    f,
    { prose, diceLines: renderDiceLines(f) },
    {
      snapshot: EMPTY_RESOLVE_SNAPSHOT.snapshot,
      diff: EMPTY_RESOLVE_SNAPSHOT.diff,
    },
  ).issues.filter((i) => i.kind === "player-agency");

describe("player agency: recorded captures (verify 20261026T192319Z)", () => {
  it("seq 82 fails once, naming Tamsin ('twists just enough')", () => {
    const issues = agency(facts(), captures.seq82);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.detail).toContain("Tamsin");
    expect(issues[0]?.detail).toContain("twists just enough");
  });

  it("seq 87 and seq 126 pass the agency checks", () => {
    expect(agency(facts(), captures.seq87)).toEqual([]);
    expect(agency(facts(), captures.seq126)).toEqual([]);
  });

  it("seq 10 at scene start fails on 'Tamsin Vale leads'", () => {
    const f = facts({ trigger: "scene-start", npcTurn: null });
    const issues = agency(f, captures.seq10);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]?.detail).toContain("Tamsin Vale leads");
  });
});

describe("player agency: the flinch on a miss (OQ-1 ruling)", () => {
  const prose = (s: string) => `The dagger hisses past. ${s} Smoke curls.`;
  it("allows a flinch", () => {
    expect(
      agency(
        facts(),
        prose("Tamsin flinches as the dagger hisses past her ribs."),
      ),
    ).toEqual([]);
  });
  it("blocks a chosen defence", () => {
    expect(
      agency(facts(), prose("Tamsin ducks under the dagger.")),
    ).toHaveLength(1);
    expect(
      agency(facts(), prose("Tamsin jerks aside just in time.")),
    ).toHaveLength(1);
  });
  it("exempts a member whose own declared action says so", () => {
    const own: FactAction = {
      actionId: "a1",
      characterName: "Tamsin Vale",
      text: "I duck behind the post",
      outcome: "applied",
      refusalCode: null,
      rolls: [],
      outcomes: [],
      changes: [],
      followUps: [],
    };
    expect(
      agency(facts({ actions: [own] }), prose("Tamsin ducks behind the post.")),
    ).toEqual([]);
  });
  it("runs on the prose with a trailing clarify question removed", () => {
    const q = "Does Tamsin duck or stand firm?";
    const f = facts({ clarify: [{ actionId: "a1", question: q }] });
    expect(agency(f, `The blow goes wide. ${q}`)).toEqual([]);
  });
});

describe("player agency: scene-start openings in the seeds", () => {
  const dir = join(here, "../../seeds");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    it(`${file} opening.framing names no party act`, () => {
      const seed = JSON.parse(readFileSync(join(dir, file), "utf8")) as {
        opening?: { framing?: string };
        characters?: { name: string }[];
      };
      if (!seed.opening?.framing) return;
      const party = (seed.characters ?? []).map((c, i) => ({
        characterId: `c${i}`,
        name: c.name,
        controller: "human" as const,
      }));
      const f = facts({ trigger: "scene-start", npcTurn: null, party });
      expect(agency(f, seed.opening.framing)).toEqual([]);
    });
  }
});
