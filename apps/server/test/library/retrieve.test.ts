import { describe, expect, it } from "vitest";
import { ValidationError } from "../../src/errors.js";
import type { RetrieveDeps } from "../../src/library/retrieve.js";
import {
  fuseRrf,
  loadRetrievalConfig,
  retrieve,
} from "../../src/library/retrieve.js";

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

/** A candidate at a given book/anchor start; book/start default to a shared value so callers
 * that only care about chunk id and rank (not the tie-break) don't need to repeat them. */
function cand(chunkId: string, book = "Book", start = 0) {
  return { chunkId, book, start };
}

describe("fuseRrf", () => {
  it("matches hand-computed RRF scores (SC-004)", () => {
    const result = fuseRrf(
      { vector: [cand("a"), cand("b")], fts: [cand("b"), cand("c")] },
      60,
    );
    expect(result).toEqual([
      { chunkId: "b", score: 1 / 62 + 1 / 61 },
      { chunkId: "a", score: 1 / 61 },
      { chunkId: "c", score: 1 / 62 },
    ]);
  });

  it("dedupes a chunk found by both lists into one entry", () => {
    const result = fuseRrf({ vector: [cand("a")], fts: [cand("a")] });
    expect(result).toHaveLength(1);
    expect(result[0]?.chunkId).toBe("a");
  });

  it("keeps a chunk found by only one list", () => {
    const result = fuseRrf({ vector: [cand("a")], fts: [] });
    expect(result).toEqual([{ chunkId: "a", score: 1 / 61 }]);
  });

  it("breaks equal scores by book, then anchor start, then chunk id (operator ruling 2026-09-29)", () => {
    const result = fuseRrf({ vector: [cand("z"), cand("a")], fts: [] });
    // "z" ranks 1 (higher score) than "a" at rank 2, so this isn't a tie —
    // force one by putting each id alone in its own list at the same rank.
    expect(result[0]?.chunkId).toBe("z");

    // Equal score, different book: book ascending wins, chunk id ignored.
    const byBook = fuseRrf({
      vector: [cand("z", "Zeta", 5)],
      fts: [cand("a", "Alpha", 100)],
    });
    expect(byBook.map((r) => r.chunkId)).toEqual(["a", "z"]);

    // Equal score, same book: anchor start ascending wins, chunk id ignored.
    const byStart = fuseRrf({
      vector: [cand("late", "Same", 50)],
      fts: [cand("early", "Same", 10)],
    });
    expect(byStart.map((r) => r.chunkId)).toEqual(["early", "late"]);

    // Equal score, same book and start (exact-duplicate anchor): chunk id is
    // the last-resort tiebreak.
    const byId = fuseRrf({
      vector: [cand("z", "Same", 10)],
      fts: [cand("a", "Same", 10)],
    });
    expect(byId.map((r) => r.chunkId)).toEqual(["a", "z"]);
  });

  it("returns identical output on a second call with the same inputs (SC-005)", () => {
    const lists = {
      vector: [cand("c"), cand("a"), cand("b")],
      fts: [cand("b"), cand("a")],
    };
    expect(fuseRrf(lists)).toEqual(fuseRrf(lists));
  });
});

/**
 * Phase 2 unit tests (T009, contract invariant 1): request validation fails
 * before any db or gateway call. Both doubles fail the test if touched.
 */
describe("retrieve — request validation", () => {
  function untouchableDeps(): RetrieveDeps {
    return {
      db: new Proxy(
        {},
        {
          get() {
            throw new Error("must not touch the database");
          },
        },
      ) as RetrieveDeps["db"],
      gateway: {
        embed() {
          throw new Error("must not call gateway.embed");
        },
      },
      config: { mode: "hybrid", k: 8, embedPurpose: "embedding" },
    };
  }

  it("rejects an empty question", async () => {
    await expect(
      retrieve(untouchableDeps(), { question: "" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a whitespace-only question", async () => {
    await expect(
      retrieve(untouchableDeps(), { question: "   " }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects k = 0", async () => {
    await expect(
      retrieve(untouchableDeps(), { question: "grapple", k: 0 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects k = 51", async () => {
    await expect(
      retrieve(untouchableDeps(), { question: "grapple", k: 51 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects an unknown request mode", async () => {
    await expect(
      retrieve(untouchableDeps(), {
        question: "grapple",
        // @ts-expect-error — deliberately invalid at the type level too
        mode: "bogus",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
