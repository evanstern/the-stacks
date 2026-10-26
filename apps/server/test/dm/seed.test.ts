import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getById } from "@the-stacks/srd";
import { describe, expect, it } from "vitest";
import { combatantFromSrd } from "../../src/dm/seed/combatants.js";
import { loadSeed, parseSeed, SeedError } from "../../src/dm/seed/load.js";
import { dmOnlySeedText, playerFacingSeed } from "../../src/dm/seed/views.js";

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

  it("requires exactly one human seat", () => {
    const none = issuesFor((s) => {
      for (const c of s.characters) c.seat = "companion";
    });
    expect(none.join(" ")).toContain("exactly one character");
    const two = issuesFor((s) => {
      for (const c of s.characters) c.seat = "human";
    });
    expect(two.join(" ")).toContain("exactly one character");
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
    expect(combatantFromSrd(monster, "snag", "Snag")).toEqual({
      id: "snag",
      name: "Snag",
      hp: { max: 10 },
      zeroHpRule: "dies",
      initiativeBonus: 2,
      conModifier: 0,
      ac: 15,
      defenses: { resistances: [], vulnerabilities: [], immunities: [] },
    });
  });

  it("maps goblin-minion and falls back to the SRD name", () => {
    const monster = getById("monster", "goblin-minion");
    if (!monster) throw new Error("goblin-minion missing from the SRD");
    expect(combatantFromSrd(monster, "goblin-3", null)).toEqual({
      id: "goblin-3",
      name: "Goblin Minion",
      hp: { max: 7 },
      zeroHpRule: "dies",
      initiativeBonus: 2,
      conModifier: 0,
      ac: 12,
      defenses: { resistances: [], vulnerabilities: [], immunities: [] },
    });
  });

  it("filters defenses to the engine's damage types, lower-cased", () => {
    const monster = {
      ...getById("monster", "goblin-warrior"),
      damageResistances: ["Fire", "Nonmagical Bludgeoning"],
      damageVulnerabilities: ["Cold"],
      damageImmunities: ["Poison"],
    } as never;
    const out = combatantFromSrd(monster, "x", null);
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
});
