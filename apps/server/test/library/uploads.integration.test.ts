import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { serve } from "@hono/node-server";
import { afterAll, describe, expect, it } from "vitest";
import type { App } from "../../src/app.js";
import { createApp } from "../../src/app.js";
import { hashPassword } from "../../src/auth/password.js";
import { createDb, probeReachable } from "../../src/db.js";
import type { ErrorResponseBody } from "../../src/errors.js";
import type { JobStatus } from "../../src/library/ingest/jobs.js";
import { users } from "../../src/schema/auth.js";

/**
 * Integration tests for `POST /library/uploads` (specs/017-ingestion-pipeline
 * Phase 2, T012/T013) against a REAL Postgres — streaming to disk, the
 * ceiling, and the `jobs_active_book_key` conflict all need real behavior a
 * fake can't reproduce. Loud-skip harness copied from auth.integration.test.ts.
 */

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const db = databaseUrl ? createDb(databaseUrl) : undefined;
const reachable = db ? await probeReachable(db.$client, 2000) : false;

if (!reachable) {
  const notice =
    `\n⚠️  SKIPPING apps/server/test/library/uploads.integration.test.ts — no reachable ` +
    `database (tried TEST_DATABASE_URL then DATABASE_URL; got ${databaseUrl ?? "<unset>"}). ` +
    `These are the ingestion upload route integration tests (spec 017 Phase 2 US2); a skip ` +
    `here proves NOTHING about streaming, the size ceiling, or cleanup. Start one with: ` +
    `pnpm env:up, then set TEST_DATABASE_URL=postgres://<user>:<pass>@localhost:<DB_PORT>/<db>\n`;
  console.warn(notice);
  if (process.env.REQUIRE_DATABASE === "1") throw new Error(notice);
}

function requireDb() {
  if (!db) {
    throw new Error("uploads integration tests require a reachable database");
  }
  return db;
}

afterAll(async () => {
  await db?.$client.end();
});

let bookCounter = 0;
/** A fresh book name per test — `jobs_active_book_key` is unique on active jobs. */
function freshBook(label: string): string {
  bookCounter += 1;
  return `${label} ${Date.now()}-${bookCounter}`;
}

/** Builds a full multipart body from `FormData` the way a real client would. */
async function toMultipart(
  fd: FormData,
): Promise<{ contentType: string; bytes: Uint8Array }> {
  const probe = new Request("http://upload.test", { method: "POST", body: fd });
  const contentType = probe.headers.get("content-type") as string;
  const bytes = new Uint8Array(await probe.arrayBuffer());
  return { contentType, bytes };
}

function fileFormData(
  book: string | undefined,
  opts: {
    fieldName?: string;
    filename?: string;
    content?: string;
    order?: "book-first" | "file-first";
  } = {},
): FormData {
  const fd = new FormData();
  const appendFile = () =>
    fd.append(
      opts.fieldName ?? "file",
      new Blob([opts.content ?? "<html><body>hi</body></html>"], {
        type: "text/html",
      }),
      opts.filename ?? "book.html",
    );
  const appendBook = () => {
    if (book !== undefined) fd.append("book", book);
  };
  if (opts.order === "file-first") {
    appendFile();
    appendBook();
  } else {
    appendBook();
    appendFile();
  }
  return fd;
}

