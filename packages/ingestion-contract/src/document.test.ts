/**
 * Invariant tests for the NormalizedDocument v1 validator (T006, written
 * before the implementation per the constitution's TDD posture). One test per
 * invariant from contracts/normalized-document.md — the validator is the
 * conformance suite's core assertion, so its own behavior gets pinned first.
 */
import { describe, expect, it } from "vitest";

import type { DisplayArtifact, NormalizedDocument, Section } from "./document";
import {
  NORMALIZED_DOCUMENT_VERSION,
  artifactTextContent,
  validateNormalizedDocument,
} from "./document";

// Factory for a minimal VALID document; each test breaks exactly one thing.
function validDoc(): NormalizedDocument {
  const artifact: DisplayArtifact = {
    id: "a1",
    kind: "html",
    content: '<div data-stacks-anchor="s0"><h1>Goblin Notes</h1><p>Small and green.</p></div>',
  };
  const text = artifactTextContent(artifact);
  const section: Section = {
    index: 0,
    path: ["Goblin Notes"],
    kind: "prose",
    heading: "Goblin Notes",
    content: "Small and green.",
    anchor: { artifactId: "a1", elementId: "s0", charStart: 0, charEnd: text.length },
  };
  return {
    contractVersion: NORMALIZED_DOCUMENT_VERSION,
    title: "Goblin Notes",
    sections: [section],
    artifacts: [artifact],
    warnings: [],
  };
}

describe("validateNormalizedDocument", () => {
  it("accepts a minimal valid document", () => {
    expect(validateNormalizedDocument(validDoc())).toEqual([]);
  });

  it("rejects a stale contractVersion", () => {
    const doc = { ...validDoc(), contractVersion: "0.9.0" };
    expect(validateNormalizedDocument(doc).join()).toMatch(/contractVersion/);
  });

  it("rejects an empty title", () => {
    const doc = { ...validDoc(), title: "   " };
    expect(validateNormalizedDocument(doc).join()).toMatch(/title/);
  });

  it("invariant 1: rejects non-contiguous section indexes", () => {
    const doc = validDoc();
    doc.sections[0]!.index = 3;
    expect(validateNormalizedDocument(doc).join()).toMatch(/invariant 1/);
  });

  it("invariant 2: rejects whitespace-only section content", () => {
    const doc = validDoc();
    doc.sections[0]!.content = "  \n ";
    expect(validateNormalizedDocument(doc).join()).toMatch(/invariant 2/);
  });

  it("invariant 3: rejects an anchor pointing at no artifact", () => {
    const doc = validDoc();
    doc.sections[0]!.anchor.artifactId = "ghost";
    expect(validateNormalizedDocument(doc).join()).toMatch(/invariant 3/);
  });

  it("invariant 4: rejects a char range past the artifact's text content", () => {
    const doc = validDoc();
    doc.sections[0]!.anchor.charEnd = 10_000;
    expect(validateNormalizedDocument(doc).join()).toMatch(/invariant 4/);
  });

  it("invariant 4: rejects an inverted char range", () => {
    const doc = validDoc();
    doc.sections[0]!.anchor.charStart = 5;
    doc.sections[0]!.anchor.charEnd = 2;
    expect(validateNormalizedDocument(doc).join()).toMatch(/invariant 4/);
  });

  it("invariant 5: rejects script elements, event handlers, javascript: URLs, and external src", () => {
    for (const bad of [
      "<script>alert(1)</script>",
      '<img onerror="x()">',
      '<a href="javascript:void(0)">x</a>',
      '<img src="https://evil.example/x.png">',
    ]) {
      const doc = validDoc();
      doc.artifacts[0]!.content += bad;
      // widen the section's range guard: keep anchor valid so ONLY invariant 5 fires
      doc.sections[0]!.anchor.charEnd = 1;
      expect(validateNormalizedDocument(doc).join()).toMatch(/invariant 5/);
    }
  });

  it("invariant 5: allows plain navigation links (not a resource load)", () => {
    const doc = validDoc();
    doc.artifacts[0]!.content += '<a href="https://example.com/ref">see also</a>';
    doc.sections[0]!.anchor.charEnd = 1;
    expect(validateNormalizedDocument(doc)).toEqual([]);
  });

  it("invariant 6: an empty sections list is VALID (the pipeline records `empty`, not us)", () => {
    const doc = { ...validDoc(), sections: [] };
    expect(validateNormalizedDocument(doc)).toEqual([]);
  });

  it("invariant 7: rejects documents carrying non-JSON data", () => {
    const doc = validDoc();
    // a Date survives JSON.stringify as a string — the round-trip comparison catches it
    (doc as unknown as Record<string, unknown>).producedAt = new Date();
    expect(validateNormalizedDocument(doc).join()).toMatch(/invariant 7/);
  });

  it("rejects duplicate artifact ids", () => {
    const doc = validDoc();
    doc.artifacts.push({ ...doc.artifacts[0]! });
    expect(validateNormalizedDocument(doc).join()).toMatch(/duplicate artifact id/);
  });
});
