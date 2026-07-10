/**
 * T028 (DB-gated): the intake contract (contracts/api.md) — 201 + source
 * ticket for new content with job + intake event committed atomically,
 * 201 + batch ticket for ZIPs, 200 duplicate with the EXISTING ticket, 415
 * for unsupported types with ZERO residue, and the session guard in front.
 *
 * T038 extends this file (US3 front-door hardening): fixture-backed PDF and
 * renamed-binary refusals (fixtures/rejects/, T037) and the over-cap
 * stream-abort path — all three assert zero residue (SC-005).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createDbClient,
  ensureSuiteDatabase, runMigrations } from "@stacks/db";
import bcrypt from "bcrypt";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://stacks_v3:stacks_v3@localhost:5442/stacks_v3";
const PASSWORD = "correct-password";

const FIXTURES = join(__dirname, "..", "..", "..", "packages", "ingestion-plugins", "fixtures");
const GOBLIN = readFileSync(join(FIXTURES, "ddb", "goblin-page.html"));
const MIXED_ZIP = readFileSync(join(FIXTURES, "zips", "export-mixed.zip"));
const REJECT_PDF = readFileSync(join(FIXTURES, "rejects", "sample.pdf"));
const REJECT_FAKE_HTML = readFileSync(join(FIXTURES, "rejects", "fake.html"));

/** Minimal multipart/form-data encoder for inject() — one file + fields. */
function multipartBody(
  filename: string,
  content: Buffer,
  fields: Record<string, string> = {},
): { payload: Buffer; headers: Record<string, string> } {
  const boundary = "----stacks-test-boundary";
  const parts: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\ncontent-disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      ),
    );
  }
  parts.push(
    Buffer.from(
      `--${boundary}\r\ncontent-disposition: form-data; name="file"; filename="${filename}"\r\ncontent-type: application/octet-stream\r\n\r\n`,
    ),
    content,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  );
  return {
    payload: Buffer.concat(parts),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}

