import { describe, expect, it } from "vitest";
import { FakeProvider } from "../../src/ai/adapters/fake.js";
import type { AiConfig } from "../../src/ai/config.js";
import { createGateway } from "../../src/ai/gateway.js";
import { memorySink } from "../../src/ai/usage.js";
import type { AnswerDeps, AnswerEvent } from "../../src/library/answer.js";
import {
  ANSWER_PURPOSE,
  answer,
  isRelevant,
  loadAnswerConfig,
  PROMPT_VERSION,
} from "../../src/library/answer.js";
import type {
  RetrievalResult,
  RetrievedPassage,
} from "../../src/library/retrieve.js";

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

/**
 * Phase 2/3 unit tests (T010, T016): `answer()` against the FAKE provider
 * (research R7) — no database, a stubbed `retrieve`.
 */

const GRAPPLE_TEXT =
  "When you want to grab a creature, you can use the Attack action to make a special melee attack, a grapple. If you succeed, the target has the grappled condition.";
const ESCAPE_TEXT =
  "Escaping  a grapple\nrequires a successful Athletics or Acrobatics check contested by the grappler's Athletics check.";
const UNRELATED_TEXT =
  "The tavern serves ale, mead, and a stew of dubious origin.";
const GRAPPLE_QUOTE =
  "you can use the Attack action to make a special melee attack, a grapple";

/** A synthetic "stored book" holding every passage below, for guarantee 3. */
const BOOK_TEXT = `Intro.\n\n${GRAPPLE_TEXT}\n\n${ESCAPE_TEXT}\n\n${UNRELATED_TEXT}\n\nOutro.`;

function anchorFor(text: string, path: string[]) {
  const start = BOOK_TEXT.indexOf(text);
  return { book: "Basic Rules", path, start, end: start + text.length };
}

function makePassages() {
  const grapple = passage({
    chunkId: "chunk-grapple",
    text: GRAPPLE_TEXT,
    anchor: anchorFor(GRAPPLE_TEXT, ["Combat", "Grappling"]),
    rank: 1,
    fts: { rank: 1, score: 0.5 },
  });
  const escapePassage = passage({
    chunkId: "chunk-escapePassage",
    text: ESCAPE_TEXT,
    anchor: anchorFor(ESCAPE_TEXT, ["Combat", "Grappling"]),
    rank: 2,
    fts: { rank: 2, score: 0.3 },
  });
  const unrelated = passage({
    chunkId: "chunk-unrelated",
    text: UNRELATED_TEXT,
    anchor: anchorFor(UNRELATED_TEXT, ["Taverns"]),
    rank: 3,
    fts: null,
    vector: null,
  });
  return { grapple, escapePassage, unrelated };
}

/** A gateway wired to one `fake` provider under the `answering` (chat) purpose. */
function buildChatGateway(fake: FakeProvider) {
  const config: AiConfig = {
    providers: {
      "fake-provider": { kind: "fake", baseUrl: "http://fake/chat" },
    },
    purposes: {
      answering: { provider: "fake-provider", model: "fake-model", op: "chat" },
    },
    prices: {},
  };
  return createGateway({
    config,
    sink: memorySink(),
    adapters: { fake: () => fake },
  });
}

function buildDeps(opts: {
  fake: FakeProvider;
  passages: RetrievedPassage[];
  minSimilarity?: number;
}): AnswerDeps {
  const result: RetrievalResult = {
    mode: "hybrid",
    embeddingModel: null,
    candidates: { vector: null, fts: opts.passages.length },
    passages: opts.passages,
  };
  return {
    db: {} as AnswerDeps["db"], // never touched: retrieve is stubbed below
    gateway: buildChatGateway(opts.fake),
    retrieval: { mode: "hybrid", k: 8, embedPurpose: "embedding" },
    config: { minSimilarity: opts.minSimilarity ?? 0.3 },
    retrieve: async () => result,
  };
}

async function collect(
  deps: AnswerDeps,
  question = "How does grappling work?",
): Promise<AnswerEvent[]> {
  const events: AnswerEvent[] = [];
  for await (const event of answer(deps, { question })) events.push(event);
  return events;
}

