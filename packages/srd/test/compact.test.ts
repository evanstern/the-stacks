import { describe, expect, it } from "vitest";
import { toCompact } from "../src/compact.js";
import { compact, getById, list } from "../src/index.js";
import { estimateTokens } from "../src/tokens.js";
import { KINDS, ruleFixture } from "./helpers.js";

const CEILING = 120;

describe.each(KINDS)("%s compact forms", (kind) => {
  const records = list(kind) as readonly {
    id: string;
    name: string;
    source: { page: number };
  }[];

  it("every form is at most 120 estimated tokens", () => {
    const sizes = records.map((r) => ({
      id: r.id,
      size: estimateTokens(toCompact(kind, r as never)),
    }));
    for (const s of sizes) {
      expect(s.size, `${kind}/${s.id}`).toBeLessThanOrEqual(CEILING);
    }
    const sorted = sizes.map((s) => s.size).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const max = sorted[sorted.length - 1];
    console.log(
      `compact ${kind}: n=${sorted.length} median=${median} max=${max}`,
    );
  });

  it("starts with the ref header and ends with the source footer", () => {
    for (const r of records) {
      const text = toCompact(kind, r as never);
      expect(text.startsWith(`${r.name} [${kind}/${r.id}]`), r.id).toBe(true);
      expect(text.endsWith(`SRD 5.2.1 p.${r.source.page}`), r.id).toBe(true);
    }
  });

  it("is deterministic", () => {
    for (const r of records) {
      expect(toCompact(kind, r as never)).toBe(toCompact(kind, r as never));
    }
  });

  it("truncated forms end the body with +<n> more before the footer", () => {
    for (const r of records) {
      const lines = toCompact(kind, r as never).split("\n");
      const body = lines.slice(0, -1);
      const tail = body[body.length - 1] as string;
      if (/^\+\d+ more$/.test(tail)) {
        expect(Number(tail.slice(1, tail.indexOf(" ")))).toBeGreaterThan(0);
      } else {
        expect(tail, r.id).not.toMatch(/\+\d+ more/);
      }
    }
  });
});

describe("snapshots", () => {
  const cases = [
    ["monster", "goblin-warrior"],
    ["spell", "fire-bolt"],
    ["class", "fighter"],
    ["equipment", "longsword"],
    ["condition", "prone"],
  ] as const;
  it.each(cases)("%s %s", (kind, id) => {
    const record = getById(kind, id);
    expect(record).toBeDefined();
    expect(toCompact(kind, record as never)).toMatchSnapshot();
  });

  it("a large stat block stays within the ceiling", () => {
    const dragon = getById("monster", "adult-red-dragon");
    const text = toCompact("monster", dragon as never);
    expect(estimateTokens(text)).toBeLessThanOrEqual(CEILING);
  });
});

describe("rule compact form (fixture records)", () => {
  const dcRows = [
    ["Very easy", "5"],
    ["Easy", "10"],
    ["Medium", "15"],
    ["Hard", "20"],
    ["Very hard", "25"],
    ["Nearly impossible", "30"],
  ];

  it("renders all six DC rows unbroken under the ceiling", () => {
    const record = ruleFixture({
      id: "playing-the-game.typical-dcs",
      title: "Typical DCs",
      blocks: [
        {
          type: "table",
          title: "Typical Difficulty Classes",
          columns: ["Task", "DC"],
          rows: dcRows,
        },
      ],
    });
    const text = toCompact("rule", record as never);
    expect(estimateTokens(text)).toBeLessThanOrEqual(CEILING);
    expect(
      text.startsWith("Typical DCs [rule/playing-the-game.typical-dcs]"),
    ).toBe(true);
    expect(text).toContain("Typical Difficulty Classes: Very easy | 5");
    for (const [task, dc] of dcRows) {
      expect(text).toContain(`${task} | ${dc}`);
    }
    expect(text).not.toMatch(/\+\d+ more/);
    expect(text.endsWith("SRD 5.2.1 p.7")).toBe(true);
  });

  it("truncates a long record by whole units with +N more", () => {
    const sentence =
      "This fixture sentence is deliberately long enough to cost tokens.";
    const record = ruleFixture({
      blocks: [{ type: "text", text: Array(40).fill(sentence).join(" ") }],
    });
    const text = toCompact("rule", record as never);
    expect(estimateTokens(text)).toBeLessThanOrEqual(CEILING);
    const lines = text.split("\n");
    expect(lines[lines.length - 2]).toMatch(/^\+\d+ more$/);
    expect(lines[lines.length - 1]).toBe("SRD 5.2.1 p.7");
    const body = lines.slice(1, -2).join(" ");
    expect(body.endsWith(".")).toBe(true);
  });

  it("lists children after the body", () => {
    const record = ruleFixture({
      children: [
        "playing-the-game.fixture.alpha",
        "playing-the-game.fixture.beta",
      ],
    });
    expect(toCompact("rule", record as never)).toContain("See: alpha, beta");
  });

  it("names children by title when the caller supplies a lookup", () => {
    const record = ruleFixture({
      children: [
        "playing-the-game.fixture.alpha",
        "playing-the-game.fixture.beta",
      ],
    });
    const titles: Record<string, string> = {
      "playing-the-game.fixture.alpha": "Alpha Heading",
      "playing-the-game.fixture.beta": "Beta’s Heading",
    };
    const text = toCompact("rule", record as never, {
      ruleTitle: (id) => titles[id],
    });
    expect(text).toContain("See: Alpha Heading, Beta’s Heading");
  });
});

describe("rule compact snapshots (shipped records)", () => {
  it.each([
    "playing-the-game.d20-tests.ability-checks.difficulty-class",
    "playing-the-game.the-six-abilities.ability-modifiers",
    "playing-the-game.combat",
    "rules-glossary.help-action",
  ])("%s", (id) => {
    expect(compact("rule", id)).toMatchSnapshot();
  });
});
