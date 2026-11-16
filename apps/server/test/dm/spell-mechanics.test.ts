import { SPELLS } from "@the-stacks/dnd5e-engine";
import { getById } from "@the-stacks/srd";
import { describe, expect, it } from "vitest";

const ABILITY = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
} as const;

// Spec 083: the engine table restates SRD spell text; this test pins each clause to the record.
describe("engine spell table vs SRD spell records", () => {
  for (const m of Object.values(SPELLS)) {
    it(`${m.id} matches its SRD record`, () => {
      const rec = getById("spell", m.id);
      if (!rec) throw new Error(`no SRD spell ${m.id}`);
      expect(rec.level).toBe(m.level);
      expect(rec.castingTime).toBe(
        m.castingTime === "action" ? "Action" : "Bonus Action",
      );
      expect(rec.concentration).toBe(false);
      const text = rec.text;
      const all = `${rec.text} ${rec.higherLevels ?? ""}`;
      for (const d of m.damage) {
        expect(text).toContain(d.dice);
        expect(text.toLowerCase()).toContain(`${d.damageType} damage`);
      }
      if (m.healing) {
        expect(text).toContain(m.healing.dice);
        if (m.healing.addModifier) {
          expect(text).toContain("spellcasting ability modifier");
        }
      }
      if (m.delivery.kind === "attack") {
        expect(text).toContain(`${m.delivery.range} spell attack`);
      } else if (m.delivery.kind === "save") {
        expect(text).toContain(`${ABILITY[m.delivery.ability]} saving throw`);
        if (m.delivery.onSuccess === "half") {
          expect(text).toContain("half as much damage");
        }
      }
      if (m.condition) {
        expect(text.toLowerCase()).toContain(m.condition.key);
        expect(text).toContain("end of your next turn");
      }
      if (m.scaling.kind !== "none") {
        expect(all).toContain(`increases by ${m.scaling.die}`);
        expect(all).toContain(
          m.scaling.kind === "cantrip" ? "levels 5" : "spell slot level above",
        );
      }
    });
  }
});
