/**
 * T015 (TDD): the ddb-saved-html plugin against the synthetic fixtures —
 * the shared conformance suite plus the DDB-specific assertions that pin the
 * ported v2 rules (specs/008-ingestion-service/ddb-rules.md): detection
 * signals, boilerplate removal, kind classification (v3's addition), anchor
 * stamping, and the book-title path root.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { DETECT_HEAD_BYTES, artifactTextContent } from "@stacks/ingestion-contract";
import { describeConformance } from "@stacks/ingestion-contract/conformance";
import { describe, expect, it } from "vitest";

import { ddbSavedHtmlPlugin } from "./index";

const FIXTURES = join(__dirname, "..", "..", "fixtures");
const fixture = (rel: string) => new Uint8Array(readFileSync(join(FIXTURES, rel)));

const GOBLIN = fixture("ddb/goblin-page.html");
const SPELL = fixture("ddb/glimmerburst-spell.html");
const TABLE = fixture("ddb/trinket-table.html");

/**
 * Real saved DDB pages have the geometry the small fixtures above do not:
 * the browser inlines every stylesheet and script into <head>, pushing
 * <body> (and the article) far past DETECT_HEAD_BYTES. Observed live on a
 * real Monster Manual listing page — <body> at byte ~135k of 733k — where
 * detect() returned 0 despite the identity signals (saved-from stamp,
 * canonical, og:url) all sitting inside the first 64 KiB (TASK-10).
 * Synthesized here from the goblin fixture so no real DDB content is
 * committed (constitution Principle I).
 */
const LARGE_PREAMBLE = (() => {
  const html = new TextDecoder().decode(GOBLIN);
  const filler = `<style>/* ${"padding ".repeat(2 * DETECT_HEAD_BYTES / 8)} */</style>`;
  return new TextEncoder().encode(html.replace("</head>", `${filler}</head>`));
})();

describeConformance({
  plugin: ddbSavedHtmlPlugin,
  fixtures: {
    positive: [
      { name: "stat-block page (saved-from + canonical)", mediaType: "text/html", filename: "goblin-page.html", bytes: GOBLIN },
      { name: "spell page (og:url only)", mediaType: "text/html", filename: "glimmerburst-spell.html", bytes: SPELL },
      { name: "table page (saved-from only)", mediaType: "text/html", filename: "trinket-table.html", bytes: TABLE },
      { name: "real-geometry page (body past DETECT_HEAD_BYTES)", mediaType: "text/html", filename: "monsters-g.html", bytes: LARGE_PREAMBLE, minConfidence: 0.9 },
    ],
    negative: [
      {
        name: "plain HTML article without DDB signals",
        mediaType: "text/html",
        filename: "plain-article.html",
        bytes: fixture("html/plain-article.html"),
      },
    ],
    malformed: [
      {
        name: "truncated garbage",
        mediaType: "text/html",
        filename: "truncated.html",
        bytes: fixture("rejects/truncated.html"),
      },
    ],
  },
});

describe("ddb-saved-html specifics (ddb-rules.md)", () => {
  const transform = (bytes: Uint8Array, filename: string) =>
    ddbSavedHtmlPlugin.transform({ mediaType: "text/html", filename, bytes });

  it("detects on identity signals alone when the article sits past the detect prefix (TASK-10)", () => {
    const result = ddbSavedHtmlPlugin.detect({
      mediaType: "text/html",
      filename: "monsters-g.html",
      head: LARGE_PREAMBLE.slice(0, DETECT_HEAD_BYTES),
    });
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("classifies the stat block section as stat_block (§7)", async () => {
    const doc = await transform(GOBLIN, "goblin-page.html");
    const statSection = doc.sections.find((s) => s.heading === "Stat Block");
    expect(statSection?.kind).toBe("stat_block");
  });

  it("classifies the table-dominant section as table (§7)", async () => {
    const doc = await transform(TABLE, "trinket-table.html");
    const tableSection = doc.sections.find((s) => s.heading === "Oddity Table");
    expect(tableSection?.kind).toBe("table");
  });

  it("classifies the spell-attribute section as spell_entry (§7)", async () => {
    const doc = await transform(SPELL, "glimmerburst-spell.html");
    const spellSection = doc.sections.find((s) => s.heading === "Spell Details");
    expect(spellSection?.kind).toBe("spell_entry");
  });

  it("strips boilerplate and scripts from every artifact (§3/§4)", async () => {
    const doc = await transform(GOBLIN, "goblin-page.html");
    for (const artifact of doc.artifacts) {
      expect(artifact.content).not.toContain("Site chrome");
      expect(artifact.content).not.toContain("__tracker");
      expect(artifact.content).not.toContain("<script");
    }
  });

  it("uses the article h1 as the document title (§5)", async () => {
    const doc = await transform(GOBLIN, "goblin-page.html");
    expect(doc.title).toBe("Grumble the Gremlin");
  });

  it("roots every section path at the book title when one exists (§5)", async () => {
    const doc = await transform(GOBLIN, "goblin-page.html");
    for (const section of doc.sections) {
      expect(section.path[0]).toBe("Synthetic Bestiary");
    }
  });

  it("builds the heading-stack path for nested sections (§6)", async () => {
    const doc = await transform(GOBLIN, "goblin-page.html");
    const lair = doc.sections.find((s) => s.heading === "Grumble's Lair");
    expect(lair?.path).toEqual(["Synthetic Bestiary", "Grumble the Gremlin", "Grumble's Lair"]);
  });

  it("stamps data-stacks-anchor on each section's fragment and anchors within bounds (§6)", async () => {
    const doc = await transform(GOBLIN, "goblin-page.html");
    expect(doc.sections.length).toBeGreaterThan(0);
    for (const section of doc.sections) {
      const artifact = doc.artifacts.find((a) => a.id === section.anchor.artifactId);
      expect(artifact, section.heading).toBeDefined();
      expect(artifact!.content).toContain(`data-stacks-anchor="${section.anchor.elementId}"`);
      expect(section.anchor.charEnd).toBeLessThanOrEqual(artifactTextContent(artifact!).length);
    }
  });

  it("preserves DDB's own data-content-chunk-id markers in fragments (§6)", async () => {
    const doc = await transform(GOBLIN, "goblin-page.html");
    const lair = doc.sections.find((s) => s.heading === "Grumble's Lair");
    const artifact = doc.artifacts.find((a) => a.id === lair!.anchor.artifactId);
    expect(artifact!.content).toContain('data-content-chunk-id="lair-1"');
  });

  it("skips headings with empty bodies rather than emitting empty sections (§6)", async () => {
    const doc = await transform(GOBLIN, "goblin-page.html");
    for (const section of doc.sections) {
      expect(section.content.trim().length).toBeGreaterThan(0);
    }
  });
});
