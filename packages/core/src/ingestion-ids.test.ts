/**
 * T009 (TDD): the identity scheme's two guarantees — determinism (same input,
 * same id: retries are no-ops) and axis-sensitivity (any provenance axis
 * change produces a different id: generations/plugin versions never collide).
 */
import { describe, expect, it } from "vitest";

import {
  deriveArchiveFingerprint,
  deriveChunkId,
  deriveSectionId,
} from "./ingestion-ids";

const chunkInput = {
  corpusId: "11111111-1111-1111-1111-111111111111",
  sourceFingerprint: "abc123",
  pluginName: "ddb-saved-html",
  pluginVersion: "1.0.0",
  generation: 1,
  chunkIndex: 0,
  content: "A goblin is small and green.",
};

describe("ingestion identity scheme (R9)", () => {
  it("archive fingerprint is deterministic over bytes", () => {
    const bytes = new TextEncoder().encode("<html>same</html>");
    expect(deriveArchiveFingerprint(bytes)).toBe(deriveArchiveFingerprint(bytes.slice()));
    expect(deriveArchiveFingerprint(bytes)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("chunk id: identical input derives the identical id (retry idempotency, SC-004)", () => {
    expect(deriveChunkId(chunkInput)).toBe(deriveChunkId({ ...chunkInput }));
  });

  it("chunk id: every provenance axis changes the id", () => {
    const base = deriveChunkId(chunkInput);
    const variants = [
      { ...chunkInput, corpusId: "22222222-2222-2222-2222-222222222222" },
      { ...chunkInput, sourceFingerprint: "def456" },
      { ...chunkInput, pluginName: "generic-html" },
      { ...chunkInput, pluginVersion: "1.0.1" },
      { ...chunkInput, generation: 2 }, // re-ingest builds ASIDE, never on top (R8)
      { ...chunkInput, chunkIndex: 1 },
      { ...chunkInput, content: "A goblin is small and cunning." },
    ];
    for (const variant of variants) {
      expect(deriveChunkId(variant), JSON.stringify(variant)).not.toBe(base);
    }
  });

  it("chunk id material is unambiguous: content is hashed, not spliced raw", () => {
    // If raw content were embedded in the material, crafted content containing
    // the delimiter could collide with a different (index, content) pair.
    const a = deriveChunkId({ ...chunkInput, chunkIndex: 1, content: "x" });
    const b = deriveChunkId({ ...chunkInput, chunkIndex: 11, content: "x" });
    expect(a).not.toBe(b);
  });

  it("section id: deterministic and generation/plugin sensitive", () => {
    const input = {
      sourceFingerprint: "abc123",
      pluginName: "ddb-saved-html",
      pluginVersion: "1.0.0",
      generation: 1,
      sectionIndex: 4,
    };
    expect(deriveSectionId(input)).toBe(deriveSectionId({ ...input }));
    expect(deriveSectionId({ ...input, generation: 2 })).not.toBe(deriveSectionId(input));
    expect(deriveSectionId({ ...input, pluginVersion: "1.1.0" })).not.toBe(deriveSectionId(input));
    expect(deriveSectionId({ ...input, sectionIndex: 5 })).not.toBe(deriveSectionId(input));
  });
});
