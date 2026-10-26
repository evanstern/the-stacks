import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DOCTRINE, DOCTRINE_NOTICE } from "../../src/dm/doctrine/doctrine.js";

const SRC = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "src",
  "dm",
);
const NOTICE_SENTENCE =
  "DM-craft doctrine adapted from tabletop-dm (https://github.com/bradbushSFAI/tabletop-dm, " +
  "commit fe2c29b), Copyright (c) 2026 Brad Bush, used under the MIT License. " +
  "See apps/server/src/dm/doctrine/NOTICE.md.";

describe("doctrine attribution (AC #14)", () => {
  it("rule 1: NOTICE.md carries the notice and the full MIT text", () => {
    const path = join(SRC, "doctrine", "NOTICE.md");
    expect(existsSync(path)).toBe(true);
    const text = readFileSync(path, "utf8");
    expect(text).toContain("tabletop-dm");
    expect(text).toContain("fe2c29b");
    expect(text).toContain(NOTICE_SENTENCE);
    expect(text).toContain("Copyright (c) 2026 Brad Bush");
    expect(text).toContain("Permission is hereby granted, free of charge");
    expect(text).toContain(
      'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND',
    );
  });

  it("rule 2: doctrine.ts exports the notice and repeats it in its header", () => {
    expect(DOCTRINE_NOTICE).toBe(NOTICE_SENTENCE);
    const source = readFileSync(join(SRC, "doctrine", "doctrine.ts"), "utf8");
    const header = source.slice(
      0,
      source.indexOf("export const DOCTRINE_NOTICE"),
    );
    expect(header).toContain(NOTICE_SENTENCE);
  });

  it("rule 3: every prompt module importing doctrine holds the notice in its header", () => {
    const dir = join(SRC, "prompts");
    if (!existsSync(dir)) return; // vacuous until Phase 3 adds dm/prompts/
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
      const source = readFileSync(join(dir, file), "utf8");
      if (!/doctrine\/doctrine(\.js)?["']/.test(source)) continue;
      const firstImport = source.search(/^import /m);
      const header = source.slice(
        0,
        firstImport === -1 ? source.length : firstImport,
      );
      expect(header, file).toContain(NOTICE_SENTENCE);
    }
  });

  it("rule 4: the Dockerfile ships NOTICE.md beside dist/dm/doctrine and the seeds", () => {
    const dockerfile = readFileSync(
      join(SRC, "..", "..", "..", "..", "Dockerfile"),
      "utf8",
    );
    expect(dockerfile).toContain("src/dm/doctrine/NOTICE.md");
    expect(dockerfile).toContain("apps/server/dist/dm/doctrine/NOTICE.md");
    expect(dockerfile).toContain("apps/server/seeds");
  });

  it("holds the 24 pairs with unique ids and valid node mappings", () => {
    expect(DOCTRINE).toHaveLength(24);
    expect(new Set(DOCTRINE.map((p) => p.id)).size).toBe(24);
    for (const p of DOCTRINE) {
      expect(p.nodes.length).toBeGreaterThan(0);
      expect(p.rule.length).toBeGreaterThan(0);
    }
  });
});
