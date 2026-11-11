import { describe, expect, it } from "vitest";
import type { NarrationFacts } from "../../src/dm/facts.js";
import type { AssembleOutput } from "../../src/dm/nodes/assemble.js";
import {
  buildNarratePrompt,
  openingSection,
} from "../../src/dm/prompts/narrate.js";
import { listSeeds, loadSeed } from "../../src/dm/seed/load.js";
import { dmOnlySeedText, playerFacingSeed } from "../../src/dm/seed/views.js";
import type { ActorSnapshot } from "../../src/dm/snapshot/index.js";
import { buildSnapshot } from "../../src/dm/snapshot/index.js";
import { greyhollowFight } from "./snapshot-fixtures.js";

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
