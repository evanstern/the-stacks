import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getById } from "@the-stacks/srd";
import { describe, expect, it } from "vitest";
import {
  combatantFromSrd,
  statsFromSrd,
} from "../../src/dm/seed/combatants.js";
import {
  listSeeds,
  loadSeed,
  parseSeed,
  SeedError,
} from "../../src/dm/seed/load.js";
import {
  dmOnlySeedPaths,
  dmOnlySeedText,
  playerFacingSeed,
} from "../../src/dm/seed/views.js";

const SEED_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "seeds",
  "greyhollow-ford.json",
);

// biome-ignore lint/suspicious/noExplicitAny: mutation helpers poke at raw JSON
type Row = any;

// biome-ignore lint/suspicious/noExplicitAny: raw JSON document
function raw(): any {
  return JSON.parse(readFileSync(SEED_PATH, "utf8"));
}

function issuesFor(mutate: (seed: Row) => void): string[] {
  const seed = raw();
  mutate(seed);
  try {
    parseSeed(seed);
  } catch (error) {
    expect(error).toBeInstanceOf(SeedError);
    return (error as SeedError).issues;
  }
  throw new Error("expected the mutated seed to fail");
}

describe("scene seed skill gate", () => {
  it("fails to load a character with an unknown skill key", () => {
    const issues = issuesFor((s) => {
      s.characters[0].identity.skills.Perception = 3;
    });
    expect(issues.length).toBeGreaterThan(0);
  });
});

