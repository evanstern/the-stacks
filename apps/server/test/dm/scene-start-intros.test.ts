import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { NarrationFacts } from "../../src/dm/facts.js";
import type { AssembleOutput } from "../../src/dm/nodes/assemble.js";
import {
  beforeClosingQuestion,
  deterministicChecks,
  namesCharacter,
} from "../../src/dm/nodes/audit.js";
import {
  buildNarratePrompt,
  openingSection,
} from "../../src/dm/prompts/narrate.js";
import { listSeeds, loadSeed } from "../../src/dm/seed/load.js";
import { dmOnlySeedText, playerFacingSeed } from "../../src/dm/seed/views.js";
import type { ActorSnapshot } from "../../src/dm/snapshot/index.js";
import { buildSnapshot } from "../../src/dm/snapshot/index.js";
import {
  EMPTY_RESOLVE_SNAPSHOT,
  greyhollowFight,
} from "./snapshot-fixtures.js";

function factsFor(
  seedId: string,
  trigger: NarrationFacts["trigger"],
): NarrationFacts {
  const seed = loadSeed(seedId);
  return {
    trigger,
    actions: [],
    npcTurn: null,
    director: {
      pacing: { tension: "low", spotlight: null, beatId: null },
      goalNote: "",
      sceneEnded: false,
    },
    modeChange: null,
    presentNpcs: seed.npcs
      .filter((n) => seed.beats[0]?.presence[n.id] !== "absent")
      .map((n) => ({
        id: n.id,
        name: n.name,
        voice: n.portrayal.voice,
        want: n.portrayal.want,
        detail: n.portrayal.detail,
      })),
    rulings: [],
    clarify: [],
    party: seed.characters.map((c) => ({
      characterId: c.characterId,
      name: c.name,
      controller: c.seat === "human" ? "human" : "ai-companion",
    })),
    events: [],
    setting: {
      locationName: seed.location.name,
      openingFraming: seed.opening.framing,
    },
  } as unknown as NarrationFacts;
}

const EMPTY_ASSEMBLED = {
  transcriptTail: [],
  projections: { party: [] },
} as unknown as AssembleOutput;
const FIGHT = greyhollowFight();
const SNAPSHOT: ActorSnapshot = buildSnapshot(FIGHT.projections, FIGHT.seed);

function promptFor(seedId: string, trigger: NarrationFacts["trigger"]) {
  return buildNarratePrompt({
    seed: playerFacingSeed(loadSeed(seedId)),
    roster: [],
    assembled: EMPTY_ASSEMBLED,
    snapshot: SNAPSHOT,
    facts: factsFor(seedId, trigger),
    prior: null,
  });
}

describe("openingSection", () => {
  const seed = playerFacingSeed(loadSeed("greyhollow-ford-duo"));
  const text = openingSection(
    seed,
    factsFor("greyhollow-ford-duo", "scene-start"),
  );

  it("carries place, premise, goal, framing, party and present NPCs", () => {
    expect(text).toContain(seed.location.name);
    for (const f of seed.location.features) expect(text).toContain(f);
    expect(text).toContain(seed.location.mood);
    for (const s of seed.location.senses) expect(text).toContain(s);
    expect(text).toContain(seed.openingPremise);
    expect(text).toContain(seed.goalStatement);
    expect(text).toContain(seed.openingFraming);
    expect(text).toContain("Tamsin Vale, Fighter.");
    expect(text).toContain("Wenna Marsh, ferry keeper");
    expect(text).toContain(
      "Name every party member and every character present",
    );
    expect(text).toContain(
      "The opening shows the place and what the party finds. It never moves, leads or voices a party member.",
    );
  });

  it("uses What do you do? only inside the Never end with line", () => {
    const lines = text.split("\n").filter((l) => l.includes("What do you do?"));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("Never end with");
  });

  it("names no player, no controller", () => {
    expect(text.replace("the players see", "")).not.toMatch(
      /player|companion/i,
    );
  });

  it("is empty for every other trigger", () => {
    for (const t of ["commit", "npc-turn", "talk"] as const) {
      expect(openingSection(seed, factsFor("greyhollow-ford-duo", t))).toBe("");
      expect(promptFor("greyhollow-ford-duo", t).user).not.toContain(
        "## Opening",
      );
    }
  });

  it("rejects the full seed at compile time", () => {
    const full = loadSeed("greyhollow-ford-duo");
    const facts = factsFor("greyhollow-ford-duo", "commit");
    // @ts-expect-error the full seed is not a PlayerSeedView
    expect(() => openingSection(full, facts)).not.toThrow();
  });
});

describe("scene-start prompt leaks", () => {
  it("holds no DM-only string for any shipped seed", () => {
    for (const seed of listSeeds()) {
      const user = promptFor(seed.seedId, "scene-start").user;
      for (const s of dmOnlySeedText(seed)) expect(user).not.toContain(s);
    }
  });
});

