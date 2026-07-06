import { describe, expect, it } from "vitest";

import { deriveVectorId, SKELETON_CHECK_INPUT_TEXT } from "../src/skeleton-check";

describe("deriveVectorId", () => {
  const base = {
    inputText: SKELETON_CHECK_INPUT_TEXT,
    provider: "local-sidecar",
    model: "sentence-transformers/all-MiniLM-L6-v2",
    dimensions: 384,
  };

  it("is deterministic — identical input yields the identical id", () => {
    expect(deriveVectorId(base)).toBe(deriveVectorId({ ...base }));
  });

  it("is stable across repeated calls", () => {
    const ids = Array.from({ length: 5 }, () => deriveVectorId(base));
    expect(new Set(ids).size).toBe(1);
  });

  it("changes when the input text changes", () => {
    const id1 = deriveVectorId(base);
    const id2 = deriveVectorId({ ...base, inputText: "different text" });
    expect(id1).not.toBe(id2);
  });

  it("changes when the provider changes", () => {
    const id1 = deriveVectorId(base);
    const id2 = deriveVectorId({ ...base, provider: "other-provider" });
    expect(id1).not.toBe(id2);
  });

  it("changes when the model changes", () => {
    const id1 = deriveVectorId(base);
    const id2 = deriveVectorId({ ...base, model: "other/model" });
    expect(id1).not.toBe(id2);
  });

  it("changes when dimensions change", () => {
    const id1 = deriveVectorId(base);
    const id2 = deriveVectorId({ ...base, dimensions: 768 });
    expect(id1).not.toBe(id2);
  });

  it("produces a sha256 hex digest", () => {
    expect(deriveVectorId(base)).toMatch(/^[0-9a-f]{64}$/);
  });
});
