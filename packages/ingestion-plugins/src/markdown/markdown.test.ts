/**
 * T043 (TDD): the markdown/plain-text fallback plugin (US4, FR-028) — the
 * shared conformance suite plus heading-path assertions. Accepts both
 * text/markdown and text/plain at the same 0.1 fallback floor (research
 * decision mirrored from contracts/plugin-contract.md's fallback-floor rule):
 * there is nothing more specific to lose a tie-break against for these types
 * in this cycle, but the floor keeps the registry's "everyone declares a
 * confidence" contract uniform.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describeConformance } from "@stacks/ingestion-contract/conformance";
import { describe, expect, it } from "vitest";

import { markdownPlugin } from "./index";

const FIXTURES = join(__dirname, "..", "..", "fixtures");
const fixture = (rel: string) => new Uint8Array(readFileSync(join(FIXTURES, rel)));

const NOTES = fixture("markdown/notes.md");
const PLAIN = fixture("markdown/plain.txt");
const BLANK = fixture("markdown/blank.md");
const NON_MARKDOWN = fixture("html/plain-article.html");

describeConformance({
  plugin: markdownPlugin,
  fixtures: {
    positive: [
      { name: "nested-heading markdown", mediaType: "text/markdown", filename: "notes.md", bytes: NOTES, minConfidence: 0.1 },
      { name: "headingless plain text", mediaType: "text/plain", filename: "plain.txt", bytes: PLAIN, minConfidence: 0.1 },
    ],
    negative: [
      { name: "an HTML file (wrong media type)", mediaType: "text/html", filename: "plain-article.html", bytes: NON_MARKDOWN },
    ],
    malformed: [
      { name: "blank/whitespace-only markdown", mediaType: "text/markdown", filename: "blank.md", bytes: BLANK },
    ],
  },
});

describe("markdown specifics (US4 AC-1)", () => {
  const transform = (bytes: Uint8Array, filename: string, mediaType = "text/markdown") =>
    markdownPlugin.transform({ mediaType, filename, bytes });

  it("preserves the heading trail as section paths (US4 AC-1)", async () => {
    const doc = await transform(NOTES, "notes.md");
    const methodology = doc.sections.find((s) => s.heading === "Methodology");
    expect(methodology?.path).toEqual(["Field Notes on Synthetic Fauna", "The Gremlin Census", "Methodology"]);
  });

  it("uses the top-level H1 as the document title", async () => {
    const doc = await transform(NOTES, "notes.md");
    expect(doc.title).toBe("Field Notes on Synthetic Fauna");
  });

  it("treats headingless plain text as one prose section (FR-012 honesty: no guessed structure)", async () => {
    const doc = await transform(PLAIN, "plain.txt", "text/plain");
    expect(doc.sections).toHaveLength(1);
    expect(doc.sections[0]!.kind).toBe("prose");
    expect(doc.sections[0]!.content).toContain("bottle caps");
  });

  it("every section anchors into a persisted artifact (contract invariant 3)", async () => {
    const doc = await transform(NOTES, "notes.md");
    for (const section of doc.sections) {
      const artifact = doc.artifacts.find((a) => a.id === section.anchor.artifactId);
      expect(artifact, section.heading).toBeDefined();
    }
  });
});
