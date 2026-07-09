/**
 * T031/T033 (DB-gated): the ticket-status contract (contracts/api.md) —
 * source payload shape with current-generation counts, batch payload with
 * entryReport + member summaries, ordered event trail, 404s for unknown
 * ids AND unknown kinds.
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

describe.skipIf(!process.env.RUN_DB_INTEGRATION_TESTS)("ticket status contract", () => {
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

  it("source ticket: status, plugin block (null pre-detect), generation, counts, ordered trail", async () => {
    const ticket = await upload("goblin.html", GOBLIN);

    const res = await app.inject({
      method: "GET",
      url: `/api/uploads/source/${ticket.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      ticket: { kind: string; id: string };
      source: {
        status: string;
        plugin: unknown;
        generation: number;
        counts: { sections: number; chunks: number };
        lastError: unknown;
      };
      events: Array<{ stage: string; event: string; at: string }>;
    };
    expect(body.ticket).toEqual(ticket);
    // Worker hasn't run in this test: queued, no plugin yet, generation 0.
    expect(body.source).toMatchObject({
      status: "queued",
      plugin: null,
      generation: 0,
      counts: { sections: 0, chunks: 0 },
      lastError: null,
    });
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({ stage: "intake", event: "completed" });
  });

  it("batch ticket: entryReport + member source summaries + batch-scoped trail", async () => {
    const zip = readFileSync(join(FIXTURES, "zips", "export-mixed.zip"));
    const ticket = await upload("export-mixed.zip", zip);

    const res = await app.inject({
      method: "GET",
      url: `/api/uploads/batch/${ticket.id}`,
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      batch: { status: string; entryReport: unknown[] };
      sources: unknown[];
      events: Array<{ stage: string }>;
    };
    // Expand hasn't run: still expanding, report empty, no member sources yet.
    expect(body.batch.status).toBe("expanding");
    expect(body.batch.entryReport).toEqual([]);
    expect(body.sources).toEqual([]);
    expect(body.events[0]).toMatchObject({ stage: "intake" });
  });

  it("404 unknown_thing for unknown ids and unknown kinds alike", async () => {
    const ghost = "33333333-3333-3333-3333-333333333333";
    for (const url of [
      `/api/uploads/source/${ghost}`,
      `/api/uploads/batch/${ghost}`,
      `/api/uploads/spellbook/${ghost}`,
    ]) {
      const res = await app.inject({ method: "GET", url, headers: { cookie } });
      expect(res.statusCode, url).toBe(404);
      expect((res.json() as { error: { code: string } }).error.code).toBe("unknown_thing");
    }
  });

  it("requires a session like every ingestion route (D13)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/uploads/source/x" });
    expect(res.statusCode).toBe(401);
  });
});
