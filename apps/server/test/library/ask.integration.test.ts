import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { FakeProvider } from "../../src/ai/adapters/fake.js";
import type { AiConfig } from "../../src/ai/config.js";
import { createGateway } from "../../src/ai/gateway.js";
import { memorySink } from "../../src/ai/usage.js";
import type { App } from "../../src/app.js";
import { createApp } from "../../src/app.js";
import { hashPassword } from "../../src/auth/password.js";
import { createDb, probeReachable } from "../../src/db.js";
import type { Block, ParsedBook } from "../../src/library/ddb/index.js";
import type { RetrievalMode } from "../../src/library/retrieve.js";
import { attachEmbeddings, storeParsedBook } from "../../src/library/store.js";
import { users } from "../../src/schema/auth.js";
import { libraryChunks, libraryDocuments } from "../../src/schema/library.js";

/**
 * Integration tests for `POST /library/ask` (specs/018-rules-answerer
 * tasks.md T013, T017) against a REAL Postgres — retrieval runs for real;
 * only the chat model is scripted (research R7). Loud-skip harness copied
 * from retrieve.integration.test.ts.
 */

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const db = databaseUrl ? createDb(databaseUrl) : undefined;
const reachable = db ? await probeReachable(db.$client, 2000) : false;

if (!reachable) {
  const notice =
    `\n⚠️  SKIPPING apps/server/test/library/ask.integration.test.ts — no reachable ` +
    `database (tried TEST_DATABASE_URL then DATABASE_URL; got ${databaseUrl ?? "<unset>"}). ` +
    `These are the rules-answerer route integration tests (spec 018); a skip here proves ` +
    `NOTHING about citation verification or refusal. Start one with: pnpm env:up, then set ` +
    `TEST_DATABASE_URL=postgres://<user>:<pass>@localhost:<DB_PORT>/<db>\n`;
  console.warn(notice);
  if (process.env.REQUIRE_DATABASE === "1") throw new Error(notice);
}

afterAll(async () => {
  await db?.$client.end();
});

function requireDb() {
  if (!db) {
    throw new Error("ask integration tests require a reachable database");
  }
  return db;
}

/** A fresh, unique book name per test — `library_documents.book` is unique. */
function freshBookName(label: string): string {
  return `${label} ${randomUUID()}`;
}

/** A nonce word per test (research R7): keyword-isolates results from other suites. */
function nonceWord(): string {
  return `nonce${randomUUID().replace(/-/g, "")}`;
}

/** Builds a small synthetic `ParsedBook`: one prose block per paragraph, correctly anchored. */
function makeBook(book: string, paragraphs: string[]): ParsedBook {
  let text = "";
  const blocks: Block[] = paragraphs.map((p, i) => {
    if (i > 0) text += "\n\n";
    const start = text.length;
    text += p;
    const end = text.length;
    const path = [`Section ${i + 1}`];
    return {
      kind: "prose" as const,
      path,
      text: p,
      anchor: { book, path, start, end },
    };
  });
  return { book, text, blocks };
}

async function storeBook(label: string, paragraphs: string[]) {
  const book = freshBookName(label);
  const parsed = makeBook(book, paragraphs);
  const result = await storeParsedBook(requireDb(), parsed);
  return { book, documentId: result.documentId };
}

async function readChunks(documentId: string) {
  return requireDb()
    .select()
    .from(libraryChunks)
    .where(eq(libraryChunks.documentId, documentId))
    .orderBy(asc(libraryChunks.ordinal));
}

/** A gateway wired to one `fake` provider serving both `answering` (chat) and `embedding` (embed). */
function buildAnswerGateway(fake: FakeProvider, embedModel: string) {
  const config: AiConfig = {
    providers: {
      "fake-chat": { kind: "fake", baseUrl: "http://fake/chat" },
      "fake-embed": { kind: "fake", baseUrl: "http://fake/embed" },
    },
    purposes: {
      answering: { provider: "fake-chat", model: "fake-model", op: "chat" },
      embedding: { provider: "fake-embed", model: embedModel, op: "embed" },
    },
    prices: {},
  };
  return createGateway({
    config,
    sink: memorySink(),
    adapters: { fake: () => fake },
  });
}

function buildApp(
  gateway: ReturnType<typeof buildAnswerGateway>,
  mode: RetrievalMode,
): App {
  return createApp({
    databaseProbe: { reachable: async () => true },
    db: requireDb(),
    library: {
      answer: {
        gateway,
        retrieval: { mode, k: 8, embedPurpose: "embedding" },
        config: { minSimilarity: 0.3 },
      },
    },
  });
}

