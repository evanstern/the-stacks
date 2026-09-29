import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { bowEmbed, truncateVector } from "../../src/bench/retrieval/embed.js";
import {
  loadCorpus,
  loadMatrix,
  loadQuestions,
} from "../../src/bench/retrieval/load.js";
import { scoreQuestion, summarize } from "../../src/bench/retrieval/score.js";
import { ValidationError } from "../../src/errors.js";
import type { RetrievedPassage } from "../../src/library/retrieve.js";

/**
 * Phase 2 unit tests (specs/019-retrieval-bench tasks.md T009): the pure
 * load/score/embed helpers, no database. Contract invariants 1-4.
 */

const CORPUS_DIR = fileURLToPath(
  new URL("../../bench/retrieval/corpus", import.meta.url),
);
const QUESTIONS_PATH = fileURLToPath(
  new URL("../../bench/retrieval/questions.json", import.meta.url),
);

function passage(
  overrides: Partial<RetrievedPassage> & {
    book: string;
    start: number;
    end: number;
  },
): RetrievedPassage {
  return {
    chunkId: `chunk-${overrides.rank ?? 1}`,
    documentId: "doc",
    kind: "prose",
    text: "",
    anchor: {
      book: overrides.book,
      path: [],
      start: overrides.start,
      end: overrides.end,
    },
    rank: overrides.rank ?? 1,
    score: overrides.score ?? 1,
    vector: null,
    fts: null,
  };
}

describe("scoreQuestion", () => {
  const question = {
    id: "q001",
    question: "does it matter",
    style: "lexical" as const,
    targets: [{ doc: "combat", start: 100, end: 200 }],
  };

  it("hits the first passage whose span overlaps >= half the target", () => {
    const passages = [
      passage({ book: "combat", start: 140, end: 210, rank: 1 }), // overlap 60/100
    ];
    expect(scoreQuestion(question, passages)).toEqual({ rank: 1 });
  });

  it("misses a passage with less than half overlap", () => {
    const passages = [
      passage({ book: "combat", start: 180, end: 210, rank: 1 }),
    ]; // overlap 20/100
    expect(scoreQuestion(question, passages)).toEqual({ rank: null });
  });

  it("ignores a matching span in the wrong book", () => {
    const passages = [
      passage({ book: "spells", start: 100, end: 200, rank: 1 }),
    ];
    expect(scoreQuestion(question, passages)).toEqual({ rank: null });
  });

  it("returns the rank of the first hit, not the best-overlapping one", () => {
    const passages = [
      passage({ book: "spells", start: 0, end: 10, rank: 1 }),
      passage({ book: "combat", start: 100, end: 200, rank: 2 }), // full overlap
    ];
    expect(scoreQuestion(question, passages)).toEqual({ rank: 2 });
  });

  it("accepts any expected target among several", () => {
    const multi = {
      ...question,
      targets: [
        { doc: "combat", start: 0, end: 10 },
        { doc: "spells", start: 50, end: 60 },
      ],
    };
    const passages = [passage({ book: "spells", start: 50, end: 60, rank: 1 })];
    expect(scoreQuestion(multi, passages)).toEqual({ rank: 1 });
  });
});

describe("summarize", () => {
  it("is all zeros when every rank is a miss", () => {
    expect(summarize([null, null, null])).toEqual({
      recall1: 0,
      recall5: 0,
      recall10: 0,
      mrr10: 0,
    });
  });

  it("is all ones when every rank is 1", () => {
    expect(summarize([1, 1, 1])).toEqual({
      recall1: 1,
      recall5: 1,
      recall10: 1,
      mrr10: 1,
    });
  });

  it("uses 1/rank for ranks <= 10 and ignores misses/rank>10", () => {
    const result = summarize([1, 4, null, 20]);
    expect(result.recall1).toBeCloseTo(0.25);
    expect(result.recall5).toBeCloseTo(0.5);
    expect(result.recall10).toBeCloseTo(0.5);
    expect(result.mrr10).toBeCloseTo((1 + 1 / 4) / 4);
  });
});

function norm(v: number[]): number {
  return Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
}

function cosine(a: number[], b: number[]): number {
  const dot = a.reduce((sum, x, i) => sum + x * b[i], 0);
  return dot / (norm(a) * norm(b));
}

