import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { asc, eq, sql } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { FakeProvider } from "../../src/ai/adapters/fake.js";
import type { AiConfig } from "../../src/ai/config.js";
import { createGateway } from "../../src/ai/gateway.js";
import { createDb, probeReachable } from "../../src/db.js";
import { parseDdbExport } from "../../src/library/ddb/index.js";
import { chunkBook } from "../../src/library/ingest/chunk.js";
import {
  claimJob,
  enqueueIngest,
  finishJob,
  getJob,
} from "../../src/library/ingest/jobs.js";
import { startIngestWorker } from "../../src/library/ingest/worker.js";
import {
  libraryChunks,
  libraryDocuments,
  libraryEmbeddings,
} from "../../src/schema/library.js";
import { writeZip } from "./zip-writer.js";

/**
 * Integration tests for the ingest worker (specs/017-ingestion-pipeline
 * T023) against a REAL Postgres and the FAKE ai-gateway provider — never a
 * real provider or key. Loud-skip harness copied from
 * library/store.integration.test.ts.
 */

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const db = databaseUrl ? createDb(databaseUrl) : undefined;
const reachable = db ? await probeReachable(db.$client, 2000) : false;

if (!reachable) {
  const notice =
    `\n⚠️  SKIPPING apps/server/test/library/worker.integration.test.ts — no reachable ` +
    `database (tried TEST_DATABASE_URL then DATABASE_URL; got ${databaseUrl ?? "<unset>"}). ` +
    `These are the ingestion worker integration tests (spec 017 Phase 4 US1); a skip here ` +
    `proves NOTHING about the extract/parse/store/embed pipeline. Start one with: ` +
    `pnpm env:up, then set TEST_DATABASE_URL=postgres://<user>:<pass>@localhost:<DB_PORT>/<db>\n`;
  console.warn(notice);
  if (process.env.REQUIRE_DATABASE === "1") throw new Error(notice);
}

function requireDb() {
  if (!db) {
    throw new Error("worker integration tests require a reachable database");
  }
  return db;
}

afterAll(async () => {
  await db?.$client.end();
});

let bookCounter = 0;
function freshBook(label: string): string {
  bookCounter += 1;
  return `${label} ${Date.now()}-${bookCounter}`;
}

function ddbPage(title: string, paragraph: string): string {
  return `<!doctype html><html><body><div class="p-article-content"><h1>${title}</h1><p>${paragraph}</p></div></body></html>`;
}

/** Wires a gateway to one FakeProvider under the "embedding" purpose (op: embed). */
function buildFakeGateway() {
  const provider = new FakeProvider();
  const config: AiConfig = {
    providers: { fake: { kind: "fake", baseUrl: "http://fake/embedding" } },
    purposes: {
      embedding: { provider: "fake", model: "fake-embed-1", op: "embed" },
    },
    prices: {},
  };
  const gateway = createGateway({
    config,
    sink: { record: () => {} },
    adapters: { fake: () => provider },
  });
  return { gateway, provider };
}

const createdDirs: string[] = [];
const createdFiles: string[] = [];
const workers: { stop(): Promise<void> }[] = [];

afterEach(async () => {
  await Promise.all(workers.splice(0).map((w) => w.stop()));
  await Promise.all(
    createdDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })),
  );
  await Promise.all(createdFiles.splice(0).map((f) => rm(f, { force: true })));
});

async function buildUploadDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ingest-worker-test-"));
  createdDirs.push(dir);
  return dir;
}

async function writeUpload(uploadDir: string, bytes: Buffer): Promise<string> {
  const p = path.join(uploadDir, `${randomUUID()}.upload`);
  await writeFile(p, bytes);
  createdFiles.push(p);
  return p;
}

/** Backdates a job's heartbeat past the lease, simulating a dead worker (T029). */
async function ageHeartbeat(id: string, secondsAgo: number) {
  await requireDb().execute(
    sql`UPDATE jobs SET heartbeat_at = now() - (interval '1 second' * ${secondsAgo}) WHERE id = ${id}`,
  );
}