describe.skipIf(!process.env.RUN_DB_INTEGRATION_TESTS)("ingestion intake contract", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let close: () => Promise<void>;
  let cookie: string;

  beforeAll(async () => {
    const { db, pool } = createDbClient(
      // TASK-8: a database of our own — beforeEach TRUNCATEs can never race
      // another package's suite (isolation by construction, not by locking).
      await ensureSuiteDatabase(DATABASE_URL, "api_intake"),
    );
    close = () => pool.end();
    await runMigrations(db);

    app = await buildApp({
      db,
      pool,
      operatorPasswordHash: bcrypt.hashSync(PASSWORD, 10),
      sessionSecret: "a".repeat(32),
      sessionCookieSecure: false,
      maxUploadBytes: 1024 * 1024,
    });
    await app.ready();

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { password: PASSWORD },
    });
    cookie = String(login.headers["set-cookie"]).split(";")[0]!;
  });

  afterAll(async () => {
    await app.close();
    await close();
  });

  beforeEach(async () => {
    await app.deps.pool.query(
      "TRUNCATE TABLE ingestion_events, chunks, document_sections, sources, batches, source_archives, jobs CASCADE",
    );
  });

  async function counts() {
    const { rows } = await app.deps.pool.query(
      `SELECT
         (SELECT count(*) FROM sources)::int AS sources,
         (SELECT count(*) FROM batches)::int AS batches,
         (SELECT count(*) FROM source_archives)::int AS archives,
         (SELECT count(*) FROM jobs WHERE kind LIKE 'ingest%')::int AS jobs`,
    );
    return rows[0] as { sources: number; batches: number; archives: number; jobs: number };
  }

  it("rejects unauthenticated uploads (session guard, D13)", async () => {
    const { payload, headers } = multipartBody("goblin.html", GOBLIN);
    const res = await app.inject({ method: "POST", url: "/api/uploads", payload, headers });
    expect(res.statusCode).toBe(401);
  });

  it("201: accepts a new HTML file — ticket, queued job, intake event, all atomic (FR-001)", async () => {
    const { payload, headers } = multipartBody("goblin.html", GOBLIN);
    const res = await app.inject({
      method: "POST",
      url: "/api/uploads",
      payload,
      headers: { ...headers, cookie },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json() as { ticket: { kind: string; id: string }; duplicate: boolean; status: string };
    expect(body.ticket.kind).toBe("source");
    expect(body.duplicate).toBe(false);
    expect(body.status).toBe("queued");

    const after = await counts();
    expect(after).toMatchObject({ sources: 1, archives: 1, jobs: 1 });

    const { rows: events } = await app.deps.pool.query(
      "SELECT stage, event, detail FROM ingestion_events WHERE source_id = $1",
      [body.ticket.id],
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ stage: "intake", event: "completed" });
  });

  it("200 + the EXISTING ticket for duplicate content, regardless of filename (FR-003/SC-003)", async () => {
    const first = multipartBody("goblin.html", GOBLIN);
    const original = await app.inject({
      method: "POST",
      url: "/api/uploads",
      payload: first.payload,
      headers: { ...first.headers, cookie },
    });
    const originalTicket = (original.json() as { ticket: { id: string } }).ticket.id;

    const renamed = multipartBody("totally-different-name.html", GOBLIN);
    const res = await app.inject({
      method: "POST",
      url: "/api/uploads",
      payload: renamed.payload,
      headers: { ...renamed.headers, cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { ticket: { id: string }; duplicate: boolean };
    expect(body.duplicate).toBe(true);
    expect(body.ticket.id).toBe(originalTicket);

    const after = await counts();
    expect(after).toMatchObject({ sources: 1, archives: 1, jobs: 1 }); // nothing new
  });

  it("201 + batch ticket for a ZIP (FR-004)", async () => {
    const { payload, headers } = multipartBody("export-mixed.zip", MIXED_ZIP);
    const res = await app.inject({
      method: "POST",
      url: "/api/uploads",
      payload,
      headers: { ...headers, cookie },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json() as { ticket: { kind: string }; status: string };
    expect(body.ticket.kind).toBe("batch");
    expect(body.status).toBe("expanding");

    const { rows } = await app.deps.pool.query(
      "SELECT kind FROM jobs WHERE kind = 'ingest_batch_expand'",
    );
    expect(rows).toHaveLength(1);
  });

  it("415 + zero residue for an unsupported type (FR-002/SC-005, T037 sample.pdf)", async () => {
    // %PDF magic — the famous deliberate 415 (PDF is out of scope for v3).
    const before = await counts();
    const { payload, headers } = multipartBody("rulebook.pdf", REJECT_PDF);
    const res = await app.inject({
      method: "POST",
      url: "/api/uploads",
      payload,
      headers: { ...headers, cookie },
    });

    expect(res.statusCode).toBe(415);
    expect((res.json() as { error: { code: string } }).error.code).toBe("unsupported_type");
    expect(await counts()).toEqual(before);
  });

  it("415 + zero residue for a renamed binary (declared-vs-actual mismatch, T037 fake.html)", async () => {
    const before = await counts();
    const { payload, headers } = multipartBody("sneaky.html", REJECT_FAKE_HTML);
    const res = await app.inject({
      method: "POST",
      url: "/api/uploads",
      payload,
      headers: { ...headers, cookie },
    });

    expect(res.statusCode).toBe(415);
    expect((res.json() as { error: { code: string } }).error.code).toBe("unsupported_type");
    expect(await counts()).toEqual(before);
  });

  it("415 + zero residue when the stream exceeds INGEST_MAX_UPLOAD_BYTES (T038, SC-005)", async () => {
    // Test app is built with maxUploadBytes = 1 MiB (see beforeAll); one byte
    // over trips @fastify/multipart's limits.fileSize mid-stream, before the
    // buffer (and therefore any row) ever completes.
    const before = await counts();
    const oversized = Buffer.alloc(1024 * 1024 + 1, "a");
    const { payload, headers } = multipartBody("giant.txt", oversized);
    const res = await app.inject({
      method: "POST",
      url: "/api/uploads",
      payload,
      headers: { ...headers, cookie },
    });

    expect(res.statusCode).toBe(415);
    expect((res.json() as { error: { code: string } }).error.code).toBe("unsupported_type");
    expect(await counts()).toEqual(before);
  });

  it("404 unknown_thing for a nonexistent corpus", async () => {
    const { payload, headers } = multipartBody("goblin.html", GOBLIN, { corpus: "ghost-corpus" });
    const res = await app.inject({
      method: "POST",
      url: "/api/uploads",
      payload,
      headers: { ...headers, cookie },
    });

    expect(res.statusCode).toBe(404);
    expect(await counts()).toMatchObject({ sources: 0, archives: 0, jobs: 0 });
  });
});
