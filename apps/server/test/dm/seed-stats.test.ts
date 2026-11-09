import { firstMeleeAttack } from "@the-stacks/dnd5e-engine";
import { getById, getByName } from "@the-stacks/srd";
import { describe, expect, it } from "vitest";
import {
  statsFromCharacter,
  statsFromSrd,
} from "../../src/dm/seed/combatants.js";
import { loadSeed } from "../../src/dm/seed/load.js";

const seed = loadSeed("greyhollow-ford");
const pc = (id: string) => {
  const c = seed.characters.find((x) => x.characterId === id);
  if (!c) throw new Error(`no ${id}`);
  return statsFromCharacter(c, { getByName });
};
const monster = (id: string) => {
  const rec = getById("monster", id);
  if (!rec) throw new Error(`no SRD monster ${id}`);
  return rec;
};

describe("statsFromCharacter", () => {
  it("builds Tamsin's sheet", () => {
    const s = pc("tamsin");
    expect(s.attacks[0]).toEqual({
      name: "Longsword",
      range: "melee",
      toHit: 5,
      damage: [
        {
          amount: { kind: "roll", expression: "1d8+3" },
          damageType: "slashing",
        },
      ],
    });
    expect(s.attacks[1]).toMatchObject({
      name: "Light crossbow",
      range: "ranged",
      toHit: 4,
    });
    expect(s.spellcastingAbility).toBeNull();
  });
  it("gives Odo his spellcasting ability", () => {
    expect(pc("odo").spellcastingAbility).toBe("wis");
  });
  it("builds Kestrel's ranged and melee entries", () => {
    const s = pc("kestrel");
    expect(s.attacks.map((a) => [a.name, a.range])).toEqual([
      ["Shortbow", "ranged"],
      ["Shortsword", "melee"],
    ]);
  });
});

describe("statsFromSrd", () => {
  it("reads goblin-warrior's Scimitar and skips the advantage part", () => {
    const s = statsFromSrd(monster("goblin-warrior"));
    expect(firstMeleeAttack(s)).toEqual({
      name: "Scimitar",
      range: "melee",
      reachFt: 5,
      toHit: 4,
      damage: [
        {
          amount: { kind: "roll", expression: "1d6+2" },
          damageType: "slashing",
        },
      ],
    });
    expect(s.skills.stealth).toBeDefined();
  });
  it("reads goblin-minion's melee-or-ranged Dagger", () => {
    const s = statsFromSrd(monster("goblin-minion"));
    expect(s.attacks.find((a) => a.name === "Dagger")).toEqual({
      name: "Dagger",
      range: "melee-or-ranged",
      reachFt: 5,
      rangeFt: { normal: 20, long: 60 },
      toHit: 4,
      damage: [
        {
          amount: { kind: "roll", expression: "1d4+2" },
          damageType: "piercing",
        },
      ],
    });
  });
  it("fills ability scores from the SRD record", () => {
    const rec = monster("goblin-warrior");
    const s = statsFromSrd(rec);
    expect(s.abilityScores).toEqual({
      str: rec.abilities.str.score,
      dex: rec.abilities.dex.score,
      con: rec.abilities.con.score,
      int: rec.abilities.int.score,
      wis: rec.abilities.wis.score,
      cha: rec.abilities.cha.score,
    });
  });
  it("gives a seed PC no ability scores", () => {
    expect(pc("tamsin").abilityScores).toBeUndefined();
  });
  it("returns no melee attack for a record with only ranged actions", () => {
    const rec = structuredClone(monster("goblin-warrior"));
    for (const a of rec.actions) if (a.attack) a.attack.type = "ranged";
    expect(firstMeleeAttack(statsFromSrd(rec))).toBeNull();
  });
});

describe("spec 094 speed, reach and range", () => {
  it("maps the goblin's speed, scimitar reach and shortbow range", async () => {
    const { combatantFromSrd } = await import(
      "../../src/dm/seed/combatants.js"
    );
    const c = combatantFromSrd(monster("goblin-warrior"), "g", null);
    expect(c.speed).toBe(30);
    const s = statsFromSrd(monster("goblin-warrior"));
    expect(s.attacks.find((a) => a.name === "Scimitar")?.reachFt).toBe(5);
    expect(s.attacks.find((a) => a.name === "Shortbow")?.rangeFt).toEqual({
      normal: 80,
      long: 320,
    });
  });
  it("maps a PC weapon's range from the SRD", () => {
    const k = pc("kestrel").attacks.find((a) => a.name === "Shortbow");
    expect(k?.rangeFt).toEqual({ normal: 80, long: 320 });
    expect(pc("tamsin").attacks[0]?.reachFt).toBeUndefined();
  });
});
