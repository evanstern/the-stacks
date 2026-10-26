import { describe, expect, it } from "vitest";
import { RecordSchemas } from "../src/schema/index.js";
import { KINDS, type Rec, readData } from "./helpers.js";

interface Feature {
  name: string;
  text: string;
  attack?: unknown;
  save?: { ability: string; dc: number };
}

describe.each(KINDS)("%s records", (kind) => {
  const records = readData(kind);

  it("are not empty", () => {
    expect(records.length).toBeGreaterThan(0);
  });

  it("all validate against the schema", () => {
    for (const r of records) {
      const parsed = RecordSchemas[kind].safeParse(r);
      expect(
        parsed.success
          ? "ok"
          : `${r.id}: ${JSON.stringify(parsed.error.issues.slice(0, 2))}`,
      ).toBe("ok");
    }
  });

  it("have unique ids", () => {
    const ids = records.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("monster attack and save parsing", () => {
  const monsters = readData("monster");
  const features = (m: Rec): Feature[] => {
    const legendary =
      (m.legendaryActions as { actions: Feature[] } | undefined)?.actions ?? [];
    return [
      ...(m.traits as Feature[]),
      ...(m.actions as Feature[]),
      ...(m.bonusActions as Feature[]),
      ...(m.reactions as Feature[]),
      ...legendary,
    ];
  };

  it("every feature with 'Attack Roll:' has a parsed attack", () => {
    for (const m of monsters) {
      for (const f of features(m)) {
        if (f.text.includes("Attack Roll:")) {
          expect(f.attack, `${m.id}: ${f.name}`).toBeDefined();
        }
      }
    }
  });

  it("every feature with 'Saving Throw: DC' has a parsed save", () => {
    for (const m of monsters) {
      for (const f of features(m)) {
        if (f.text.includes("Saving Throw: DC")) {
          expect(f.save, `${m.id}: ${f.name}`).toBeDefined();
        }
      }
    }
  });

  it("keeps conditional damage clauses verbatim (Goblin Warrior)", () => {
    const goblin = monsters.find((m) => m.id === "goblin-warrior");
    const actions = (goblin?.actions ?? []) as Feature[];
    const scimitar = actions.find((x) => x.name === "Scimitar");
    expect(scimitar).toBeDefined();
    const attack = scimitar?.attack as { hit: { condition?: string }[] };
    expect(attack.hit).toHaveLength(2);
    expect(attack.hit[1]?.condition).toBe("if the attack roll had Advantage");
  });

  it("keeps one record per stat block", () => {
    const ids = new Set(monsters.map((m) => m.id));
    for (const id of [
      "werewolf",
      "werebear",
      "vampire",
      "vampire-spawn",
      "giant-fly",
    ]) {
      expect(ids.has(id), id).toBe(true);
    }
  });
});

describe("spell class references", () => {
  it("every Spell.classes id names a shipped class", () => {
    const classIds = new Set(readData("class").map((c) => c.id));
    for (const s of readData("spell")) {
      for (const c of s.classes as string[]) {
        expect(classIds.has(c), `${s.id} -> ${c}`).toBe(true);
      }
    }
  });
});

describe("text hygiene", () => {
  it("no record carries Markdown emphasis or upstream link artefacts", () => {
    for (const kind of KINDS) {
      const raw = JSON.stringify(readData(kind));
      expect(raw, kind).not.toMatch(/\*\*|XPHB|\[Area of Effect\]|`|\]\(/);
    }
  });
});
