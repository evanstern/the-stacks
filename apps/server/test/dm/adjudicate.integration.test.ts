import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createGateway } from "../../src/ai/gateway.js";
import { memorySink } from "../../src/ai/usage.js";
import { createDb, probeReachable } from "../../src/db.js";
import { adjudicate } from "../../src/dm/nodes/adjudicate.js";
import { assemble } from "../../src/dm/nodes/assemble.js";
import type { InterpretOutput } from "../../src/dm/nodes/schemas.js";
import { createScriptedDm, loadDmScript } from "../../src/dm/script/load.js";
import type { Block, ParsedBook } from "../../src/library/ddb/index.js";
import { retrieve } from "../../src/library/retrieve.js";
import { storeParsedBook } from "../../src/library/store.js";
import { freeEventsThrough, makeCtx, projectDm } from "./helpers.js";

/**
 * Adjudicate against a REAL Postgres: retrieval and citation verification
 * run for real; only the chat model is scripted. Loud-skip harness copied
 * from library/ask.integration.test.ts.
 */

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const db = databaseUrl ? createDb(databaseUrl) : undefined;
const reachable = db ? await probeReachable(db.$client, 2000) : false;

if (!reachable) {
  const notice =
    `\n⚠️  SKIPPING apps/server/test/dm/adjudicate.integration.test.ts — no reachable ` +
    `database (tried TEST_DATABASE_URL then DATABASE_URL; got ${databaseUrl ?? "<unset>"}). ` +
    `A skip here proves NOTHING about adjudicate's citation verification. ` +
    `Start one with: pnpm env:up, then set TEST_DATABASE_URL.\n`;
  console.warn(notice);
  if (process.env.REQUIRE_DATABASE === "1") throw new Error(notice);
}

afterAll(async () => {
  await db?.$client.end();
});

function requireDb() {
  if (!db) throw new Error("adjudicate integration tests require a database");
  return db;
}

const nonce = () => `nonce${randomUUID().replace(/-/g, "")}`;

function makeBook(book: string, paragraphs: string[]): ParsedBook {
  let text = "";
  const blocks: Block[] = paragraphs.map((p, i) => {
    if (i > 0) text += "\n\n";
    const start = text.length;
    text += p;
    const end = text.length;
    const path = ["Chapter 1", `Section ${i + 1}`];
    return {
      kind: "prose" as const,
      path,
      text: p,
      anchor: { book, path, start, end },
    };
  });
  return { book, text, blocks };
}

const GRAPPLE_QUOTE =
  "make an Athletics check against the target's Strength save";

async function setup(opts: { citations: unknown[]; readings: number }) {
  const word = nonce();
  const book = `Fixture Rules ${randomUUID()}`;
  const parsed = makeBook(book, [
    `${word} grapple: a creature can grapple a foe by choosing to ${GRAPPLE_QUOTE}.`,
    "Unrelated filler about rations and torches.",
  ]);
  await storeParsedBook(requireDb(), parsed);

  const calls = Array.from({ length: opts.readings }, () => ({
    purpose: "dm.adjudicate",
    respond: {
      type: "json",
      value: {
        ruling: "Grappling needs a contested check.",
        citations: opts.citations,
        steps: [
          {
            step: "check",
            reason: "Ana grapples the goblin",
            combatantId: "ana",
            kind: "ability-check",
            ability: "str",
            skill: "athletics",
            expression: "1d20+3",
            mode: "normal",
            dc: 12,
            autoFail: null,
            onSuccess: [
              {
                effect: "condition",
                op: "apply",
                targetId: "goblin",
                condition: "grappled",
                source: "Ana",
              },
            ],
            onFailure: [],
          },
        ],
      },
    },
  }));
  const scripted = createScriptedDm(
    loadDmScript({ v: 1, name: "adjudicate", dice: [], calls }),
  );
  const gateway = createGateway({
    config: scripted.aiConfig,
    sink: memorySink(),
    adapters: { fake: () => scripted.provider },
  });
  let retrieveCalls = 0;
  const events = freeEventsThrough("action.committed");
  const ctx0 = makeCtx({
    deps: {
      gateway,
      loadProjections: async () => projectDm(events),
      retrieve: async (q) => {
        retrieveCalls += 1;
        return retrieve(
          {
            db: requireDb(),
            gateway,
            config: { mode: "fts", k: 8, embedPurpose: "embedding" },
          },
          q,
        );
      },
    },
  });
  const assembled = await assemble(ctx0);
  if (!assembled.ok) throw new Error("assemble failed");
  const readings: InterpretOutput["readings"] = Array.from(
    { length: opts.readings },
    (_, i) => ({
      actionId: i === 0 ? "act-lockpick" : null,
      intent: "check" as const,
      uncertain: true,
      needsAdjudication: true,
      rulesQuestion: `${word} how does a creature grapple a foe?`,
      clarify: null,
      steps: [],
      followUps: [],
    }),
  );
  const ctx = {
    ...ctx0,
    results: { assemble: assembled.output, interpret: { readings } },
  };
  return { ctx, scripted, parsed, book, retrieveCalls: () => retrieveCalls };
}

