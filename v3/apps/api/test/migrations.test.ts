import { createDbClient, runMigrations } from "@stacks/db";
import { sql } from "drizzle-orm";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Requires an EMPTY Dockerized Postgres (distinct from the dev-compose instance,
// which already has migrations applied) reachable at MIGRATION_TEST_DATABASE_URL.
const DATABASE_URL = process.env.MIGRATION_TEST_DATABASE_URL;

const MIGRATIONS_DIR = fileURLToPath(new URL("../../../packages/db/migrations", import.meta.url));
const JOURNAL_PATH = `${MIGRATIONS_DIR}/meta/_journal.json`;
const TRIVIAL_MIGRATION_PATH = `${MIGRATIONS_DIR}/0002_trivial_test.sql`;

describe.skipIf(!process.env.RUN_DB_INTEGRATION_TESTS || !DATABASE_URL)("migration lifecycle", () => {
  let db: ReturnType<typeof createDbClient>["db"];
  let close: () => Promise<void>;
  const originalJournal = readFileSync(JOURNAL_PATH, "utf-8");

  beforeEach(() => {
    const client = createDbClient(DATABASE_URL!);
    db = client.db;
    close = () => client.pool.end();
  });

  afterEach(async () => {
    if (existsSync(TRIVIAL_MIGRATION_PATH)) {
      unlinkSync(TRIVIAL_MIGRATION_PATH);
    }
    writeFileSync(JOURNAL_PATH, originalJournal);
    await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
    await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public`);
    await close();
  });

  it("applies migration 0001 to an empty database and records it in the journal", async () => {
    await runMigrations(db);

    const journal = await db.execute<{ id: number }>(sql`SELECT id FROM drizzle.__drizzle_migrations ORDER BY id`);
    expect(journal.rows).toHaveLength(1);

    const tables = await db.execute<{ table_name: string }>(
      sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
    );
    expect(tables.rows.map((r) => r.table_name)).toEqual([
      "jobs",
      "skeleton_check_events",
      "skeleton_check_runs",
      "skeleton_vectors",
    ]);
  });

  it("applies a newly added migration incrementally on the next boot", async () => {
    await runMigrations(db);

    // Simulate the quickstart Scenario 5 drill: a trivial comment-only migration
    // lands under migrations/, and the next boot applies just the new one.
    writeFileSync(TRIVIAL_MIGRATION_PATH, "COMMENT ON TABLE jobs IS 'trivial migration test';\n");
    const journalData = JSON.parse(originalJournal);
    journalData.entries.push({
      idx: journalData.entries.length,
      version: "7",
      when: Date.now(),
      tag: "0002_trivial_test",
      breakpoints: true,
    });
    writeFileSync(JOURNAL_PATH, JSON.stringify(journalData, null, 2));

    await runMigrations(db);

    const journal = await db.execute<{ id: number }>(sql`SELECT id FROM drizzle.__drizzle_migrations ORDER BY id`);
    expect(journal.rows).toHaveLength(2);

    const comment = await db.execute<{ description: string }>(
      sql`SELECT obj_description('jobs'::regclass) AS description`,
    );
    expect(comment.rows[0]?.description).toBe("trivial migration test");
  });
});