describe("bowEmbed", () => {
  it("is deterministic, unit-norm, length 1024", () => {
    const v1 = bowEmbed("the quick brown fox jumps over the lazy dog");
    const v2 = bowEmbed("the quick brown fox jumps over the lazy dog");
    expect(v1).toEqual(v2);
    expect(v1).toHaveLength(1024);
    expect(norm(v1)).toBeCloseTo(1);
  });

  it("gives higher cosine similarity to texts sharing content words", () => {
    const a = bowEmbed("the wizard casts a spell using components");
    const b = bowEmbed("a wizard casting spells needs components");
    const c = bowEmbed("goblins attack with rusty scimitars");
    expect(cosine(a, b)).toBeGreaterThan(cosine(a, c));
  });
});

describe("truncateVector", () => {
  it("at 1024 returns the input renormalized", () => {
    const v = bowEmbed("some sample text for the vector");
    expect(truncateVector(v, 1024)).toEqual(v);
  });

  it("at d < 1024 zeroes components d..1023 and keeps unit norm", () => {
    const v = bowEmbed(
      "some sample text for the vector with more content words",
    );
    const truncated = truncateVector(v, 256);
    expect(truncated).toHaveLength(1024);
    expect(truncated.slice(256).every((x) => x === 0)).toBe(true);
    expect(norm(truncated)).toBeCloseTo(1);
  });
});

describe("loadCorpus / loadQuestions (committed data)", () => {
  it("loads the committed questions against the committed corpus", () => {
    const { books, hash: corpusHash } = loadCorpus(CORPUS_DIR);
    expect(books.length).toBe(8);
    expect(corpusHash).toMatch(/^[0-9a-f]{64}$/);

    const { questions, hash: questionsHash } = loadQuestions(
      QUESTIONS_PATH,
      books,
    );
    expect(questions.length).toBeGreaterThanOrEqual(50);
    expect(questionsHash).toMatch(/^[0-9a-f]{64}$/);
    const ids = new Set(questions.map((q) => q.id));
    expect(ids.size).toBe(questions.length);
  });
});

/**
 * QuestionSetSchema floors the array at 50 entries, so these negative cases
 * mutate one entry of the real (>=50-question) committed set rather than a
 * hand-built one-question fixture.
 */
describe("loadQuestions (mutated real data)", () => {
  const { books } = loadCorpus(CORPUS_DIR);
  const rawQuestions = JSON.parse(readFileSync(QUESTIONS_PATH, "utf8")) as {
    id: string;
    expected: { doc: string; quote: string }[];
  }[];

  /** ValidationError's own `.message` is fixed; the id lives in `.issues`. */
  function issueMessages(fn: () => unknown): string[] {
    try {
      fn();
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      return (err as ValidationError).issues.map(
        (i) => `${i.path} ${i.message}`,
      );
    }
    throw new Error("expected fn to throw");
  }

  it("throws naming the id when a quote is missing", () => {
    const targetId = rawQuestions[0].id;
    const data = JSON.parse(JSON.stringify(rawQuestions));
    data[0].expected[0].quote =
      "this exact string does not occur anywhere in the benchmark corpus";
    const tmpDir = mkdtempSync(path.join(tmpdir(), "bench-questions-"));
    const file = path.join(tmpDir, "questions.json");
    writeFileSync(file, JSON.stringify(data));

    const messages = issueMessages(() => loadQuestions(file, books));
    expect(messages.join("\n")).toMatch(new RegExp(targetId));
  });

  it("throws naming the id when a quote matches more than once", () => {
    const targetId = rawQuestions[0].id;
    const { doc, quote } = rawQuestions[0].expected[0];
    // Append a second copy of the same quote to its target book's text —
    // loadQuestions resolves quotes with indexOf on book.text alone.
    const duplicatedBooks = books.map((b) =>
      b.book === doc ? { ...b, text: `${b.text}\n\n${quote}` } : b,
    );

    const messages = issueMessages(() =>
      loadQuestions(QUESTIONS_PATH, duplicatedBooks),
    );
    expect(messages.join("\n")).toMatch(new RegExp(targetId));
  });
});

describe("loadMatrix", () => {
  it("rejects a dim above 1024", () => {
    const tmpDir = mkdtempSync(path.join(tmpdir(), "bench-matrix-"));
    const file = path.join(tmpDir, "matrix.json");
    writeFileSync(
      file,
      JSON.stringify({
        name: "bad",
        models: [{ name: "m", source: { builtin: "bow" }, dims: [1025] }],
        chunking: [{ name: "c", maxChars: 0 }],
        modes: ["vector"],
      }),
    );
    expect(() => loadMatrix(file)).toThrow();
  });
});
