import type { Combatant } from "@the-stacks/dnd5e-engine";
import { describe, expect, it } from "vitest";
import { monsterStages } from "../../src/dm/monster-policy.js";
import { clone, combatant, greyhollowFight } from "./snapshot-fixtures.js";

const atk = (name: string, range: "melee" | "ranged") => ({
  name,
  range,
  toHit: 4,
  damage: [],
});
const stats = (...attacks: ReturnType<typeof atk>[]): Combatant["stats"] =>
  ({
    abilityMods: {},
    proficiencyBonus: 2,
    saves: {},
    skills: {},
    attacks,
    spellcastingAbility: null,
  }) as Combatant["stats"];

/** Snag (hostile) against Tamsin, Odo, Kestrel (party); Snag acts. */
function world(
  attacks: ReturnType<typeof atk>[],
  zones?: Record<string, string>,
) {
  const { projections: p, seed } = clone(greyhollowFight());
  const c = p.engine.combatants;
  for (const id of ["tamsin", "odo", "kestrel"])
    (c[id] as Combatant).side = "party";
  c.snag = combatant("snag", "Snag", {
    side: "hostile",
    stats: stats(...attacks),
  });
  p.encounter = p.encounter && {
    ...p.encounter,
    order: ["snag", "tamsin", "odo", "kestrel"].map((id) => ({
      combatantId: id,
      name: id,
      initiative: 10,
      hp: (c[id] as Combatant).hp,
      lifeState: "conscious" as const,
      conditions: [],
      characterId: null,
    })),
  };
  p.spatial = { space: null, map: null, placements: zones ?? {} };
  return { p, seed, c };
}
const only = (s: ReturnType<typeof monsterStages>) =>
  s.map((x) => [
    x.intent.kind,
    (x.intent.targets[0] as { id?: string } | undefined)?.id,
    (x.intent.params as { weapon?: string }).weapon,
  ]);

describe("monsterStages (spec 107 D3)", () => {
  it("no combatant, no attacks or no foes give no stage", () => {
    const w = world([atk("Scimitar", "melee")]);
    expect(monsterStages(w.p, w.seed, "nobody")).toEqual([]);
    const bare = world([]);
    expect(monsterStages(bare.p, bare.seed, "snag")).toEqual([]);
    for (const id of ["tamsin", "odo", "kestrel"])
      (w.c[id] as Combatant).lifeState = "unconscious";
    expect(monsterStages(w.p, w.seed, "snag")).toEqual([]);
  });

  it("no placements: everyone is engaged, the first foe in order takes a melee attack", () => {
    const w = world([atk("Scimitar", "melee")]);
    expect(only(monsterStages(w.p, w.seed, "snag"))).toEqual([
      ["attack", "tamsin", "Scimitar"],
    ]);
  });

  it("engaged melee picks the melee entry; a ranged-only monster shoots", () => {
    const z = { snag: "a", tamsin: "a", odo: "b", kestrel: "b" };
    const m = world([atk("Bow", "ranged"), atk("Scimitar", "melee")], z);
    expect(only(monsterStages(m.p, m.seed, "snag"))).toEqual([
      ["attack", "tamsin", "Scimitar"],
    ]);
    const r = world([atk("Bow", "ranged")], z);
    expect(only(monsterStages(r.p, r.seed, "snag"))).toEqual([
      ["attack", "tamsin", "Bow"],
    ]);
  });

  it("ranged beats a move when the target is in another zone", () => {
    const w = world([atk("Bow", "ranged"), atk("Scimitar", "melee")], {
      snag: "a",
      tamsin: "b",
      odo: "b",
      kestrel: "b",
    });
    expect(only(monsterStages(w.p, w.seed, "snag"))).toEqual([
      ["attack", "tamsin", "Bow"],
    ]);
  });

  it("melee only, target elsewhere: move then attack", () => {
    const w = world([atk("Scimitar", "melee")], {
      snag: "a",
      tamsin: "b",
      odo: "b",
      kestrel: "b",
    });
    expect(only(monsterStages(w.p, w.seed, "snag"))).toEqual([
      ["move", "b", undefined],
      ["attack", "tamsin", "Scimitar"],
    ]);
  });

  it("nearest prefers an engaged foe over an earlier one elsewhere", () => {
    const w = world([atk("Scimitar", "melee")], {
      snag: "a",
      tamsin: "b",
      odo: "a",
      kestrel: "b",
    });
    expect(only(monsterStages(w.p, w.seed, "snag"))).toEqual([
      ["attack", "odo", "Scimitar"],
    ]);
  });

  it("weakest picks the lowest hp; initiative order breaks a tie", () => {
    const w = world([atk("Scimitar", "melee")]);
    const mon = w.seed.encounters.flatMap((e) => e.monsters)[0];
    if (!mon) throw new Error("no seed monster");
    w.seed.encounters
      .flatMap((e) => e.monsters)
      .forEach((m) => {
        m.combatantId = "snag";
        m.tactics = "weakest";
      });
    (w.c.odo as Combatant).hp = { current: 3, max: 20, temp: 0 };
    expect(only(monsterStages(w.p, w.seed, "snag"))[0]).toEqual([
      "attack",
      "odo",
      "Scimitar",
    ]);
    (w.c.kestrel as Combatant).hp = { current: 3, max: 14, temp: 0 };
    expect(only(monsterStages(w.p, w.seed, "snag"))[0]).toEqual([
      "attack",
      "odo",
      "Scimitar",
    ]);
  });
});