describe("adjudicate (database)", () => {
  it("keeps a verified library citation with its anchor and drops an unverifiable quote", async () => {
    const { ctx, parsed, book, scripted } = await setup({
      readings: 1,
      citations: [
        { source: "library", p: 1, quote: GRAPPLE_QUOTE },
        {
          source: "library",
          p: 1,
          quote: "a sentence that the passage never says",
        },
        {
          source: "library",
          p: 9,
          quote: "no such passage exists in the list",
        },
      ],
    });
    const result = await adjudicate(ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ruling = result.output.rulings[0];
    expect(ruling?.improvised).toBe(false);
    expect(ruling?.dropped).toBe(2);
    expect(ruling?.citations).toHaveLength(1);
    const citation = ruling?.citations[0];
    if (citation?.source !== "library")
      throw new Error("expected a library citation");
    expect(citation.book).toBe(book);
    expect(citation.path).toEqual(["Chapter 1", "Section 1"]);
    expect(citation.quote).toBe(GRAPPLE_QUOTE);
    expect(parsed.text.slice(citation.span.start, citation.span.end)).toBe(
      GRAPPLE_QUOTE,
    );
    expect(result.calls.map((c) => c.purpose)).toEqual(["dm.adjudicate"]);
    // The numbered passage reached the prompt.
    const prompt =
      scripted.provider.chatCalls[0]?.request.messages[0]?.content ?? "";
    expect(prompt).toContain('<passage p="1"');
    expect(ruling?.steps[0]?.step).toBe("check");
  });

  it("marks a ruling improvised when no citation verifies", async () => {
    const { ctx } = await setup({
      readings: 1,
      citations: [
        { source: "library", p: 1, quote: "words the book does not contain" },
      ],
    });
    const result = await adjudicate(ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ruling = result.output.rulings[0];
    expect(ruling?.improvised).toBe(true);
    expect(ruling?.citations).toEqual([]);
    expect(ruling?.dropped).toBe(1);
  });

  it("carries the SRD page on an SRD citation and drops an unknown record", async () => {
    const { ctx } = await setup({
      readings: 1,
      citations: [
        { source: "srd", kind: "condition", id: "grappled" },
        { source: "srd", kind: "condition", id: "no-such-condition" },
      ],
    });
    const result = await adjudicate(ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ruling = result.output.rulings[0];
    expect(ruling?.improvised).toBe(false);
    expect(ruling?.dropped).toBe(1);
    const citation = ruling?.citations[0];
    if (citation?.source !== "srd") throw new Error("expected an SRD citation");
    expect(citation).toMatchObject({
      kind: "condition",
      id: "grappled",
      name: "Grappled",
    });
    expect(citation.page).toBeGreaterThan(0);
  });

  it("retrieves once per adjudicated action", async () => {
    const { ctx, scripted, retrieveCalls } = await setup({
      readings: 2,
      citations: [{ source: "library", p: 1, quote: GRAPPLE_QUOTE }],
    });
    const result = await adjudicate(ctx);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.rulings).toHaveLength(2);
    expect(retrieveCalls()).toBe(2);
    expect(scripted.remaining().calls["dm.adjudicate"]).toBe(0);
  });

  it("ships an uncited ruling when retrieval finds nothing", async () => {
    const { ctx } = await setup({ readings: 1, citations: [] });
    const ctxNone = {
      ...ctx,
      results: {
        ...ctx.results,
        interpret: {
          readings: ctx.results.interpret.readings.map((r) => ({
            ...r,
            rulesQuestion: `${nonce()} zzzyx qqqwv`,
          })),
        },
      },
    };
    const result = await adjudicate(ctxNone);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.rulings[0]?.improvised).toBe(true);
  });
});