describe("answer() — US1 streamed answer with verified citations", () => {
  it("(a) drops a hallucinated quote, keeps the real one; done.dropped is 1", async () => {
    const { grapple, escapePassage } = makePassages();
    const fake = new FakeProvider().scriptChat([
      { type: "text", text: "Grappling replaces one of your attacks. " },
      { type: "text", text: `<cite p="1">${GRAPPLE_QUOTE}</cite>` },
      { type: "text", text: " It also grants a bonus you never earned. " },
      {
        type: "text",
        text: '<cite p="2">this exact sentence appears nowhere in the book</cite>',
      },
      { type: "done", usage: { inputTokens: 10, outputTokens: 20 } },
    ]);
    const deps = buildDeps({ fake, passages: [grapple, escapePassage] });
    const events = await collect(deps);

    for (const event of events) {
      if (event.type === "delta") {
        expect(event.text).not.toMatch(/<cite|<\/cite|<refuse/);
      }
    }
    expect(events.filter((e) => e.type === "citation")).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({
      type: "done",
      citations: 1,
      dropped: 1,
      passages: 2,
      promptVersion: PROMPT_VERSION,
    });
  });

  it("(b) a whitespace-drifted quote is emitted with the passage's exact words", async () => {
    const { escapePassage } = makePassages();
    const fake = new FakeProvider().scriptChat([
      {
        type: "text",
        text: '<cite p="1">Escaping a grapple requires a successful Athletics or Acrobatics check</cite>',
      },
      { type: "done", usage: { inputTokens: 1, outputTokens: 1 } },
    ]);
    const deps = buildDeps({ fake, passages: [escapePassage] });
    const events = await collect(deps);
    const citation = events.find((e) => e.type === "citation");
    expect(citation?.type === "citation" && citation.quote).toBe(
      "Escaping  a grapple\nrequires a successful Athletics or Acrobatics check",
    );
  });

  it("(c) a marker split across three text events parses and cites", async () => {
    const { grapple } = makePassages();
    const fake = new FakeProvider().scriptChat([
      { type: "text", text: "Grappling uses an attack. <ci" },
      {
        type: "text",
        text: 'te p="1">you can use the Attack action to make a special melee attack, a gra',
      },
      { type: "text", text: "pple</cite>." },
      { type: "done", usage: { inputTokens: 1, outputTokens: 1 } },
    ]);
    const deps = buildDeps({ fake, passages: [grapple] });
    const events = await collect(deps);
    const citations = events.filter((e) => e.type === "citation");
    expect(citations).toHaveLength(1);
    expect(citations[0]).toMatchObject({ quote: GRAPPLE_QUOTE });
  });

  it("(d) an unknown p is dropped; a valid citation alongside it still counts", async () => {
    const { grapple } = makePassages();
    const fake = new FakeProvider().scriptChat([
      { type: "text", text: '<cite p="9">nothing exists at this index</cite>' },
      { type: "text", text: `<cite p="1">${GRAPPLE_QUOTE}</cite>` },
      { type: "done", usage: { inputTokens: 1, outputTokens: 1 } },
    ]);
    const deps = buildDeps({ fake, passages: [grapple] });
    const events = await collect(deps);
    expect(events.filter((e) => e.type === "citation")).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({
      type: "done",
      citations: 1,
      dropped: 1,
    });
  });

  it("(e) the same quote cited twice reuses its citation number", async () => {
    const { grapple } = makePassages();
    const fake = new FakeProvider().scriptChat([
      {
        type: "text",
        text: `<cite p="1">${GRAPPLE_QUOTE}</cite> Again: <cite p="1">${GRAPPLE_QUOTE}</cite>`,
      },
      { type: "done", usage: { inputTokens: 1, outputTokens: 1 } },
    ]);
    const deps = buildDeps({ fake, passages: [grapple] });
    const events = await collect(deps);
    const citations = events.filter((e) => e.type === "citation");
    expect(citations).toHaveLength(2);
    expect(citations[0]).toMatchObject({ n: 1 });
    expect(citations[1]).toMatchObject({ n: 1 });
    expect(events.at(-1)).toMatchObject({ type: "done", citations: 1 });
  });

  it("(f) the chat request's purpose is answering; only relevant passages are numbered", async () => {
    const { grapple, escapePassage, unrelated } = makePassages();
    const fake = new FakeProvider().scriptChat([
      { type: "done", usage: { inputTokens: 1, outputTokens: 1 } },
    ]);
    const deps = buildDeps({
      fake,
      passages: [grapple, escapePassage, unrelated],
    });
    await collect(deps);

    expect(fake.chatCalls).toHaveLength(1);
    expect(fake.chatCalls[0].request.purpose).toBe(ANSWER_PURPOSE);
    const userMessage = fake.chatCalls[0].request.messages[0]?.content ?? "";
    expect(userMessage).toContain('p="1"');
    expect(userMessage).toContain('p="2"');
    expect(userMessage).not.toContain('p="3"');
    expect(userMessage).not.toContain(UNRELATED_TEXT);
  });

  it("(g) exactly one terminal event, last; every citation satisfies the three guarantees", async () => {
    const { grapple } = makePassages();
    const fake = new FakeProvider().scriptChat([
      { type: "text", text: `<cite p="1">${GRAPPLE_QUOTE}</cite>` },
      { type: "done", usage: { inputTokens: 1, outputTokens: 1 } },
    ]);
    const deps = buildDeps({ fake, passages: [grapple] });
    const events = await collect(deps);

    const terminal = events.filter((e) =>
      (["done", "refusal", "error"] as const).includes(
        e.type as "done" | "refusal" | "error",
      ),
    );
    expect(terminal).toHaveLength(1);
    expect(events.at(-1)).toBe(terminal[0]);

    const citation = events.find((e) => e.type === "citation");
    if (citation?.type !== "citation") {
      throw new Error("expected a citation event");
    }
    expect(
      citation.passage.text.slice(
        citation.quoteInPassage.start,
        citation.quoteInPassage.end,
      ),
    ).toBe(citation.quote);
    expect(citation.span.start).toBe(
      citation.passage.span.start + citation.quoteInPassage.start,
    );
    expect(citation.span.end).toBe(
      citation.passage.span.start + citation.quoteInPassage.end,
    );
    expect(BOOK_TEXT.slice(citation.span.start, citation.span.end)).toBe(
      citation.quote,
    );
  });
});

