import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  AGENCY_RULE,
  type AgencyNode,
  agencyRule,
  DOCTRINE,
  DOCTRINE_NOTICE,
} from "../../src/dm/doctrine/doctrine.js";

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
    const dirs = [join(SRC, "prompts"), join(SRC, "..", "playtest", "auditor")];
    for (const dir of dirs) {
      if (!existsSync(dir)) continue; // vacuous until the directory exists
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

describe("agency rule (spec 074)", () => {
  const nodes: AgencyNode[] = [
    "director",
    "interpret",
    "narrate",
    "audit",
    "auditor",
  ];
  it("agencyRule(node) holds every shared line and its own node line", () => {
    const seen = new Set<string>();
    for (const node of nodes) {
      const text = agencyRule(node);
      for (const line of AGENCY_RULE) expect(text).toContain(line);
      const nodeLine = text.split("\n").slice(AGENCY_RULE.length);
      expect(nodeLine).toHaveLength(1);
      seen.add(nodeLine[0] ?? "");
    }
    expect(seen.size).toBe(nodes.length);
  });
  it("the reflex line allows a flinch on a miss and bars a timed twist", () => {
    const text = AGENCY_RULE.join("\n");
    expect(text).toContain("a flinch on a foe's miss");
    expect(text).toContain("a startle when surprised as a fight starts");
    expect(text).toContain("a twist that times the blow");
  });
  it("hero-is-theirs blocks decisions, not reflexes", () => {
    const p = DOCTRINE.find((d) => d.id === "hero-is-theirs");
    expect(p?.rule).toBe(
      "Never decide the hero's words, choices or chosen feelings; the dice may decide a reflex.",
    );
    expect(p?.right).toBe(
      '"The club catches you square; you stagger back a step."',
    );
  });
});