describe.skipIf(!reachable)("POST /library/uploads (US2, integration)", () => {
  const createdDirs: string[] = [];

  afterAll(async () => {
    await Promise.all(
      createdDirs.map((dir) => rm(dir, { recursive: true, force: true })),
    );
  });

  /**
   * Each test gets its OWN upload dir — several tests assert the dir holds
   * no stray file, which only means something if earlier tests' legitimate
   * (202) uploads can't leave files a later test would see.
   */
  async function buildApp(uploadMaxBytes = 1_073_741_824) {
    const uploadDir = await mkdtemp(
      path.join(os.tmpdir(), "stacks-uploads-test-"),
    );
    createdDirs.push(uploadDir);
    const app = createApp({
      databaseProbe: { reachable: async () => true },
      db: requireDb(),
      library: { uploadMaxBytes, uploadDir, onEnqueued: () => {} },
    });
    return { app, uploadDir };
  }

  // sign-in exercises the real route rather than seeding a session row by
  // hand, matching auth.integration.test.ts's pattern.
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

  async function upload(
    app: App,
    cookie: string | undefined,
    fd: FormData,
    headerOverrides: Record<string, string> = {},
  ) {
    const { contentType, bytes } = await toMultipart(fd);
    return app.request("/library/uploads", {
      method: "POST",
      headers: {
        ...(cookie ? { cookie } : {}),
        "content-type": contentType,
        "content-length": String(bytes.length),
        ...headerOverrides,
      },
      body: bytes,
    });
  }

  it("401 without a session", async () => {
    const { app } = await buildApp();
    const res = await upload(app, undefined, fileFormData(freshBook("Auth")));
    expect(res.status).toBe(401);
  });

  it("403 for a player", async () => {
    const { app } = await buildApp();
    const cookie = await signInCookie(app, "player");
    const res = await upload(app, cookie, fileFormData(freshBook("Player")));
    expect(res.status).toBe(403);
  });

  it("400 for a non-multipart body", async () => {
    const { app } = await buildApp();
    const cookie = await operatorCookie(app);
    const res = await app.request("/library/uploads", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ book: "x" }),
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorResponseBody).error.kind).toBe(
      "validation",
    );
  });

  it("400 for a missing book field", async () => {
    const { app, uploadDir } = await buildApp();
    const cookie = await operatorCookie(app);
    const res = await upload(app, cookie, fileFormData(undefined));
    expect(res.status).toBe(400);
    expect(await readdir(uploadDir)).toEqual([]);
  });

  it("400 for a missing file part", async () => {
    const { app } = await buildApp();
    const cookie = await operatorCookie(app);
    const fd = new FormData();
    fd.append("book", freshBook("No File"));
    const res = await upload(app, cookie, fd);
    expect(res.status).toBe(400);
  });

  it("400 for a file part under another name", async () => {
    const { app, uploadDir } = await buildApp();
    const cookie = await operatorCookie(app);
    const res = await upload(
      app,
      cookie,
      fileFormData(freshBook("Wrong Name"), { fieldName: "attachment" }),
    );
    expect(res.status).toBe(400);
    expect(await readdir(uploadDir)).toEqual([]);
  });

  it("400 for two file parts", async () => {
    const { app, uploadDir } = await buildApp();
    const cookie = await operatorCookie(app);
    const fd = new FormData();
    fd.append("book", freshBook("Two Files"));
    fd.append("file", new Blob(["one"], { type: "text/html" }), "a.html");
    fd.append("file", new Blob(["two"], { type: "text/html" }), "b.html");
    const res = await upload(app, cookie, fd);
    expect(res.status).toBe(400);
    expect(await readdir(uploadDir)).toEqual([]);
  });

  it("400 for an empty file", async () => {
    const { app, uploadDir } = await buildApp();
    const cookie = await operatorCookie(app);
    const res = await upload(
      app,
      cookie,
      fileFormData(freshBook("Empty File"), { content: "" }),
    );
    expect(res.status).toBe(400);
    expect(await readdir(uploadDir)).toEqual([]);
  });

  it("202 with a queued job when `book` is sent after the file part", async () => {
    const { app } = await buildApp();
    const cookie = await operatorCookie(app);
    const book = freshBook("Book After File");
    const content = "<html><body>Hello, adventurer.</body></html>";
    const res = await upload(
      app,
      cookie,
      fileFormData(book, {
        order: "file-first",
        content,
        filename: "the-book.html",
      }),
    );
    expect(res.status).toBe(202);
    const { job } = (await res.json()) as { job: JobStatus };
    expect(job.status).toBe("queued");
    expect(job.book).toBe(book);
    expect(job.filename).toBe("the-book.html");
    expect(job.format).toBe("html");
    expect(job.bytes).toBe(Buffer.byteLength(content));
  });

  it("format detection: a zip signature is reported as zip", async () => {
    const { app } = await buildApp();
    const cookie = await operatorCookie(app);
    const zipBytes = "PK\x03\x04 not a real zip, but the signature is enough";
    const res = await upload(
      app,
      cookie,
      fileFormData(freshBook("Zip Signature"), {
        content: zipBytes,
        filename: "book.zip",
      }),
    );
    expect(res.status).toBe(202);
    const { job } = (await res.json()) as { job: JobStatus };
    expect(job.format).toBe("zip");
  });

  it("format detection: a .md filename with non-zip content is reported as markdown", async () => {
    const { app } = await buildApp();
    const cookie = await operatorCookie(app);
    const res = await upload(
      app,
      cookie,
      fileFormData(freshBook("Markdown"), {
        content: "# Heading\n\nBody.",
        filename: "book.md",
      }),
    );
    expect(res.status).toBe(202);
    const { job } = (await res.json()) as { job: JobStatus };
    expect(job.format).toBe("markdown");
  });

  it("409 on a second upload of the same book while the first is still active", async () => {
    const { app } = await buildApp();
    const cookie = await operatorCookie(app);
    const book = freshBook("Duplicate");
    const first = await upload(app, cookie, fileFormData(book));
    expect(first.status).toBe(202);

    const second = await upload(app, cookie, fileFormData(book.toUpperCase()));
    expect(second.status).toBe(409);
    expect(((await second.json()) as ErrorResponseBody).error.kind).toBe(
      "conflict",
    );
  });

  it("413 from Content-Length alone, reading no body and leaving no file", async () => {
    const { app, uploadDir } = await buildApp();
    const cookie = await operatorCookie(app);
    const fd = fileFormData(freshBook("Content-Length 413"));
    // A tiny real body, but a Content-Length header that lies about being
    // huge — the route must refuse from the header alone, never the body
    // (contract guarantee 3).
    const res = await upload(app, cookie, fd, {
      "content-length": String(2 * 1024 * 1024 * 1024),
    });
    expect(res.status).toBe(413);
    expect(((await res.json()) as ErrorResponseBody).error.kind).toBe(
      "too_large",
    );
    expect(await readdir(uploadDir)).toEqual([]);
  });

  it("413 mid-stream when the file part's streamed bytes exceed the ceiling (no Content-Length precheck involved)", async () => {
    const { app: smallCeilingApp, uploadDir } = await buildApp(1024); // 1 KiB ceiling
    const cookie = await operatorCookie(smallCeilingApp);
    // 8 MiB of real streamed content — large enough that only a genuinely
    // streaming ceiling (busboy's limits.fileSize), not a buffered read,
    // could catch it before OOMing a small ceiling's worth of memory.
    const bigContent = "a".repeat(8 * 1024 * 1024);
    const fd = fileFormData(freshBook("Mid-stream 413"), {
      content: bigContent,
    });
    const { contentType, bytes } = await toMultipart(fd);
    // Omit content-length to exercise the streamed (chunked-like) path
    // rather than the pre-read Content-Length check.
    const res = await smallCeilingApp.request("/library/uploads", {
      method: "POST",
      headers: { cookie, "content-type": contentType },
      body: bytes,
    });
    expect(res.status).toBe(413);
    expect(await readdir(uploadDir)).toEqual([]);
  });

  it("a client abort mid-stream (no closing boundary) leaves no file and no job", async () => {
    const { app, uploadDir } = await buildApp();
    const cookie = await operatorCookie(app);
    const fd = fileFormData(freshBook("Client Abort"), {
      content: "x".repeat(5000),
    });
    const { contentType, bytes } = await toMultipart(fd);
    const truncated = bytes.slice(0, bytes.length - 50); // drop the closing boundary
    const res = await app.request("/library/uploads", {
      method: "POST",
      headers: {
        cookie,
        "content-type": contentType,
        "content-length": String(truncated.length),
      },
      body: truncated,
    });
    expect(res.status).not.toBe(202);
    expect(await readdir(uploadDir)).toEqual([]);
  });

  it("T013 (heavy): a large streamed upload lands intact with bounded memory growth", async () => {
    const { app } = await buildApp();
    const cookie = await operatorCookie(app);

    const TOTAL_FILE_BYTES = 320 * 1024 * 1024;
    const CHUNK = 1024 * 1024;
    const filler = Buffer.alloc(CHUNK, 0x61);
    const boundary = `streamtest${randomUUID().replace(/-/g, "")}`;
    const book = freshBook("Streaming Memory");
    const preamble = Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="book"\r\n\r\n${book}\r\n` +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="big.html"\r\n` +
        `Content-Type: text/html\r\n\r\n`,
    );
    const epilogue = Buffer.from(`\r\n--${boundary}--\r\n`);

    let phase: "preamble" | "file" | "epilogue" | "done" = "preamble";
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (phase === "preamble") {
          controller.enqueue(preamble);
          phase = "file";
          return;
        }
        if (phase === "file") {
          if (sent >= TOTAL_FILE_BYTES) {
            phase = "epilogue";
            return;
          }
          const n = Math.min(CHUNK, TOTAL_FILE_BYTES - sent);
          controller.enqueue(n === CHUNK ? filler : filler.subarray(0, n));
          sent += n;
          return;
        }
        controller.enqueue(epilogue);
        phase = "done";
        controller.close();
      },
    });

    const server = serve({ fetch: app.fetch, port: 0 });
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    const port = address && typeof address === "object" ? address.port : 0;

    let peakRss = process.memoryUsage().rss;
    const sampler = setInterval(() => {
      peakRss = Math.max(peakRss, process.memoryUsage().rss);
    }, 50);
    const baselineRss = process.memoryUsage().rss;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/library/uploads`, {
        method: "POST",
        headers: {
          cookie,
          "content-type": `multipart/form-data; boundary=${boundary}`,
        },
        body,
        duplex: "half",
      });
      expect(res.status).toBe(202);
      const { job } = (await res.json()) as { job: JobStatus };
      expect(job.bytes).toBe(TOTAL_FILE_BYTES);

      const deltaMb = (peakRss - baselineRss) / (1024 * 1024);
      expect(deltaMb).toBeLessThan(64);
    } finally {
      clearInterval(sampler);
      await new Promise((resolve) => server.close(resolve));
    }
  }, 120_000);
});
