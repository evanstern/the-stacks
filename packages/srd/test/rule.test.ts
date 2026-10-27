import { describe, expect, it } from "vitest";
import { compact, getById, getByName, list } from "../src/index.js";
import { estimateTokens } from "../src/tokens.js";
import { readData } from "./helpers.js";

const CEILING = 120;
const slug = (name: string): string =>
  name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const rules = list("rule");

describe("rule records", () => {
  it("ships the chapter and the four glossary actions", () => {
    expect(rules.length).toBe(readData("rule").length);
    expect(rules.length).toBeGreaterThanOrEqual(100);
    for (const id of [
      "rules-glossary.help-action",
      "rules-glossary.influence-action",
      "rules-glossary.search-action",
      "rules-glossary.study-action",
    ]) {
      expect(getById("rule", id)?.source.section, id).toBe("Rules Glossary");
    }
  });

  it("the DC table record holds exactly the six SRD rows", () => {
    const dc = getById(
      "rule",
      "playing-the-game.d20-tests.ability-checks.difficulty-class",
    );
    const tables = dc?.blocks.filter((b) => b.type === "table") ?? [];
    expect(tables).toHaveLength(1);
    const table = tables[0];
    if (table?.type !== "table") throw new Error("not a table");
    expect(table.title).toBe("Typical Difficulty Classes");
    expect(table.columns).toEqual(["Task Difficulty", "DC"]);
    expect(table.rows).toEqual([
      ["Very easy", "5"],
      ["Easy", "10"],
      ["Medium", "15"],
      ["Hard", "20"],
      ["Very hard", "25"],
      ["Nearly impossible", "30"],
    ]);
  });

  it("every child of the d20 tests record loads, and the three kinds are among them", () => {
    const d20 = getById("rule", "playing-the-game.d20-tests");
    expect(d20?.children.length).toBeGreaterThanOrEqual(4);
    for (const child of d20?.children ?? []) {
      const record = getById("rule", child);
      expect(record, child).toBeDefined();
      expect(record?.parent, child).toBe("playing-the-game.d20-tests");
    }
    for (const tail of [
      "ability-checks",
      "saving-throws",
      "attack-rolls",
      "advantage-disadvantage",
    ]) {
      expect(d20?.children).toContain(`playing-the-game.d20-tests.${tail}`);
    }
  });

  it("every id named under Downstream lookups in spec.md exists", () => {
    const ids = [
      "playing-the-game.d20-tests.ability-checks.difficulty-class",
      "playing-the-game.the-six-abilities.ability-modifiers",
      "playing-the-game.d20-tests.ability-checks.proficiency-bonus",
      "playing-the-game.d20-tests",
      "playing-the-game.d20-tests.ability-checks",
      "playing-the-game.d20-tests.saving-throws",
      "playing-the-game.d20-tests.attack-rolls",
      "playing-the-game.d20-tests.advantage-disadvantage",
      "rules-glossary.help-action",
      "rules-glossary.influence-action",
      "rules-glossary.search-action",
      "rules-glossary.study-action",
    ];
    for (const id of ids) expect(getById("rule", id), id).toBeDefined();
  });

  it("id equals the slugged path, and name and title follow the path", () => {
    for (const r of rules) {
      expect(r.id, r.id).toBe(r.path.map(slug).join("."));
      expect(r.name, r.id).toBe(r.path.join(" › "));
      expect(r.title, r.id).toBe(r.path[r.path.length - 1]);
    }
  });

  it("parent and children agree", () => {
    const ids = new Set(rules.map((r) => r.id));
    for (const r of rules) {
      if (r.parent !== null) {
        expect(ids.has(r.parent), r.id).toBe(true);
        expect(getById("rule", r.parent)?.children, r.id).toContain(r.id);
        expect(r.id.startsWith(`${r.parent}.`), r.id).toBe(true);
        expect(r.path.length, r.id).toBe(
          (getById("rule", r.parent)?.path.length ?? 0) + 1,
        );
      }
      for (const c of r.children) {
        expect(getById("rule", c)?.parent, `${r.id} -> ${c}`).toBe(r.id);
      }
    }
  });

  it("every record's compact form is at most 120 estimated tokens", () => {
    for (const r of rules) {
      const text = list("rule").length > 0 ? getCompact(r.id) : "";
      expect(estimateTokens(text), r.id).toBeLessThanOrEqual(CEILING);
    }
  });

  it("every compact form has a header, the page footer and, for parents, child titles", () => {
    for (const r of rules) {
      const text = getCompact(r.id);
      expect(text.startsWith(`${r.title} [rule/${r.id}]`), r.id).toBe(true);
      expect(text.endsWith(`SRD 5.2.1 p.${r.source.page}`), r.id).toBe(true);
      if (r.children.length > 0 && !/\+\d+ more/.test(text)) {
        const titles = r.children
          .map((c) => getById("rule", c)?.title)
          .join(", ");
        expect(text, r.id).toContain(`See: ${titles}`);
      }
    }
  });

  it("name lookup uses the full path", () => {
    expect(
      getByName("rule", "Playing the Game › D20 Tests › Saving Throws")?.id,
    ).toBe("playing-the-game.d20-tests.saving-throws");
    // Bare headings repeat; only the full path is a name.
    expect(getByName("rule", "Ability Checks")).toBeUndefined();
  });
});

function getCompact(id: string): string {
  const text = compact("rule", id);
  if (text === undefined) throw new Error(`no compact form for ${id}`);
  return text;
}