describe("answer() — US2 refuse when nothing is relevant", () => {
  it("no relevant passages → refusal{nothing_relevant}, zero chat calls", async () => {
    const fake = new FakeProvider();
    const deps = buildDeps({ fake, passages: [] });
    const events = await collect(deps);
    expect(events).toEqual([
      {
        type: "refusal",
        reason: "nothing_relevant",
        message: expect.any(String),
      },
    ]);
    expect(fake.chatCalls).toHaveLength(0);
  });

  it("every passage fails the vector floor → refusal{nothing_relevant}, zero chat calls", async () => {
    const below = passage({ vector: { rank: 1, score: 0.1 }, fts: null });
    const fake = new FakeProvider();
    const deps = buildDeps({ fake, passages: [below] });
    const events = await collect(deps);
    expect(events).toEqual([
      {
        type: "refusal",
        reason: "nothing_relevant",
        message: expect.any(String),
      },
    ]);
    expect(fake.chatCalls).toHaveLength(0);
  });

  it("<refuse/> after some text ends with refusal{model_declined}, last", async () => {
    const { grapple } = makePassages();
    const fake = new FakeProvider().scriptChat([
      { type: "text", text: "Let me check the passages. " },
      { type: "text", text: "<refuse/>" },
      { type: "done", usage: { inputTokens: 1, outputTokens: 1 } },
    ]);
    const deps = buildDeps({ fake, passages: [grapple] });
    const events = await collect(deps);
    expect(events.at(-1)).toMatchObject({
      type: "refusal",
      reason: "model_declined",
    });
    expect(events.filter((e) => e.type !== "delta")).toHaveLength(1);
  });

  it('a gateway error{kind:"refusal"} maps to refusal{model_declined}', async () => {
    const { grapple } = makePassages();
    const fake = new FakeProvider().scriptChat([
      {
        type: "error",
        kind: "refusal",
        message: "provider refused",
        usage: { inputTokens: 1, outputTokens: 0 },
      },
    ]);
    const deps = buildDeps({ fake, passages: [grapple] });
    const events = await collect(deps);
    expect(events).toEqual([
      {
        type: "refusal",
        reason: "model_declined",
        message: expect.any(String),
      },
    ]);
  });

  it("an answer with only invented quotes ends with refusal{unverified}, no done", async () => {
    const { grapple } = makePassages();
    const fake = new FakeProvider().scriptChat([
      {
        type: "text",
        text: '<cite p="1">an entirely invented quote not in the book</cite>',
      },
      { type: "done", usage: { inputTokens: 1, outputTokens: 1 } },
    ]);
    const deps = buildDeps({ fake, passages: [grapple] });
    const events = await collect(deps);
    expect(events.some((e) => e.type === "done")).toBe(false);
    expect(events.at(-1)).toMatchObject({
      type: "refusal",
      reason: "unverified",
    });
  });
});
