import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  compact,
  getById,
  getByName,
  list,
  normalizeName,
  SrdDataError,
} from "../src/index.js";
import { createLoader } from "../src/loader.js";
import { KINDS, readData } from "./helpers.js";

const SAMPLE: Record<(typeof KINDS)[number], { id: string; name: string }> = {
  monster: { id: "goblin-warrior", name: "Goblin Warrior" },
  spell: { id: "fire-bolt", name: "Fire Bolt" },
  class: { id: "fighter", name: "Fighter" },
  equipment: { id: "longsword", name: "Longsword" },
  condition: { id: "prone", name: "Prone" },
};

describe.each(KINDS)("%s lookups", (kind) => {
  const sample = SAMPLE[kind];

  it("list returns every shipped record", () => {
    expect(list(kind).length).toBe(readData(kind).length);
  });

  it("resolves by id and by name to the same record", () => {
    const byId = getById(kind, sample.id);
    expect(byId?.name).toBe(sample.name);
    expect(getByName(kind, sample.name)).toBe(byId);
  });

  it("resolves case and spacing variants", () => {
    const variant = `  ${sample.name.toUpperCase().replace(/ /g, "   ")} `;
    expect(getByName(kind, variant)?.id).toBe(sample.id);
  });

  it("gives undefined for unknown id and name", () => {
    expect(getById(kind, "no-such-record")).toBeUndefined();
    expect(getByName(kind, "No Such Record")).toBeUndefined();
    expect(compact(kind, "No Such Record")).toBeUndefined();
  });
});

describe("name matching", () => {
  it("normalizeName maps curly apostrophes, case and spaces", () => {
    expect(normalizeName("  Tasha’s   Hideous  LAUGHTER ")).toBe(
      "tasha's hideous laughter",
    );
  });

  it("curly and straight apostrophes resolve alike", () => {
    const record = list("spell").find((s) => /['’]/.test(s.name));
    expect(record).toBeDefined();
    const name = (record as { name: string }).name;
    expect(getByName("spell", name.replace(/['’]/g, "’"))?.id).toBe(
      (record as { id: string }).id,
    );
    expect(getByName("spell", name.replace(/['’]/g, "'"))?.id).toBe(
      (record as { id: string }).id,
    );
  });

  it("Shield resolves per kind without crossing kinds", () => {
    const spell = getByName("spell", "Shield");
    const armor = getByName("equipment", "Shield");
    expect(spell?.school).toBe("Abjuration");
    expect((armor as { category?: string } | undefined)?.category).toBe(
      "armor",
    );
    expect(getByName("monster", "Shield")).toBeUndefined();
    expect(getByName("condition", "Shield")).toBeUndefined();
  });

  it("compact prefers id over name", () => {
    expect(compact("condition", "prone")).toMatch(
      /^Prone \[condition\/prone\]/,
    );
    expect(compact("condition", "PRONE")).toMatch(
      /^Prone \[condition\/prone\]/,
    );
  });
});

describe("data validation", () => {
  function tempDir(kind: string, content: unknown): string {
    const dir = mkdtempSync(join(tmpdir(), "srd-loader-"));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${kind}.json`), JSON.stringify(content));
    return dir;
  }

  it("throws SrdDataError naming kind, id and path for an invalid record", () => {
    const good = readData("condition")[0] as Record<string, unknown>;
    const bad = { ...good, id: "bad-record", extra: true, effects: [] };
    const loader = createLoader(tempDir("condition", [bad]));
    try {
      loader.list("condition");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(SrdDataError);
      const e = error as SrdDataError;
      expect(e.kind).toBe("condition");
      expect(e.recordId).toBe("bad-record");
      expect(e.path[0]).toBe(0);
      expect(e.message).toContain("bad-record");
    }
  });

  it("throws on a duplicate id", () => {
    const good = readData("condition")[0] as Record<string, unknown>;
    const loader = createLoader(
      tempDir("condition", [good, { ...good, name: "Another Name" }]),
    );
    expect(() => loader.list("condition")).toThrow(SrdDataError);
  });

  it("throws on a duplicate normalized name", () => {
    const good = readData("condition")[0] as { id: string; name: string };
    const loader = createLoader(
      tempDir("condition", [
        good,
        { ...good, id: "other-id", name: good.name.toUpperCase() },
      ]),
    );
    expect(() => loader.list("condition")).toThrow(SrdDataError);
  });

  it("caches: a second call returns the same array", () => {
    expect(list("condition")).toBe(list("condition"));
  });
});
