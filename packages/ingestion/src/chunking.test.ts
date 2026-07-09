/**
 * T016 (TDD): the chunking policy's contract (R4, FR-019, SC-009) — written
 * before chunking.ts. The one non-negotiable: ATOMIC sections (stat_block,
 * table, spell_entry) are never split, whatever the budgets say.
 */
import type { NormalizedDocument, Section, SectionKind } from "@stacks/ingestion-contract";
import { NORMALIZED_DOCUMENT_VERSION } from "@stacks/ingestion-contract";
import { describe, expect, it } from "vitest";

import { chunkDocument, type ChunkingParams } from "./chunking";

const PARAMS: ChunkingParams = { targetChars: 200, overlapChars: 40, maxChars: 300 };

function section(index: number, kind: SectionKind, content: string): Section {
  return {
    index,
    path: ["Doc"],
    kind,
    content,
    anchor: { artifactId: "a1", charStart: 0, charEnd: 1 },
  };
}

function doc(sections: Section[]): NormalizedDocument {
  return {
    contractVersion: NORMALIZED_DOCUMENT_VERSION,
    title: "Doc",
    sections,
    artifacts: [{ id: "a1", kind: "html", content: "<div>x</div>" }],
    warnings: [],
  };
}

describe("chunkDocument (structure-aware packing, R4)", () => {
  it("packs small adjacent sections into one chunk up to the target budget", () => {
    const chunks = chunkDocument(doc([
      section(0, "prose", "First short paragraph."),
      section(1, "prose", "Second short paragraph."),
    ]), PARAMS);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.sectionIndexes).toEqual([0, 1]);
    expect(chunks[0]!.content).toContain("First short paragraph.");
    expect(chunks[0]!.content).toContain("Second short paragraph.");
  });

  it("starts a new chunk when the budget would overflow", () => {
    const chunks = chunkDocument(doc([
      section(0, "prose", "a".repeat(150)),
      section(1, "prose", "b".repeat(150)),
    ]), PARAMS);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.sectionIndexes).toEqual([0]);
    expect(chunks[1]!.sectionIndexes).toEqual([1]);
  });

  it("NEVER splits an atomic section, even one over maxChars — it becomes one oversized chunk (SC-009)", () => {
    const big = "STAT ".repeat(120); // 600 chars > maxChars 300
    const chunks = chunkDocument(doc([
      section(0, "prose", "Intro."),
      section(1, "stat_block", big),
      section(2, "prose", "Outro."),
    ]), PARAMS);

    const statChunks = chunks.filter((c) => c.sectionIndexes.includes(1));
    expect(statChunks).toHaveLength(1);
    expect(statChunks[0]!.sectionIndexes).toEqual([1]); // alone in its chunk
    expect(statChunks[0]!.oversized).toBe(true);
    expect(statChunks[0]!.content.trim()).toBe(big.trim());
  });

  it("an atomic section within budget may share a chunk with neighbors", () => {
    const chunks = chunkDocument(doc([
      section(0, "prose", "Before."),
      section(1, "table", "| a | b |"),
      section(2, "prose", "After."),
    ]), PARAMS);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.oversized).toBe(false);
  });

  it("splits an oversized PROSE section at paragraph boundaries with overlap", () => {
    const paragraphs = Array.from({ length: 6 }, (_, i) => `Paragraph ${i} ` + "word ".repeat(30)).join("\n\n");
    const chunks = chunkDocument(doc([section(0, "prose", paragraphs)]), PARAMS);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(PARAMS.maxChars);
      expect(chunk.sectionIndexes).toEqual([0]);
      expect(chunk.oversized).toBe(false);
    }
    // Overlap: each successor repeats the tail of its predecessor.
    for (let i = 1; i < chunks.length; i++) {
      const tail = chunks[i - 1]!.content.slice(-PARAMS.overlapChars);
      expect(chunks[i]!.content.startsWith(tail.slice(0, 10))).toBe(true);
    }
  });

  it("honors preferBreakBefore hints as chunk boundaries", () => {
    const chunks = chunkDocument(
      doc([
        section(0, "prose", "One."),
        section(1, "prose", "Two."),
        section(2, "prose", "Three."),
      ]),
      PARAMS,
      { preferBreakBefore: [2] },
    );

    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.sectionIndexes).toEqual([0, 1]);
    expect(chunks[1]!.sectionIndexes).toEqual([2]);
  });

  it("honors keepTogether hints when the group fits within maxChars", () => {
    const chunks = chunkDocument(
      doc([
        section(0, "prose", "x".repeat(150)),
        section(1, "prose", "y".repeat(100)),
      ]),
      PARAMS,
      { keepTogether: [[0, 1]] },
    );

    // 250 chars > target 200 but <= max 300: the hint wins over the target.
    expect(chunks).toHaveLength(1);
  });

  it("assigns sequential chunkIndex values and anchors each chunk to its first section", () => {
    const chunks = chunkDocument(doc([
      section(0, "prose", "a".repeat(150)),
      section(1, "prose", "b".repeat(150)),
    ]), PARAMS);

    expect(chunks.map((c) => c.chunkIndex)).toEqual([0, 1]);
    expect(chunks[0]!.anchorSectionIndex).toBe(0);
    expect(chunks[1]!.anchorSectionIndex).toBe(1);
  });

  it("returns no chunks for an empty document (the honest `empty` outcome)", () => {
    expect(chunkDocument(doc([]), PARAMS)).toEqual([]);
  });
});
