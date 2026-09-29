import { describe, expect, it } from "vitest";
import { isRelevant, loadAnswerConfig } from "../../src/library/answer.js";
import type { RetrievedPassage } from "../../src/library/retrieve.js";

/**
 * Phase 1 unit tests (specs/018-rules-answerer/tasks.md T005): config
 * parsing and the relevance rule (research R2), no database or gateway.
 */

function env(vars: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { ...vars } as NodeJS.ProcessEnv;
}

describe("loadAnswerConfig", () => {
  it("defaults minSimilarity to 0.3 on an empty env", () => {
    expect(loadAnswerConfig(env())).toEqual({ minSimilarity: 0.3 });
  });

  it.each(["-0.1", "1.1", "abc"])(
    "rejects ASK_MIN_SIMILARITY=%s, naming the variable",
    (value) => {
      expect(() =>
        loadAnswerConfig(env({ ASK_MIN_SIMILARITY: value })),
      ).toThrow(/ASK_MIN_SIMILARITY/);
    },
  );
});

function passage(overrides: Partial<RetrievedPassage> = {}): RetrievedPassage {
  return {
    chunkId: "chunk-1",
    documentId: "doc-1",
    kind: "prose",
    text: "some passage text",
    anchor: { book: "Basic Rules", path: [], start: 0, end: 18 },
    rank: 1,
    score: 0,
    vector: null,
    fts: null,
    ...overrides,
  };
}

describe("isRelevant", () => {
  it("is relevant when the keyword signal is present, regardless of vector", () => {
    expect(isRelevant(passage({ fts: { rank: 1, score: 0.01 } }), 0.3)).toBe(
      true,
    );
  });

  it("is relevant when the vector score is above the floor", () => {
    expect(isRelevant(passage({ vector: { rank: 1, score: 0.31 } }), 0.3)).toBe(
      true,
    );
  });

  it("is relevant when the vector score equals the floor", () => {
    expect(isRelevant(passage({ vector: { rank: 1, score: 0.3 } }), 0.3)).toBe(
      true,
    );
  });

  it("is not relevant when the vector score is below the floor", () => {
    expect(isRelevant(passage({ vector: { rank: 1, score: 0.29 } }), 0.3)).toBe(
      false,
    );
  });

  it("is not relevant when both signals are null", () => {
    expect(isRelevant(passage(), 0.3)).toBe(false);
  });
});