// sign-in exercises the real route rather than seeding a session row by hand,
// matching uploads.integration.test.ts's pattern.
async function signInCookie(app: App, role: "operator" | "player") {
  const username = `test-${randomUUID()}`;
  const password = "correct horse battery staple";
  const passwordHash = await hashPassword(password);
  await requireDb()
    .insert(users)
    .values({ username, displayName: username, role, passwordHash });
  const res = await app.request("/auth/sign-in", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("expected a Set-Cookie header");
  return setCookie.split(";")[0];
}
const operatorCookie = (app: App) => signInCookie(app, "operator");
const playerCookie = (app: App) => signInCookie(app, "player");

interface SseEvent {
  event: string;
  data: unknown;
}

/** Splits an SSE response body on blank lines into `{event, data}` (contracts/ask-sse.md). */
async function readSse(res: Response): Promise<SseEvent[]> {
  const text = await res.text();
  return text
    .split("\n\n")
    .filter((block) => block.trim().length > 0)
    .map((block) => {
      const lines = block.split("\n");
      const eventLine = lines.find((l) => l.startsWith("event: "));
      const dataLine = lines.find((l) => l.startsWith("data: "));
      return {
        event: eventLine?.slice("event: ".length) ?? "",
        data: dataLine
          ? JSON.parse(dataLine.slice("data: ".length))
          : undefined,
      };
    });
}

function ask(app: App, cookie: string, question: string) {
  return app.request("/library/ask", {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ question }),
  });
}

const QUOTE =
  "you can use the Attack action to make a special melee attack, a grapple";

describe.skipIf(!reachable)(
  "POST /library/ask — US1 streamed answer with verified citations (integration)",
  () => {
    it("T013: real + hallucinated quote → one citation, done.dropped 1, span slices back to the stored text (SC-001, SC-002)", async () => {
      const nonce = nonceWord();
      const { documentId } = await storeBook("Ask Grapple", [
        `A note about ${nonce} grappling: ${QUOTE}. Ask your DM for details.`,
        "An unrelated paragraph about weather and taverns.",
      ]);

      const fake = new FakeProvider().scriptChat([
        { type: "text", text: "Grappling replaces an attack. " },
        { type: "text", text: `<cite p="1">${QUOTE}</cite>` },
        { type: "text", text: " It also lets you dodge free of charge. " },
        {
          type: "text",
          text: '<cite p="1">this exact clause is invented and not real</cite>',
        },
        { type: "done", usage: { inputTokens: 5, outputTokens: 5 } },
      ]);
      const app = buildApp(buildAnswerGateway(fake, "unused-model"), "fts");
      const cookie = await operatorCookie(app);

      const res = await ask(app, cookie, nonce);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/event-stream");

      const events = await readSse(res);
      const citationEvents = events.filter((e) => e.event === "citation");
      expect(citationEvents).toHaveLength(1);
      expect(events.at(-1)).toMatchObject({
        event: "done",
        data: { citations: 1, dropped: 1 },
      });

      const citation = citationEvents[0]?.data as {
        span: { start: number; end: number };
        quote: string;
      };
      const [doc] = await requireDb()
        .select({ text: libraryDocuments.text })
        .from(libraryDocuments)
        .where(eq(libraryDocuments.id, documentId));
      expect(doc.text.slice(citation.span.start, citation.span.end)).toBe(
        citation.quote,
      );
    });
  },
);

