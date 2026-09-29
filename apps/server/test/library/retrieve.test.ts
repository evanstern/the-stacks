import { describe, expect, it } from "vitest";
import { fuseRrf, loadRetrievalConfig } from "../../src/library/retrieve.js";

/**
 * Phase 1 unit tests (specs/015-hybrid-retrieval/tasks.md T004, contracts/
 * retrieval.md invariant 2, 9): config parsing and RRF fusion, no database.
 */

function env(vars: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { ...vars } as NodeJS.ProcessEnv;
}

describe("loadRetrievalConfig", () => {
  it("defaults to hybrid mode, k = 8, embedPurpose = embedding on an empty env", () => {
    expect(loadRetrievalConfig(env())).toEqual({
      mode: "hybrid",
      k: 8,
      embedPurpose: "embedding",
    });
  });

  it("rejects an unknown RETRIEVAL_MODE, naming the variable", () => {
    expect(() => loadRetrievalConfig(env({ RETRIEVAL_MODE: "bogus" }))).toThrow(
      /RETRIEVAL_MODE/,
    );
  });

  it.each(["0", "51", "abc"])(
    "rejects RETRIEVAL_K=%s, naming the variable",
    (value) => {
      expect(() => loadRetrievalConfig(env({ RETRIEVAL_K: value }))).toThrow(
        /RETRIEVAL_K/,
      );
    },
  );

  it("rejects an empty RETRIEVAL_EMBED_PURPOSE, naming the variable", () => {
    expect(() =>
      loadRetrievalConfig(env({ RETRIEVAL_EMBED_PURPOSE: "" })),
    ).toThrow(/RETRIEVAL_EMBED_PURPOSE/);
  });
});

describe("fuseRrf", () => {
  it("matches hand-computed RRF scores (SC-004)", () => {
    const result = fuseRrf({ vector: ["a", "b"], fts: ["b", "c"] }, 60);
    expect(result).toEqual([
      { chunkId: "b", score: 1 / 62 + 1 / 61 },
      { chunkId: "a", score: 1 / 61 },
      { chunkId: "c", score: 1 / 62 },
    ]);
  });

  it("dedupes a chunk found by both lists into one entry", () => {
    const result = fuseRrf({ vector: ["a"], fts: ["a"] });
    expect(result).toHaveLength(1);
    expect(result[0]?.chunkId).toBe("a");
  });

  it("keeps a chunk found by only one list", () => {
    const result = fuseRrf({ vector: ["a"], fts: [] });
    expect(result).toEqual([{ chunkId: "a", score: 1 / 61 }]);
  });

  it("breaks equal scores by chunk id ascending", () => {
    const result = fuseRrf({ vector: ["z", "a"], fts: [] });
    // "z" ranks 1 (higher score) than "a" at rank 2, so this isn't a tie —
    // force one by putting each id alone in its own list at the same rank.
    const tied = fuseRrf({ vector: ["z"], fts: ["a"] });
    expect(tied.map((r) => r.chunkId)).toEqual(["a", "z"]);
    expect(result[0]?.chunkId).toBe("z");
  });

  it("returns identical output on a second call with the same inputs (SC-005)", () => {
    const lists = { vector: ["c", "a", "b"], fts: ["b", "a"] };
    expect(fuseRrf(lists)).toEqual(fuseRrf(lists));
  });
});
