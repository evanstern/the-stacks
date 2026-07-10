/**
 * T002/T016 (DB-gated): the library-listing contract (009 contracts/api.md) —
 * GET /api/uploads returns one newest-first page of SUBMISSIONS (standalone
 * sources + batches; batch members excluded, research R2) in a
 * {items,total,limit,offset} envelope, session-guarded like every route.
 *
 * TDD order: this file lands BEFORE apps/api/src/ingestion/list.ts exists —
 * every test here fails 404 until T004 registers the route.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createDbClient, runMigrations } from "@stacks/db";
import bcrypt from "bcrypt";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://stacks_v3:stacks_v3@localhost:5442/stacks_v3";
const PASSWORD = "correct-password";

const FIXTURES = join(__dirname, "..", "..", "..", "packages", "ingestion-plugins", "fixtures");
const GOBLIN = readFileSync(join(FIXTURES, "ddb", "goblin-page.html"));
const NOTES = readFileSync(join(FIXTURES, "markdown", "notes.md"));
const ZIP = readFileSync(join(FIXTURES, "zips", "export-mixed.zip"));

function multipartBody(filename: string, content: Buffer) {
  const boundary = "----stacks-test-boundary";
  return {
    payload: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\ncontent-disposition: form-data; name="file"; filename="${filename}"\r\ncontent-type: application/octet-stream\r\n\r\n`,
      ),
      content,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}

interface ListItem {
  kind: "source" | "batch";
  id: string;
  originalFilename: string;
  status: string;
  createdAt: string;
}

interface ListPage {
  items: ListItem[];
  total: number;
  limit: number;
  offset: number;
}

describe.skipIf(!process.env.RUN_DB_INTEGRATION_TESTS)("library listing contract", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let close: () => Promise<void>;
  let cookie: string;

  beforeAll(async () => {
    const { db, pool } = createDbClient(DATABASE_URL);
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

  async function upload(filename: string, content: Buffer): Promise<{ kind: string; id: string }> {
    const { payload, headers } = multipartBody(filename, content);
    const res = await app.inject({
      method: "POST",
      url: "/api/uploads",
      payload,
      headers: { ...headers, cookie },
    });
    return (res.json() as { ticket: { kind: string; id: string } }).ticket;
  }

  async function list(query = ""): Promise<{ status: number; body: ListPage }> {
    const res = await app.inject({ method: "GET", url: `/api/uploads${query}`, headers: { cookie } });
    return { status: res.statusCode, body: res.json() as ListPage };
  }

  it("empty library answers 200 with an empty page, not an error (FR-007)", async () => {
    const { status, body } = await list();
    expect(status).toBe(200);
    expect(body).toMatchObject({ items: [], total: 0, limit: 50, offset: 0 });
  });

  it("lists submissions newest first with the ticket identity fields (FR-002/FR-003)", async () => {
    const first = await upload("goblin.html", GOBLIN);
    const second = await upload("spell-notes.md", NOTES);
    const third = await upload("export-mixed.zip", ZIP);
    // createdAt can collide within a millisecond; pin an unambiguous order so
    // the DESC assertion tests the ORDER BY, not the clock.
    await app.deps.pool.query("UPDATE sources SET created_at = created_at - interval '2 minutes' WHERE id = $1", [first.id]);
    await app.deps.pool.query("UPDATE sources SET created_at = created_at - interval '1 minute' WHERE id = $1", [second.id]);

    const { status, body } = await list();
    expect(status).toBe(200);
    expect(body.total).toBe(3);
    expect(body.items.map((i) => ({ kind: i.kind, id: i.id }))).toEqual([
      { kind: "batch", id: third.id },
      { kind: "source", id: second.id },
      { kind: "source", id: first.id },
    ]);
    // Every row carries what a listing row needs to be recognized and linked.
    for (const item of body.items) {
      expect(item.originalFilename).toBeTruthy();
      expect(item.status).toBeTruthy();
      expect(item.createdAt).toBeTruthy();
    }
  });

  it("excludes batch members: rows are what the operator SUBMITTED (research R2)", async () => {
    const batch = await upload("export-mixed.zip", ZIP);
    // Simulate the expand worker having materialized a member source.
    await app.deps.pool.query(
      `INSERT INTO source_archives (fingerprint, bytes, byte_size, media_type)
       VALUES ('member-fp', '\\x00', 1, 'text/html')`,
    );
    await app.deps.pool.query(
      `INSERT INTO sources (corpus_id, batch_id, fingerprint, original_filename, status)
       SELECT corpus_id, $1, 'member-fp', 'member.html', 'queued' FROM batches WHERE id = $1`,
      [batch.id],
    );

    const { body } = await list();
    expect(body.total).toBe(1);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ kind: "batch", id: batch.id });
  });

  it("pages with clamped limit/offset and an honest total (FR-008)", async () => {
    await upload("goblin.html", GOBLIN);
    await upload("spell-notes.md", NOTES);
    await upload("export-mixed.zip", ZIP);

    const page = await list("?limit=2&offset=0");
    expect(page.body.items).toHaveLength(2);
    expect(page.body).toMatchObject({ total: 3, limit: 2, offset: 0 });

    const rest = await list("?limit=2&offset=2");
    expect(rest.body.items).toHaveLength(1);
    expect(rest.body.offset).toBe(2);

    // Clamps, not errors, for out-of-range numerics (contracts/api.md).
    const clamped = await list("?limit=9999");
    expect(clamped.body.limit).toBe(200);
    const floor = await list("?limit=0");
    expect(floor.body.limit).toBe(1);
  });

  it("refuses malformed paging with a typed 400, never a silent default", async () => {
    for (const query of ["?limit=nope", "?offset=-1", "?offset=half"]) {
      const res = await app.inject({
        method: "GET",
        url: `/api/uploads${query}`,
        headers: { cookie },
      });
      expect(res.statusCode, query).toBe(400);
    }
  });

  it("requires a session like every ingestion route (D13)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/uploads" });
    expect(res.statusCode).toBe(401);
  });
});