// Captured openings (R6): specs/034-narration-quality/evidence/.
const VERIFY_TEXT =
  "The amber light catches Greyhollow Ford gone wrong. The ferry sits chained at its post, and the bell that should have called out across the water hangs dead on its post. Tamsin Vale leads the way up from the bank, Brother Odo and Kestrel behind her, boots loud on planks that should have someone's voice over them by now.\n\nThe ferry-house door stands open on nothing. Inside: a length of rope cut clean a yard off the floor, swinging slack. The strongbox pried and gaping. And tracks \u2014 small, clawed, pressed into the dust \u2014 leading not toward the crossing, but down along the causoway, toward the river's dark bend.\n\nAbove, a floorboard creaks.\n\nWhat does Tamsin do?";
const RUN5_TEXT = (() => {
  const dir = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../specs/034-narration-quality/evidence/run5-20261026T171359Z-greyhollow-ford-provider/transcript.jsonl",
  );
  for (const l of readFileSync(dir, "utf8").split("\n")) {
    const o = l ? JSON.parse(l) : null;
    if (o?.seq === 10) return o.payload.text as string;
  }
  throw new Error("run5 seq 10 missing");
})();
const BASE_TEXT =
  "The party reaches Greyhollow Ford as the light goes amber. Tamsin Vale, Brother Odo and Kestrel came to cross before full dark, and the ferry keeper owes Tamsin a crossing. The ferry sits chained to the near bank, the ferry-house door hangs open, and the bell that should have rung for them stays silent. Above, in the loft, a board creaks: Wenna Marsh, the keeper, is somewhere overhead and has not called down. Where do you start?";
const REED_TEXT =
  "The party reaches the end of the causeway as the light goes amber, on the trail of whoever silenced the ferry bell. Tamsin Vale, Brother Odo and Kestrel mean to have the ferry crossing again before full dark. Wenna Marsh keeps close with her boathook, and smoke from the goblins' reed-camp curls up from the reeds ahead. Where do you start?";

const GREY = (trigger: NarrationFacts["trigger"]) =>
  ({
    ...factsFor("greyhollow-ford", trigger),
    party: [
      { characterId: "tamsin", name: "Tamsin Vale", controller: "human" },
      { characterId: "odo", name: "Brother Odo", controller: "human" },
      { characterId: "kestrel", name: "Kestrel", controller: "ai-companion" },
    ],
    presentNpcs: [
      { id: "wenna", name: "Wenna Marsh", voice: "", want: "", detail: "" },
    ],
  }) as unknown as NarrationFacts;
const checks = (text: string, trigger: NarrationFacts["trigger"]) =>
  deterministicChecks(
    GREY(trigger),
    { prose: text, diceLines: [] },
    EMPTY_RESOLVE_SNAPSHOT,
  ).issues.map((i) => i.detail);

describe("name check helpers", () => {
  it("beforeClosingQuestion cuts the final question", () => {
    expect(beforeClosingQuestion("Fog. Odo waits. Where now?")).toBe(
      "Fog. Odo waits.",
    );
    expect(beforeClosingQuestion("Where now?")).toBe("");
    expect(beforeClosingQuestion("Fog rolls in.")).toBe("Fog rolls in.");
  });
  it("namesCharacter matches whole, cased given or full names", () => {
    expect(namesCharacter("Odo waits.", "Brother Odo")).toBe(true);
    expect(namesCharacter("Snagged it.", "Snag")).toBe(false);
    expect(namesCharacter("a snag.", "Snag")).toBe(false);
    expect(namesCharacter("Vale waits.", "Tamsin Vale")).toBe(false);
    expect(namesCharacter("Tamsin Vale waits.", "Tamsin Vale")).toBe(true);
  });
});

describe("scene-start name check (captured replay)", () => {
  it("flags only Wenna Marsh in the verify text", () => {
    const d = checks(VERIFY_TEXT, "scene-start");
    expect(d.filter((x) => x.includes("does not name"))).toEqual([
      expect.stringContaining("Wenna Marsh"),
    ]);
  });
  it("flags all four in the run5 text", () => {
    expect(
      checks(RUN5_TEXT, "scene-start").filter((x) =>
        x.includes("does not name"),
      ),
    ).toHaveLength(4);
  });
  it("the same text on commit has no name issue", () => {
    expect(checks(VERIFY_TEXT, "commit").join()).not.toContain("does not name");
  });
  it("the scripted openings pass every deterministic check", () => {
    expect(checks(BASE_TEXT, "scene-start")).toEqual([]);
    expect(checks(REED_TEXT, "scene-start")).toEqual([]);
  });
  it("blocks player and controller words at scene start only", () => {
    const one = (t: string, trig: NarrationFacts["trigger"]) =>
      checks(t, trig).filter((x) => x.includes("player or a controller"));
    const withAi = BASE_TEXT.replace(
      " Where do you start?",
      " Kestrel, the AI companion, waits. Where do you start?",
    );
    const withPlayers = BASE_TEXT.replace(
      " Where do you start?",
      " The players arrive. Where do you start?",
    );
    expect(one(withAi, "scene-start")).toHaveLength(1);
    expect(one(withPlayers, "scene-start")).toHaveLength(1);
    expect(one(withAi, "commit")).toEqual([]);
    expect(one(withPlayers, "commit")).toEqual([]);
  });
});
