/**
 * TASK-8: per-suite test databases — the durable fix for shared-Postgres
 * contamination. Every DB-gated suite used to point at THE database from
 * DATABASE_URL; their beforeEach TRUNCATE … CASCADE calls raced each other
 * across packages (api's contract tests truncated `batches` under worker's
 * ingest e2e — "unknown batch", FK violations; flaked twice on the-stacks
 * PR #8's CI). Isolation by construction: each suite derives its own
 * database name from DATABASE_URL + a suite id, so no two suites can see —
 * let alone truncate — each other's rows, whatever the parallelism.
 *
 * The derivation is pure and tested without a database; ensureSuiteDatabase
 * (create-if-absent + migrate) is DB-gated like every integration suite.
 */
import { describe, expect, it } from "vitest";

import { createDbClient, deriveSuiteDatabaseUrl, ensureSuiteDatabase } from "../src";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://stacks_v3:stacks_v3@localhost:5442/stacks_v3";

describe("deriveSuiteDatabaseUrl (pure)", () => {
  it("suffixes the database name with the suite id, preserving everything else", () => {
    expect(
      deriveSuiteDatabaseUrl("postgresql://u:p@localhost:5442/stacks_v3", "api_list"),
    ).toBe("postgresql://u:p@localhost:5442/stacks_v3_api_list");
  });

  it("sanitizes suite ids to identifier-safe characters (dashes become underscores)", () => {
    expect(
      deriveSuiteDatabaseUrl("postgresql://u:p@h:1/db", "worker/ingest-pipeline.test"),
    ).toBe("postgresql://u:p@h:1/db_worker_ingest_pipeline_test");
  });

  it("keeps query parameters (e.g. sslmode) intact", () => {
    expect(
      deriveSuiteDatabaseUrl("postgresql://u:p@h:1/db?sslmode=disable", "queue"),
    ).toBe("postgresql://u:p@h:1/db_queue?sslmode=disable");
  });

  it("clamps to Postgres's 63-char identifier limit deterministically", () => {
    const url = deriveSuiteDatabaseUrl(
      "postgresql://u:p@h:1/stacks_v3",
      "a".repeat(80),
    );
    const name = new URL(url).pathname.slice(1);
    expect(name.length).toBeLessThanOrEqual(63);
    // Deterministic: the same over-long suite id always lands on the same name.
    expect(url).toBe(deriveSuiteDatabaseUrl("postgresql://u:p@h:1/stacks_v3", "a".repeat(80)));
  });

  it("refuses an empty suite id — anonymous suites would collide", () => {
    expect(() => deriveSuiteDatabaseUrl("postgresql://u:p@h:1/db", "")).toThrow(/suite/i);
  });
});

describe.skipIf(!process.env.RUN_DB_INTEGRATION_TESTS)("ensureSuiteDatabase (integration)", () => {
  it("creates the suite database on first use, is idempotent, and returns a migrated database", async () => {
    const url = await ensureSuiteDatabase(DATABASE_URL, "db_testdb_selftest");
    expect(new URL(url).pathname).toBe(new URL(DATABASE_URL).pathname + "_db_testdb_selftest");

    // Idempotent: a second call must not fail on the existing database.
    await ensureSuiteDatabase(DATABASE_URL, "db_testdb_selftest");

    // Migrated: the jobs table exists and is queryable in the SUITE database.
    const { db, pool } = createDbClient(url);
    try {
      const res = await pool.query("SELECT count(*)::int AS n FROM jobs");
      expect(res.rows[0]).toHaveProperty("n");
      void db;
    } finally {
      await pool.end();
    }
  });
});
