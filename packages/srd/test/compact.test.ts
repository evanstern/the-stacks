import { describe, expect, it } from "vitest";
import { toCompact } from "../src/compact.js";
import { getById, list } from "../src/index.js";
import { estimateTokens } from "../src/tokens.js";
import { KINDS } from "./helpers.js";

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
