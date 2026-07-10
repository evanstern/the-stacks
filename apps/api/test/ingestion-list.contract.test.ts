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
    const { db, pool } = createDbClient(
      // TASK-8: a database of our own — beforeEach TRUNCATEs can never race
      // another package's suite (isolation by construction, not by locking).
      await ensureSuiteDatabase(DATABASE_URL, "api_list"),
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

  // -------------------------------------------------------------------------
  // T016 (US3): evidence at a glance — the listing carries what the worker
  // recorded, and its counts obey the 008 R8 reader predicate (CURRENT
  // generation only; an aside-written next generation must be invisible).
  // Worker outcomes are seeded directly in SQL: these are read-model tests,
  // not pipeline tests — the pipeline's own suite owns those transitions.
  // -------------------------------------------------------------------------

  interface EvidenceItem extends ListItem {
    plugin: { name: string; version: string; confidence: number } | null;
    generation: number;
    counts: { sections: number; chunks: number };
    lastError: { class: string; stage: string; message: string } | null;
    entrySummary: { ingested: number; skipped: number; failed: number; total: number };
  }

  async function seedSection(sourceId: string, generation: number, index: number) {
    await app.deps.pool.query(
      `INSERT INTO document_sections (id, source_id, generation, section_index, path, kind, content, anchor)
       VALUES ($1, $2, $3, $4, '[]', 'prose', 'seeded', '{}')`,
      [`sec-${sourceId}-${generation}-${index}`, sourceId, generation, index],
    );
  }

  async function seedChunk(sourceId: string, generation: number, index: number) {
    await app.deps.pool.query(
      `INSERT INTO chunks (id, source_id, corpus_id, generation, chunk_index, content, section_ids, anchor, plugin_name, plugin_version)
       SELECT $1, $2, corpus_id, $3, $4, 'seeded', '[]', '{}', 'ddb-saved-html', '1.0.0' FROM sources WHERE id = $2`,
      [`chk-${sourceId}-${generation}-${index}`, sourceId, generation, index],
    );
  }

  it("source rows carry plugin, generation, and CURRENT-generation counts only (US3 AC-1)", async () => {
    const ticket = await upload("goblin.html", GOBLIN);
    await app.deps.pool.query(
      `UPDATE sources SET plugin_name = 'ddb-saved-html', plugin_version = '1.0.0',
         detect_confidence = 0.95, current_generation = 1, status = 'ingested' WHERE id = $1`,
      [ticket.id],
    );
    // Generation 1 is current: 2 sections, 3 chunks. Generation 2 is a
    // re-ingest being written ASIDE — the listing must not count it.
    await seedSection(ticket.id, 1, 0);
    await seedSection(ticket.id, 1, 1);
    await seedSection(ticket.id, 2, 0);
    for (let i = 0; i < 3; i++) await seedChunk(ticket.id, 1, i);
    for (let i = 0; i < 2; i++) await seedChunk(ticket.id, 2, i);

    const { body } = await list();
    const item = body.items[0] as EvidenceItem;
    expect(item.plugin).toEqual({ name: "ddb-saved-html", version: "1.0.0", confidence: 0.95 });
    expect(item.generation).toBe(1);
    expect(item.counts).toEqual({ sections: 2, chunks: 3 });
    expect(item.lastError).toBeNull();
  });

  it("a source that never reached detect shows plugin null, generation 0, zero counts", async () => {
    await upload("goblin.html", GOBLIN);
    const { body } = await list();
    const item = body.items[0] as EvidenceItem;
    expect(item.plugin).toBeNull();
    expect(item.generation).toBe(0);
    expect(item.counts).toEqual({ sections: 0, chunks: 0 });
  });

  it("failed source rows carry the scrubbed lastError with its stage (US3 AC-2)", async () => {
    const ticket = await upload("notes.md", NOTES);
    await app.deps.pool.query(
      `UPDATE sources SET status = 'failed',
         last_error = '{"class":"internal_fault","stage":"chunk","message":"seeded failure"}'::jsonb
       WHERE id = $1`,
      [ticket.id],
    );

    const { body } = await list();
    const item = body.items[0] as EvidenceItem;
    expect(item.status).toBe("failed");
    expect(item.lastError).toEqual({
      class: "internal_fault",
      stage: "chunk",
      message: "seeded failure",
    });
  });

  it("batch rows summarize entry outcomes without being opened (US3 AC-3)", async () => {
    const ticket = await upload("export-mixed.zip", ZIP);
    // Expand admitted two entries and skipped one; of the admitted members,
    // one ingested and one later failed its pipeline. The summary must read
    // member STATUSES for ingested/failed — the report alone can't say.
    await app.deps.pool.query(
      `INSERT INTO source_archives (fingerprint, bytes, byte_size, media_type)
       VALUES ('member-a', '\\x00', 1, 'text/html'), ('member-b', '\\x01', 1, 'text/html')`,
    );
    await app.deps.pool.query(
      `INSERT INTO sources (corpus_id, batch_id, fingerprint, original_filename, status)
       SELECT corpus_id, $1, 'member-a', 'a.html', 'ingested' FROM batches WHERE id = $1`,
      [ticket.id],
    );
    await app.deps.pool.query(
      `INSERT INTO sources (corpus_id, batch_id, fingerprint, original_filename, status)
       SELECT corpus_id, $1, 'member-b', 'c.html', 'failed' FROM batches WHERE id = $1`,
      [ticket.id],
    );
    await app.deps.pool.query(
      `UPDATE batches SET status = 'expanded', entry_report =
         '[{"name":"a.html","outcome":"ingested"},{"name":"b.pdf","outcome":"skipped","reason":"unsupported"},{"name":"c.html","outcome":"ingested"}]'::jsonb
       WHERE id = $1`,
      [ticket.id],
    );

    const { body } = await list();
    const item = body.items.find((entry) => entry.kind === "batch") as EvidenceItem;
    expect(item.entrySummary).toEqual({ ingested: 1, skipped: 1, failed: 1, total: 3 });
    // Members still never appear as their own rows (research R2 holds).
    expect(body.items.filter((entry) => entry.kind === "source")).toHaveLength(0);
  });
});