async function waitForTerminal(jobId: string, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const job = await getJob(requireDb(), jobId);
    if (!job) throw new Error("job disappeared");
    if (job.status === "succeeded" || job.status === "failed") return job;
    if (Date.now() > deadline)
      throw new Error(`job ${jobId} never finished (status ${job.status})`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

describe.skipIf(!reachable)("ingest worker (Phase 4, integration)", () => {
  it("T023: a synthetic MM-shaped zip succeeds as a DDB-parsed, chunked, embedded book", async () => {
    const uploadDir = await buildUploadDir();
    const { gateway, provider } = buildFakeGateway();
    const worker = startIngestWorker({
      db: requireDb(),
      gateway,
      embedPurpose: "embedding",
      uploadDir,
    });
    workers.push(worker);

    const zip = writeZip([
      {
        name: "Chapter 1/monsters.html",
        data: ddbPage("Monsters", "Full of monsters."),
      },
      { name: "Chapter 1/monsters_files/asset", data: "binary" },
      { name: "__MACOSX/Chapter 1/._monsters.html", data: "resource fork" },
      { name: ".DS_Store", data: "ds store" },
    ]);
    const uploadPath = await writeUpload(uploadDir, zip);
    const book = freshBook("MM Shape");
    const queued = await enqueueIngest(requireDb(), {
      book,
      format: "zip",
      filename: "mm.zip",
      bytes: zip.length,
      uploadPath,
    });
    worker.nudge();
    const finished = await waitForTerminal(queued.id);

    expect(finished.status).toBe("succeeded");
    expect(finished.result?.parser).toBe("ddb");
    const expectedChunks = chunkBook(
      parseDdbExport({
        book,
        pages: [ddbPage("Monsters", "Full of monsters.")],
      }),
    ).blocks.length;
    expect(finished.result?.chunkCount).toBe(expectedChunks);

    const documentId = finished.result?.documentId as string;
    const [document] = await requireDb()
      .select({ text: libraryDocuments.text })
      .from(libraryDocuments)
      .where(eq(libraryDocuments.id, documentId));
    const chunks = await requireDb()
      .select()
      .from(libraryChunks)
      .where(eq(libraryChunks.documentId, documentId))
      .orderBy(asc(libraryChunks.ordinal));
    expect(chunks).toHaveLength(expectedChunks);
    for (const chunk of chunks) {
      expect(document.text.slice(chunk.startOffset, chunk.endOffset)).toBe(
        chunk.text,
      );
    }

    const embeddings = await requireDb()
      .select()
      .from(libraryEmbeddings)
      .where(eq(libraryEmbeddings.chunkId, chunks[0].id));
    expect(embeddings).toHaveLength(1);
    expect(embeddings[0].model).toBe("fake-embed-1");
    expect(provider.embedCalls.length).toBeGreaterThan(0);
  });

  it("T023: a zip-of-zips succeeds", async () => {
    const uploadDir = await buildUploadDir();
    const { gateway } = buildFakeGateway();
    const worker = startIngestWorker({
      db: requireDb(),
      gateway,
      embedPurpose: "embedding",
      uploadDir,
    });
    workers.push(worker);

    const inner1 = writeZip([
      { name: "page.html", data: ddbPage("One", "Chapter one text.") },
    ]);
    const inner2 = writeZip([
      { name: "page.html", data: ddbPage("Two", "Chapter two text.") },
    ]);
    const zip = writeZip([
      { name: "01 - One.zip", data: inner1, method: "deflate" },
      { name: "02 - Two.zip", data: inner2, method: "deflate" },
    ]);
    const uploadPath = await writeUpload(uploadDir, zip);
    const book = freshBook("Zip Of Zips");
    const queued = await enqueueIngest(requireDb(), {
      book,
      format: "zip",
      filename: "combo.zip",
      bytes: zip.length,
      uploadPath,
    });
    worker.nudge();
    const finished = await waitForTerminal(queued.id);

    expect(finished.status).toBe("succeeded");
    expect(finished.result?.pages).toBe(2);
  });

  it("T023: a single HTML page succeeds", async () => {
    const uploadDir = await buildUploadDir();
    const { gateway } = buildFakeGateway();
    const worker = startIngestWorker({
      db: requireDb(),
      gateway,
      embedPurpose: "embedding",
      uploadDir,
    });
    workers.push(worker);

    const html = Buffer.from(ddbPage("Solo Page", "Solo page text."), "utf8");
    const uploadPath = await writeUpload(uploadDir, html);
    const book = freshBook("Single Page");
    const queued = await enqueueIngest(requireDb(), {
      book,
      format: "html",
      filename: "page.html",
      bytes: html.length,
      uploadPath,
    });
    worker.nudge();
    const finished = await waitForTerminal(queued.id);

    expect(finished.status).toBe("succeeded");
    expect(finished.result?.parser).toBe("ddb");
    expect(finished.result?.pages).toBe(1);
  });

  it("T027: a plain (non-DDB) HTML page succeeds, parser html, headings promoted", async () => {
    const uploadDir = await buildUploadDir();
    const { gateway } = buildFakeGateway();
    const worker = startIngestWorker({
      db: requireDb(),
      gateway,
      embedPurpose: "embedding",
      uploadDir,
    });
    workers.push(worker);

    const html =
      "<!doctype html><html><body><h1>Guide</h1><p>Intro.</p>" +
      "<h2>Section</h2><p>Body.</p></body></html>";
    const uploadPath = await writeUpload(uploadDir, Buffer.from(html, "utf8"));
    const book = freshBook("Generic HTML");
    const queued = await enqueueIngest(requireDb(), {
      book,
      format: "html",
      filename: "page.html",
      bytes: Buffer.byteLength(html),
      uploadPath,
    });
    worker.nudge();
    const finished = await waitForTerminal(queued.id);

    expect(finished.status).toBe("succeeded");
    expect(finished.result?.parser).toBe("html");
    const documentId = finished.result?.documentId as string;
    const chunks = await requireDb()
      .select({ path: libraryChunks.path })
      .from(libraryChunks)
      .where(eq(libraryChunks.documentId, documentId));
    expect(chunks.some((c) => (c.path as string[]).includes("Section"))).toBe(
      true,
    );
  });

  it("T027: a Markdown file succeeds, parser markdown", async () => {
    const uploadDir = await buildUploadDir();
    const { gateway } = buildFakeGateway();
    const worker = startIngestWorker({
      db: requireDb(),
      gateway,
      embedPurpose: "embedding",
      uploadDir,
    });
    workers.push(worker);

    const markdown = "# Guide\n\nIntro.\n\n## Section\n\nBody text.";
    const uploadPath = await writeUpload(
      uploadDir,
      Buffer.from(markdown, "utf8"),
    );
    const book = freshBook("Markdown Book");
    const queued = await enqueueIngest(requireDb(), {
      book,
      format: "markdown",
      filename: "book.md",
      bytes: Buffer.byteLength(markdown),
      uploadPath,
    });
    worker.nudge();
    const finished = await waitForTerminal(queued.id);

    expect(finished.status).toBe("succeeded");
    expect(finished.result?.parser).toBe("markdown");
    expect(finished.result?.pages).toBe(1);
  });

  it("T023: a re-upload of the same book replaces it, with identical counts and no duplicate embeddings", async () => {
    const uploadDir = await buildUploadDir();
    const { gateway } = buildFakeGateway();
    const worker = startIngestWorker({
      db: requireDb(),
      gateway,
      embedPurpose: "embedding",
      uploadDir,
    });
    workers.push(worker);

    const book = freshBook("Replace Me");
    const html = Buffer.from(ddbPage("Version", "First version."), "utf8");

    const first = await enqueueIngest(requireDb(), {
      book,
      format: "html",
      filename: "page.html",
      bytes: html.length,
      uploadPath: await writeUpload(uploadDir, html),
    });
    worker.nudge();
    const firstFinished = await waitForTerminal(first.id);
    expect(firstFinished.status).toBe("succeeded");
    expect(firstFinished.result?.replaced).toBe(false);

    const second = await enqueueIngest(requireDb(), {
      book,
      format: "html",
      filename: "page.html",
      bytes: html.length,
      uploadPath: await writeUpload(uploadDir, html),
    });
    worker.nudge();
    const secondFinished = await waitForTerminal(second.id);
    expect(secondFinished.status).toBe("succeeded");
    expect(secondFinished.result?.replaced).toBe(true);
    expect(secondFinished.result?.chunkCount).toBe(
      firstFinished.result?.chunkCount,
    );

    const documentId = secondFinished.result?.documentId as string;
    const chunks = await requireDb()
      .select({ id: libraryChunks.id })
      .from(libraryChunks)
      .where(eq(libraryChunks.documentId, documentId));
    const embeddings = await requireDb()
      .select()
      .from(libraryEmbeddings)
      .where(eq(libraryEmbeddings.chunkId, chunks[0].id));
    expect(embeddings).toHaveLength(1);
  });

  it("T023: embedPurpose null succeeds with embedding.status skipped", async () => {
    const uploadDir = await buildUploadDir();
    const { gateway } = buildFakeGateway();
    const worker = startIngestWorker({
      db: requireDb(),
      gateway,
      embedPurpose: null,
      uploadDir,
    });
    workers.push(worker);

    const html = Buffer.from(ddbPage("No Embed", "Text."), "utf8");
    const uploadPath = await writeUpload(uploadDir, html);
    const queued = await enqueueIngest(requireDb(), {
      book: freshBook("No Embed Purpose"),
      format: "html",
      filename: "page.html",
      bytes: html.length,
      uploadPath,
    });
    worker.nudge();
    const finished = await waitForTerminal(queued.id);

    expect(finished.status).toBe("succeeded");
    expect(finished.result?.embedding).toEqual({
      status: "skipped",
      reason: "no embedding purpose configured",
    });
  });

  it("T023: a gateway error fails the job at stage embed; chunks stay stored", async () => {
    const uploadDir = await buildUploadDir();
    const { gateway, provider } = buildFakeGateway();
    provider.scriptEmbed({ error: new Error("gateway boom") });
    const worker = startIngestWorker({
      db: requireDb(),
      gateway,
      embedPurpose: "embedding",
      uploadDir,
    });
    workers.push(worker);

    const html = Buffer.from(
      ddbPage("Fails", "Unique fixture marker XYZZY."),
      "utf8",
    );
    const uploadPath = await writeUpload(uploadDir, html);
    const queued = await enqueueIngest(requireDb(), {
      book: freshBook("Gateway Error"),
      format: "html",
      filename: "page.html",
      bytes: html.length,
      uploadPath,
    });
    worker.nudge();
    const finished = await waitForTerminal(queued.id);

    expect(finished.status).toBe("failed");
    expect(finished.error).toBe("Ingestion failed at stage embed.");
    expect(finished.error).not.toContain("XYZZY");
    expect(finished.error).not.toContain("gateway boom");
  });

  it("T023: an empty zip fails with 'No HTML or Markdown pages found in the upload.'", async () => {
    const uploadDir = await buildUploadDir();
    const { gateway } = buildFakeGateway();
    const worker = startIngestWorker({
      db: requireDb(),
      gateway,
      embedPurpose: "embedding",
      uploadDir,
    });
    workers.push(worker);

    const zip = writeZip([{ name: "README.txt", data: "not a page" }]);
    const uploadPath = await writeUpload(uploadDir, zip);
    const queued = await enqueueIngest(requireDb(), {
      book: freshBook("Empty Zip"),
      format: "zip",
      filename: "empty.zip",
      bytes: zip.length,
      uploadPath,
    });
    worker.nudge();
    const finished = await waitForTerminal(queued.id);

    expect(finished.status).toBe("failed");
    expect(finished.error).toBe(
      "No HTML or Markdown pages found in the upload.",
    );
  });

  it("T023: the upload file and job dir are deleted after both terminal states", async () => {
    const uploadDir = await buildUploadDir();
    const { gateway, provider } = buildFakeGateway();
    const worker = startIngestWorker({
      db: requireDb(),
      gateway,
      embedPurpose: "embedding",
      uploadDir,
    });
    workers.push(worker);

    // succeeded
    const okHtml = Buffer.from(ddbPage("Cleanup Ok", "Text."), "utf8");
    const okPath = await writeUpload(uploadDir, okHtml);
    const ok = await enqueueIngest(requireDb(), {
      book: freshBook("Cleanup Ok"),
      format: "html",
      filename: "page.html",
      bytes: okHtml.length,
      uploadPath: okPath,
    });
    worker.nudge();
    await waitForTerminal(ok.id);
    await expect(readFile(okPath)).rejects.toThrow();

    // failed
    provider.scriptEmbed({ error: new Error("boom") });
    const failHtml = Buffer.from(ddbPage("Cleanup Fail", "Text."), "utf8");
    const failPath = await writeUpload(uploadDir, failHtml);
    const failed = await enqueueIngest(requireDb(), {
      book: freshBook("Cleanup Fail"),
      format: "html",
      filename: "page.html",
      bytes: failHtml.length,
      uploadPath: failPath,
    });
    worker.nudge();
    await waitForTerminal(failed.id);
    await expect(readFile(failPath)).rejects.toThrow();
  });

  it("T029: a stale claim (dead process) is reclaimed and completed; the stale claim's writes are refused", async () => {
    const uploadDir = await buildUploadDir();
    const { gateway } = buildFakeGateway();

    const book = freshBook("Crash Recovery");
    const html = ddbPage("Recovered", "Recovered page text.");
    const uploadPath = await writeUpload(uploadDir, Buffer.from(html, "utf8"));
    const queued = await enqueueIngest(requireDb(), {
      book,
      format: "html",
      filename: "page.html",
      bytes: Buffer.byteLength(html),
      uploadPath,
    });

    // Simulate a worker process that claimed the job and then died: claim
    // it directly (not via startIngestWorker), age its heartbeat past the
    // lease, and never heartbeat or finish it again.
    const staleClaim = await claimJob(requireDb());
    if (!staleClaim || staleClaim.id !== queued.id) {
      throw new Error("expected to claim the job just enqueued");
    }
    await ageHeartbeat(staleClaim.id, 61);

    const worker = startIngestWorker({
      db: requireDb(),
      gateway,
      embedPurpose: "embedding",
      uploadDir,
    });
    workers.push(worker);
    worker.nudge();
    const finished = await waitForTerminal(queued.id);

    expect(finished.status).toBe("succeeded");
    expect(finished.attempts).toBe(2);
    const expectedChunks = chunkBook(parseDdbExport({ book, pages: [html] }))
      .blocks.length;
    expect(finished.result?.chunkCount).toBe(expectedChunks);
    expect(finished.result?.embedding).toMatchObject({ status: "embedded" });

    // The stale claim's own writes are fenced out (research R6): it lost
    // the lease, so its finishJob returns false and changes nothing.
    const stillOk = await finishJob(requireDb(), staleClaim, {
      error: "stale worker should not be able to write this",
    });
    expect(stillOk).toBe(false);
    const afterStaleWrite = await getJob(requireDb(), queued.id);
    expect(afterStaleWrite?.status).toBe("succeeded");
    expect(afterStaleWrite?.error).toBeNull();
  });

  it("T029: the fourth claim (attempts > 3) fails the job as abandoned and deletes its upload file", async () => {
    const uploadDir = await buildUploadDir();
    const html = ddbPage("Abandoned", "Abandoned page text.");
    const uploadPath = await writeUpload(uploadDir, Buffer.from(html, "utf8"));
    const queued = await enqueueIngest(requireDb(), {
      book: freshBook("Abandoned"),
      format: "html",
      filename: "page.html",
      bytes: Buffer.byteLength(html),
      uploadPath,
    });

    // Claim and age the heartbeat three times, simulating three crashed
    // attempts, never letting the job finish.
    for (let attempt = 1; attempt <= 3; attempt++) {
      const claimed = await claimJob(requireDb());
      if (!claimed || claimed.id !== queued.id) {
        throw new Error(`expected to claim on attempt ${attempt}`);
      }
      await ageHeartbeat(claimed.id, 61);
    }

    // The fourth claim finds attempts now at 4 (> MAX_ATTEMPTS): it marks
    // the job failed instead of handing it to a caller.
    const fourth = await claimJob(requireDb());
    expect(fourth).toBeNull();

    const finalJob = await getJob(requireDb(), queued.id);
    expect(finalJob?.status).toBe("failed");
    expect(finalJob?.error).toBe("abandoned 3 times (process died mid-job)");
    await expect(readFile(uploadPath)).rejects.toThrow();
  });
});