describe("seed character class and level (spec 072)", () => {
  it("names class when a character omits it", () => {
    const issues = issuesFor((s) => {
      delete s.characters[0].identity.class;
    });
    expect(issues.join("\n")).toContain("class");
  });
  it("names level when a character omits it", () => {
    const issues = issuesFor((s) => {
      delete s.characters[0].identity.level;
    });
    expect(issues.join("\n")).toContain("level");
  });
  it.each([0, 21])("refuses level %i", (level) => {
    expect(
      issuesFor((s) => {
        s.characters[0].identity.level = level;
      }).join("\n"),
    ).toContain("level");
  });
  it("every shipped seed declares class and level on every character", () => {
    for (const seed of listSeeds()) {
      for (const c of seed.characters) {
        expect(c.identity.class.length).toBeGreaterThan(0);
        expect(c.identity.level).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe("seed space (spec 100, FR-020 and FR-021)", () => {
  it("every shipped seed declares a valid space with its NPC and encounter zones", () => {
    const seeds = listSeeds();
    expect(seeds.length).toBeGreaterThanOrEqual(4);
    for (const seed of seeds) {
      expect(seed.space, seed.seedId).toBeDefined();
      const zones = new Map(seed.space?.zones.map((z) => [z.id, z]));
      const start = zones.get(seed.space?.start as string);
      expect(start?.hidden).toBe(false);
      expect(start?.kind).not.toBe("feature");
      for (const e of seed.encounters)
        expect(zones.has(e.zone as string)).toBe(true);
      for (const n of seed.npcs) {
        if (n.zone) expect(zones.has(n.zone)).toBe(true);
      }
      expect(
        seed.space?.zones.filter((z) => z.kind === "feature").map((z) => z.id),
      ).toContain("camp-post");
    }
    expect(loadSeed("greyhollow-ford").space?.zones.map((z) => z.id)).toContain(
      "ferry-house-door",
    );
  });

  it("refuses a start that is unknown, hidden or a feature", () => {
    expect(
      issuesFor((s) => {
        s.space.start = "nowhere";
      }).join(" "),
    ).toContain('space start "nowhere" is not a zone');
    expect(
      issuesFor((s) => {
        s.space.start = "loft";
      }).join(" "),
    ).toContain('space start "loft" is hidden');
    expect(
      issuesFor((s) => {
        s.space.start = "ferry-house-door";
      }).join(" "),
    ).toContain('"ferry-house-door" is a feature zone');
  });

  it("refuses an NPC or encounter zone outside the space", () => {
    const issues = issuesFor((s) => {
      s.npcs[0].zone = "nowhere";
      s.encounters[0].zone = "elsewhere";
    }).join(" ");
    expect(issues).toContain('npc "wenna" names unknown zone "nowhere"');
    expect(issues).toContain(
      'encounter "reed-camp" names unknown zone "elsewhere"',
    );
  });

  it("refuses zone fields in a seed with no space", () => {
    const issues = issuesFor((s) => {
      delete s.space;
    }).join(" ");
    expect(issues).toContain(
      'npc "wenna" names zone "loft" but the seed has no space',
    );
    expect(issues).toContain(
      'encounter "reed-camp" names zone "reed-camp" but the seed has no space',
    );
  });

  it("a seed without space or zones still loads", () => {
    const seed = raw();
    delete seed.space;
    for (const n of seed.npcs) delete n.zone;
    for (const e of seed.encounters) delete e.zone;
    expect(parseSeed(seed).space).toBeUndefined();
  });

  it("refuses a space that fails SpaceSchema", () => {
    expect(
      issuesFor((s) => {
        s.space.edges.push({ ...s.space.edges[0] });
      }).join(" "),
    ).toContain("duplicate edge");
  });
});

describe("scene seed (AC #13)", () => {
  it("loads the shipped seed", () => {
    const seed = loadSeed("greyhollow-ford");
    expect(seed.seedId).toBe("greyhollow-ford");
    expect(seed.beats.map((b) => b.kind)).toEqual([
      "exploration",
      "social",
      "combat",
    ]);
    expect(seed.characters.filter((c) => c.seat === "human")).toHaveLength(1);
    expect(seed.trackers.map((t) => t.trackerId)).toEqual(["dusk", "alarm"]);
  });

  it("is a byte-for-byte copy of the spec data file", () => {
    const spec = join(
      dirname(SEED_PATH),
      "..",
      "..",
      "..",
      "specs",
      "031-dm-runtime",
      "data",
      "greyhollow-ford.seed.json",
    );
    expect(readFileSync(SEED_PATH, "utf8")).toBe(readFileSync(spec, "utf8"));
  });

  it("requires opening.premise and names it when missing", () => {
    const issues = issuesFor((s) => {
      delete s.opening.premise;
    });
    expect(issues.join(" ")).toContain("opening.premise");
  });

  it("gives every shipped seed a premise with no DM-only string", () => {
    for (const seed of listSeeds()) {
      expect(seed.opening.premise.length).toBeGreaterThan(0);
      for (const s of dmOnlySeedText(seed)) {
        expect(seed.opening.premise).not.toContain(s);
      }
      expect(playerFacingSeed(seed).openingPremise).toBe(seed.opening.premise);
    }
  });

  it("says original plus SRD in its license header", () => {
    expect(raw().license.kind).toBe("original-plus-srd");
    expect(raw().license.note).toContain("SRD 5.2.1");
  });

  it("rejects a missing seed with a SeedError", () => {
    expect(() => loadSeed("no-such-seed")).toThrow(SeedError);
    expect(() => loadSeed("../escape")).toThrow(SeedError);
  });

  it("names a schema failure", () => {
    const issues = issuesFor((s) => {
      s.v = 2;
    });
    expect(issues.join(" ")).toContain("v");
  });

  it("names a duplicate id", () => {
    const issues = issuesFor((s) => {
      s.npcs.push({ ...s.npcs[0] });
    });
    expect(issues).toContain(`duplicate id "${raw().npcs[0].id}" in npcs`);
  });

  it("names an unknown srdMonsterId", () => {
    const issues = issuesFor((s) => {
      s.encounters[0].monsters[0].srdMonsterId = "no-such-monster";
    });
    expect(issues.join(" ")).toContain(
      'unknown srdMonsterId "no-such-monster"',
    );
  });

  it("names an unknown spell", () => {
    const issues = issuesFor((s) => {
      const c = s.characters.find((x: Row) => x.identity.spells.length > 0);
      c.identity.spells.push("no-such-spell");
    });
    expect(issues.join(" ")).toContain('unknown spell "no-such-spell"');
  });

  it("names an unresolved beat npc and encounter", () => {
    const issues = issuesFor((s) => {
      s.beats[0].npcIds.push("ghost");
      s.beats[2].encounterId = "ghost-fight";
    });
    expect(issues.join(" ")).toContain('unknown npc "ghost"');
    expect(issues.join(" ")).toContain('unknown encounter "ghost-fight"');
  });

  it("names an unresolved relationship target", () => {
    const issues = issuesFor((s) => {
      s.npcs[0].hooks.relationships.push({ to: "ghost", kind: "kin" });
    });
    expect(issues.join(" ")).toContain(
      'relationship targets unknown id "ghost"',
    );
  });

  it("names a combatant id that differs from the character id", () => {
    const issues = issuesFor((s) => {
      s.characters[0].identity.combatant.id = "someone-else";
    });
    expect(issues.join(" ")).toContain('combatant id "someone-else" differs');
  });

  it("names an attack expression without a plain d20", () => {
    const issues = issuesFor((s) => {
      const c = s.characters.find((x: Row) => x.identity.attacks.length > 0);
      c.identity.attacks[0].expression = "2d6+3";
    });
    expect(issues.join(" ")).toContain("not a valid plain d20 expression");
  });

  it("names a damage expression that does not parse", () => {
    const issues = issuesFor((s) => {
      const c = s.characters.find((x: Row) => x.identity.attacks.length > 0);
      c.identity.attacks[0].damage[0].dice = "banana";
    });
    expect(issues.join(" ")).toContain('damage "banana" does not parse');
  });

  it("requires at least one human seat", () => {
    const none = issuesFor((s) => {
      for (const c of s.characters) c.seat = "companion";
    });
    expect(none.join(" ")).toContain(
      'at least one character must have seat "human", found 0',
    );
    const all = raw();
    for (const c of all.characters) c.seat = "human";
    expect(parseSeed(all).characters.every((c) => c.seat === "human")).toBe(
      true,
    );
  });

  it("loads the two-player duo seed", () => {
    const seed = loadSeed("greyhollow-ford-duo");
    expect(
      seed.characters
        .filter((c) => c.seat === "human")
        .map((c) => c.characterId),
    ).toEqual(["tamsin", "kestrel"]);
    expect(
      seed.characters
        .filter((c) => c.seat === "companion")
        .map((c) => c.characterId),
    ).toEqual(["odo"]);
  });

  it("loads the three-player trio seed", () => {
    const seed = loadSeed("greyhollow-ford-trio");
    expect(seed.title).toBe("Greyhollow Ford (three players)");
    expect(
      seed.characters
        .filter((c) => c.seat === "human")
        .map((c) => c.characterId),
    ).toEqual(["tamsin", "odo", "kestrel"]);
    expect(seed.characters.filter((c) => c.seat === "companion")).toEqual([]);
    const odo = seed.characters.find((c) => c.characterId === "odo");
    expect(odo?.portrayal.voice).toBe("Chosen by the player.");
    expect(odo?.portrayal.want).toBe("Chosen by the player.");
  });

  it("keeps exactly one human in greyhollow-ford", () => {
    const seed = loadSeed("greyhollow-ford");
    expect(seed.characters.filter((c) => c.seat === "human")).toHaveLength(1);
  });

  it("lists the shipped seeds sorted by id", () => {
    expect(listSeeds().map((s) => s.seedId)).toEqual([
      "greyhollow-ford",
      "greyhollow-ford-duo",
      "greyhollow-ford-reed-camp",
      "greyhollow-ford-trio",
    ]);
  });

  it("lists only valid seeds from a directory and does not throw", () => {
    const dir = mkdtempSync(join(tmpdir(), "seeds-"));
    try {
      writeFileSync(
        join(dir, "good.json"),
        JSON.stringify({ ...raw(), seedId: "good" }),
      );
      writeFileSync(join(dir, "bad.json"), JSON.stringify({ seedId: "bad" }));
      expect(listSeeds(dir).map((s) => s.seedId)).toEqual(["good"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("collects every issue before throwing", () => {
    const issues = issuesFor((s) => {
      s.beats[0].npcIds.push("ghost");
      s.encounters[0].monsters[0].srdMonsterId = "no-such-monster";
    });
    expect(issues.length).toBeGreaterThanOrEqual(2);
  });
});

describe("combatantFromSrd", () => {
  it("maps goblin-warrior", () => {
    const monster = getById("monster", "goblin-warrior");
    if (!monster) throw new Error("goblin-warrior missing from the SRD");
    expect(combatantFromSrd(monster, "snag", "Snag", "hostile")).toEqual({
      id: "snag",
      side: "hostile",
      name: "Snag",
      hp: { max: 10 },
      zeroHpRule: "dies",
      initiativeBonus: 2,
      conModifier: 0,
      ac: 15,
      speed: 30,
      defenses: { resistances: [], vulnerabilities: [], immunities: [] },
      stats: statsFromSrd(monster),
    });
  });

  it("maps goblin-minion and falls back to the SRD name", () => {
    const monster = getById("monster", "goblin-minion");
    if (!monster) throw new Error("goblin-minion missing from the SRD");
    expect(combatantFromSrd(monster, "goblin-3", null, "neutral")).toEqual({
      id: "goblin-3",
      side: "neutral",
      name: "Goblin Minion",
      hp: { max: 7 },
      zeroHpRule: "dies",
      initiativeBonus: 2,
      conModifier: 0,
      ac: 12,
      speed: 30,
      defenses: { resistances: [], vulnerabilities: [], immunities: [] },
      stats: statsFromSrd(monster),
    });
  });

  it("filters defenses to the engine's damage types, lower-cased", () => {
    const monster = {
      ...getById("monster", "goblin-warrior"),
      damageResistances: ["Fire", "Nonmagical Bludgeoning"],
      damageVulnerabilities: ["Cold"],
      damageImmunities: ["Poison"],
    } as never;
    const out = combatantFromSrd(monster, "x", null, "hostile");
    expect(out.defenses).toEqual({
      resistances: ["fire"],
      vulnerabilities: ["cold"],
      immunities: ["poison"],
    });
  });
});

describe("player-facing authoring rule (TASK-0106)", () => {
  it("no player-facing field mentions river-things or wards", () => {
    const view = playerFacingSeed(loadSeed("greyhollow-ford"));
    const text = JSON.stringify(view);
    expect(text).not.toMatch(/river[- ]things?/i);
    expect(text).not.toMatch(/\bwards?\b/i);
  });

  it("dmOnlySeedText holds the DM-only strings and no player-facing one", () => {
    const seed = loadSeed("greyhollow-ford");
    const dm = dmOnlySeedText(seed);
    expect(dm.every((s) => s.length > 0)).toBe(true);
    expect(dm).toContain(seed.goal.success);
    expect(dm).toContain(seed.location.hooks.secrets[0]);
    expect(dm).toContain(
      "He keeps the clapper because its ring keeps the river-things off his camp.",
    );
    expect(dm).not.toContain(seed.goal.statement);
    expect(dm).not.toContain(seed.opening.framing);
    for (const n of seed.npcs) expect(dm).not.toContain(n.portrayal.want);
  });

  it("playerFacingSeed copies player-facing fields only", () => {
    const seed = loadSeed("greyhollow-ford");
    const view = playerFacingSeed(seed);
    expect(view.goalStatement).toBe(seed.goal.statement);
    expect(view.openingFraming).toBe(seed.opening.framing);
    expect(view.npcs.map((n) => n.id)).toEqual(seed.npcs.map((n) => n.id));
    const json = JSON.stringify(view);
    for (const s of dmOnlySeedText(seed)) expect(json).not.toContain(s);
  });

  it("dmOnlySeedPaths resolves to exactly the dmOnlySeedText strings", () => {
    const seed = loadSeed("greyhollow-ford");
    const at = (pointer: string): unknown =>
      pointer
        .split("/")
        .slice(1)
        .reduce<unknown>(
          (node, key) => (node as Record<string, unknown>)[key],
          seed,
        );
    const paths = dmOnlySeedPaths(seed);
    expect(paths.map(at)).toEqual(dmOnlySeedText(seed));
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toContain("/goal/success");
    expect(paths).toContain("/beats/0/summary");
    // No path points into a player-facing field.
    const playerFacing = [
      /^\/goal\/statement/,
      /^\/opening/,
      /^\/title/,
      /^\/location\/(name|identity|portrayal)/,
      /\/portrayal(\/|$)/,
      /\/identity(\/|$)/,
    ];
    for (const p of paths) {
      for (const re of playerFacing) expect(p).not.toMatch(re);
    }
    // Player-facing strings never appear under any DM-only path.
    const pf = playerFacingSeed(seed);
    expect(paths.map(at)).not.toContain(pf.goalStatement);
    expect(paths.map(at)).not.toContain(pf.openingFraming);
  });
});

describe("seed NPC presence, identity and aliases (spec 050)", () => {
  it("declares presence per beat for every seed NPC (plan D2)", () => {
    const seed = loadSeed("greyhollow-ford");
    expect(seed.beats.map((b) => [b.id, b.presence])).toEqual([
      ["ferry-house", { wenna: "present", pell: "absent", snag: "absent" }],
      ["the-keeper", { wenna: "present", pell: "absent", snag: "absent" }],
      ["reed-camp", { wenna: "absent", pell: "present", snag: "present" }],
    ]);
  });

  it("names a beat that declares no presence for an NPC", () => {
    const issues = issuesFor((s) => {
      delete s.beats[1].presence.pell;
    });
    expect(issues).toContain(
      'beat "the-keeper" declares no presence for npc "pell"',
    );
  });

  it("names a beat that declares presence for an unknown NPC", () => {
    const issues = issuesFor((s) => {
      s.beats[0].presence.ghost = "present";
    });
    expect(issues).toContain(
      'beat "ferry-house" declares presence for unknown npc "ghost"',
    );
  });

  it("names a beat whose npcIds lists an NPC it declares absent", () => {
    const issues = issuesFor((s) => {
      s.beats[1].presence.wenna = "absent";
    });
    expect(issues.join(" ")).toContain('beat "the-keeper"');
    expect(issues.join(" ")).toContain('"wenna"');
    expect(issues.join(" ")).toContain("absent");
  });

  it("names an NPC whose identity.combatant differs from its id", () => {
    const issues = issuesFor((s) => {
      s.npcs[2].identity.combatant = "goblin-2";
    });
    expect(issues.join(" ")).toContain('npc "snag"');
    expect(issues.join(" ")).toContain('combatant "goblin-2" differs');
  });

  it("names an NPC whose identity.combatant names no encounter monster", () => {
    const issues = issuesFor((s) => {
      s.npcs[0].identity.combatant = "wenna";
    });
    expect(issues.join(" ")).toContain('npc "wenna"');
    expect(issues.join(" ")).toContain("names no encounter monster");
  });

  it("refuses an alias over 60 characters and seven aliases", () => {
    const long = issuesFor((s) => {
      s.npcs[0].identity.aliases = ["x".repeat(61)];
    });
    expect(long.length).toBeGreaterThan(0);
    const many = issuesFor((s) => {
      s.npcs[0].identity.aliases = ["a", "b", "c", "d", "e", "f", "g"];
    });
    expect(many.length).toBeGreaterThan(0);
  });

  it("yields aliases [] when absent and the ruled aliases on the shipped seed", () => {
    const seed = loadSeed("greyhollow-ford");
    expect(
      Object.fromEntries(seed.npcs.map((n) => [n.id, n.identity.aliases])),
    ).toEqual({
      wenna: ["the keeper"],
      pell: ["the boy"],
      snag: ["the goblin leader"],
    });
    const bare = raw();
    for (const n of bare.npcs) delete n.identity.aliases;
    for (const n of parseSeed(bare).npcs)
      expect(n.identity.aliases).toEqual([]);
  });
});

describe("seed tableRules (spec 070)", () => {
  it("defaults to bands and naturals on, group checks off", () => {
    const seed = raw();
    delete seed.tableRules;
    expect(parseSeed(seed).tableRules).toEqual({
      outcomeBands: true,
      naturals: true,
      groupChecks: false,
    });
  });

  it.each([
    ["outcomeBands", false],
    ["naturals", false],
    ["groupChecks", true],
  ])("overrides %s alone", (flag, value) => {
    const seed = raw();
    seed.tableRules = { [flag]: value };
    const rules = parseSeed(seed).tableRules as Record<string, boolean>;
    expect(rules[flag]).toBe(value);
    expect(Object.keys(rules).sort()).toEqual([
      "groupChecks",
      "naturals",
      "outcomeBands",
    ]);
  });
});

describe("seed character stats checks (spec 082 FR-011)", () => {
  it("refuses an attack expression that is not 1d20 plus a number", () => {
    const issues = issuesFor((s) => {
      s.characters[0].identity.attacks[0].expression = "2d20";
    });
    expect(issues.join(" ")).toContain("is not a valid plain d20 expression");
  });
  it("refuses an attack with a modifier that is not a plain number", () => {
    const issues = issuesFor((s) => {
      s.characters[0].identity.attacks[0].expression = "1d20+5+1d4";
    });
    expect(issues.join(" ")).toContain("not 1d20 plus or minus a number");
  });
  it("refuses an attack that is no SRD weapon", () => {
    const issues = issuesFor((s) => {
      s.characters[0].identity.attacks[0].name = "Moonblade";
    });
    expect(issues.join(" ")).toContain("is no SRD weapon");
  });
  it("refuses a combatant that already carries stats", () => {
    const issues = issuesFor((s) => {
      s.characters[0].identity.combatant.stats = {
        abilityMods: {},
        proficiencyBonus: 2,
        saves: {},
        skills: {},
        attacks: [],
        spellcastingAbility: null,
      };
    });
    expect(issues.join(" ")).toContain("carries stats");
  });
});

describe("seed ways (spec 091 D2, DA4)", () => {
  it("defaults to [] and reaches the player-facing view", () => {
    const seed = raw();
    delete seed.location.ways;
    const parsed = parseSeed(seed);
    expect(parsed.location.ways).toEqual([]);
    expect(playerFacingSeed(parsed).location.ways).toEqual([]);
    expect(playerFacingSeed(parseSeed(raw())).location.ways).toHaveLength(3);
  });
  it("refuses a way draft that does not parse", () => {
    const issues = issuesFor((s) => {
      s.location.ways[0].draft = "/bogus nothing";
    });
    expect(issues.join("\n")).toContain("ways");
  });
  it("refuses a way that moves into a hidden zone", () => {
    const issues = issuesFor((s) => {
      s.location.ways[1].draft = "/move #loft";
    });
    expect(issues.join("\n")).toContain("hidden zone");
  });
  it("refuses a way that moves into a zone the seed lacks", () => {
    const issues = issuesFor((s) => {
      s.location.ways[1].draft = "/move #nowhere";
    });
    expect(issues.join("\n")).toContain("unknown zone");
  });
});
