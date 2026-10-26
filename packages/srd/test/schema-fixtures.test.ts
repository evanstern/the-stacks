import { describe, expect, it } from "vitest";
import { RecordSchemas } from "../src/schema/index.js";

const source = {
  document: "SRD 5.2.1",
  section: "Fixture Section",
  page: 1,
} as const;
const base = (id: string, name: string) => ({ id, name, source });

const block = { score: 10, mod: 0, save: 0 };
const monster = {
  ...base("fixture-monster", "Fixture Monster"),
  size: ["Medium"],
  type: "Humanoid",
  tags: [],
  alignment: "Unaligned",
  ac: 10,
  initiative: { mod: 0, score: 10 },
  hp: { average: 5, formula: "1d8 + 1" },
  speed: { walk: 30 },
  abilities: {
    str: block,
    dex: block,
    con: block,
    int: block,
    wis: block,
    cha: block,
  },
  skills: {},
  damageVulnerabilities: [],
  damageResistances: [],
  damageImmunities: [],
  conditionImmunities: [],
  gear: [],
  senses: { passivePerception: 10 },
  languages: "None",
  cr: { rating: "0", xp: 0 },
  pb: 2,
  traits: [],
  actions: [{ name: "Fixture Action", text: "fixture" }],
  bonusActions: [],
  reactions: [],
};

const spell = {
  ...base("fixture-spell", "Fixture Spell"),
  level: 0,
  school: "Evocation",
  classes: ["fixture-class"],
  castingTime: "Action",
  ritual: false,
  range: "Self",
  components: { v: true, s: false, m: false },
  concentration: false,
  duration: "Instantaneous",
  text: "fixture",
};

const levels = Array.from({ length: 20 }, (_, i) => ({
  level: i + 1,
  proficiencyBonus: 2,
  features: [],
  columns: {},
}));
const characterClass = {
  ...base("fixture-class", "Fixture Class"),
  hitDie: "d8",
  primaryAbility: "Strength",
  savingThrows: ["str", "con"],
  skillChoices: { count: 2, from: ["Athletics"] },
  weaponProficiencies: [],
  armorTraining: [],
  toolProficiencies: [],
  startingEquipment: "fixture",
  levels,
  features: [{ name: "Fixture Feature", level: 1, text: "fixture" }],
  subclass: {
    id: "fixture-subclass",
    name: "Fixture Subclass",
    text: "fixture",
    features: [{ name: "Fixture Feature", level: 3, text: "fixture" }],
  },
};

const equipment = {
  ...base("fixture-gear", "Fixture Gear"),
  category: "adventuring-gear",
  weight: 1,
  cost: { amount: 1, unit: "gp" },
  text: "fixture",
};

const condition = {
  ...base("fixture-condition", "Fixture Condition"),
  text: "fixture",
  effects: [{ name: "Fixture Effect", text: "fixture" }],
};

const valid = {
  monster,
  spell,
  class: characterClass,
  equipment,
  condition,
} as const;

describe("schema fixtures: one valid record per kind", () => {
  for (const kind of Object.keys(valid) as (keyof typeof valid)[]) {
    it(`${kind} parses`, () => {
      const result = RecordSchemas[kind].safeParse(valid[kind]);
      expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    });
  }
});

describe("schema fixtures: invalid cases", () => {
  it("rejects an unknown field (strict)", () => {
    expect(
      RecordSchemas.condition.safeParse({ ...condition, extra: 1 }).success,
    ).toBe(false);
  });

  it("rejects a bad id", () => {
    expect(
      RecordSchemas.condition.safeParse({ ...condition, id: "Bad Id" }).success,
    ).toBe(false);
  });

  it("rejects page 0", () => {
    const bad = { ...condition, source: { ...source, page: 0 } };
    expect(RecordSchemas.condition.safeParse(bad).success).toBe(false);
  });

  it("rejects a missing source", () => {
    const { source: _omitted, ...rest } = condition;
    expect(RecordSchemas.condition.safeParse(rest).success).toBe(false);
  });

  it("rejects a foreign document name", () => {
    const bad = { ...condition, source: { ...source, document: "Other" } };
    expect(RecordSchemas.condition.safeParse(bad).success).toBe(false);
  });
});