describe.skipIf(!reachable)(
  "POST /library/ask — US2 refuse when nothing is relevant (integration)",
  () => {
    it("T017: a question sharing no word with the library yields nothing_relevant, zero chat calls (SC-003)", async () => {
      const nonce = nonceWord();
      await storeBook("Ask No Match", [
        `A paragraph only about ${nonce} and nothing else.`,
      ]);

      const fake = new FakeProvider();
      const app = buildApp(buildAnswerGateway(fake, "unused-model"), "fts");
      const cookie = await operatorCookie(app);

      const res = await ask(app, cookie, nonceWord());
      const events = await readSse(res);
      expect(events).toEqual([
        {
          event: "refusal",
          data: { reason: "nothing_relevant", message: expect.any(String) },
        },
      ]);
      expect(fake.chatCalls).toHaveLength(0);
    });

    it("T017: vector mode — below-floor similarity refuses; an above-floor chunk gets the model called", async () => {
      const model = `model-${randomUUID()}`;
      /** Two disjoint unit vectors: identical -> cosine 1; disjoint -> cosine 0. */
      function unitVec(indices: number[]): number[] {
        const v = new Array(1024).fill(0);
        for (const i of indices) v[i] = 1;
        return v;
      }
      const questionVec = unitVec([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const belowVec = unitVec([
        500, 501, 502, 503, 504, 505, 506, 507, 508, 509,
      ]);

      const nonceBelow = nonceWord();
      const { documentId: belowDoc } = await storeBook("Ask Vector Below", [
        `A passage about ${nonceBelow}.`,
      ]);
      const [belowChunk] = await readChunks(belowDoc);
      await attachEmbeddings(requireDb(), [
        { chunkId: belowChunk.id, model, dim: 1024, vector: belowVec },
      ]);

      const fakeBelow = new FakeProvider().scriptEmbed({
        vectors: [questionVec],
      });
      const belowApp = buildApp(buildAnswerGateway(fakeBelow, model), "vector");
      const belowCookie = await operatorCookie(belowApp);
      const belowRes = await ask(belowApp, belowCookie, "anything");
      const belowEvents = await readSse(belowRes);
      expect(belowEvents).toEqual([
        {
          event: "refusal",
          data: { reason: "nothing_relevant", message: expect.any(String) },
        },
      ]);
      expect(fakeBelow.chatCalls).toHaveLength(0);

      const nonceAbove = nonceWord();
      const { documentId: aboveDoc } = await storeBook("Ask Vector Above", [
        `A passage about ${nonceAbove}.`,
      ]);
      const [aboveChunk] = await readChunks(aboveDoc);
      await attachEmbeddings(requireDb(), [
        { chunkId: aboveChunk.id, model, dim: 1024, vector: questionVec },
      ]);

      const fakeAbove = new FakeProvider()
        .scriptEmbed({ vectors: [questionVec] })
        .scriptChat([
          { type: "text", text: "No citation here." },
          { type: "done", usage: { inputTokens: 1, outputTokens: 1 } },
        ]);
      const aboveApp = buildApp(buildAnswerGateway(fakeAbove, model), "vector");
      const aboveCookie = await operatorCookie(aboveApp);
      const aboveRes = await ask(aboveApp, aboveCookie, "anything");
      await readSse(aboveRes);
      expect(fakeAbove.chatCalls).toHaveLength(1);
    });
  },
);

describe.skipIf(!reachable)(
  "POST /library/ask — US3 failures, auth, and cancellation (integration)",
  () => {
    it("T020: 401 without a session, before any stream opens", async () => {
      const app = buildApp(buildAnswerGateway(new FakeProvider(), "m"), "fts");
      const res = await app.request("/library/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: "anything" }),
      });
      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: { kind: string } };
      expect(body.error.kind).toBe("unauthorized");
    });

    it("T020: 403 for a player, before any stream opens, zero chat calls (SC-005)", async () => {
      const fake = new FakeProvider();
      const app = buildApp(buildAnswerGateway(fake, "m"), "fts");
      const cookie = await playerCookie(app);
      const res = await ask(app, cookie, "anything");
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { kind: string } };
      expect(body.error.kind).toBe("forbidden");
      expect(fake.chatCalls).toHaveLength(0);
    });

    it.each([
      ["an empty body", "{}"],
      ["a blank question", JSON.stringify({ question: "  " })],
      [
        "an over-length question",
        JSON.stringify({ question: "a".repeat(2001) }),
      ],
      ["a non-JSON body", "not json"],
    ])("T020: 400 validation for %s", async (_label, body) => {
      const app = buildApp(buildAnswerGateway(new FakeProvider(), "m"), "fts");
      const cookie = await operatorCookie(app);
      const res = await app.request("/library/ask", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body,
      });
      expect(res.status).toBe(400);
      const responseBody = (await res.json()) as { error: { kind: string } };
      expect(responseBody.error.kind).toBe("validation");
    });

    it("T020: no answer deps configured → one error{config} event", async () => {
      const app: App = createApp({
        databaseProbe: { reachable: async () => true },
        db: requireDb(),
      });
      const cookie = await operatorCookie(app);
      const res = await ask(app, cookie, "anything");
      const events = await readSse(res);
      expect(events).toEqual([
        {
          event: "error",
          data: { kind: "config", message: expect.any(String) },
        },
      ]);
    });
  },
);
