/**
 * Per-suite test databases (TASK-8) — isolation by construction for the
 * DB-gated integration suites.
 *
 * Every suite used to share the one database in DATABASE_URL; their
 * beforeEach `TRUNCATE … CASCADE` calls raced each other across packages
 * (api's contract tests truncated `batches` under worker's ingest e2e —
 * "unknown batch", FK violations; flaked twice on PR #8's CI before the
 * verify script was serialized as a stopgap). Deriving one database per
 * suite makes contamination structurally impossible — no lock, no
 * serialization, no cleanup discipline to get wrong — the same posture as
 * the append-only event table (Principle IV: safe by construction).
 *
 * Usage, in a suite's beforeAll:
 *
 *   const url = await ensureSuiteDatabase(DATABASE_URL, "api_list");
 *   const { db, pool } = createDbClient(url);
 *
 * Suite ids should be unique per test FILE (vitest's unit of parallelism),
 * so two workers never migrate the same fresh database concurrently. The
 * databases are tiny, deterministic in name, and reused across runs — the
 * suites' own beforeEach truncation keeps them clean.
 */
import pg from "pg";

import { createDbClient } from "./client";
import { runMigrations } from "./migrate";

/**
 * Pure derivation: rewrite the URL's database name to `<base>_<suite>`.
 * The suite id is sanitized to identifier characters and the result clamped
 * to Postgres's 63-byte identifier limit (deterministically — a clamp that
 * varied would silently split one suite across two databases).
 */
export function deriveSuiteDatabaseUrl(baseUrl: string, suite: string): string {
  const sanitized = suite.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  if (!sanitized) {
    throw new Error(`suite id ${JSON.stringify(suite)} is empty after sanitizing — anonymous suites would collide`);
  }
  const url = new URL(baseUrl);
  const baseName = url.pathname.slice(1);
  const name = `${baseName}_${sanitized}`.slice(0, 63);
  url.pathname = `/${name}`;
  return url.toString();
}

/**
 * Create the suite's database if it doesn't exist, run migrations on it,
 * and return its URL. Safe to call from every suite unconditionally:
 * CREATE DATABASE races (two files sharing a suite id against the doc'd
 * convention) collapse to the duplicate_database error, which is absorbed.
 */
export async function ensureSuiteDatabase(baseUrl: string, suite: string): Promise<string> {
  const suiteUrl = deriveSuiteDatabaseUrl(baseUrl, suite);
  const name = new URL(suiteUrl).pathname.slice(1);

  // Admin connection to the BASE database only to check/create the suite's.
  const admin = new pg.Pool({ connectionString: baseUrl, max: 1 });
  try {
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (exists.rowCount === 0) {
      // Identifiers can't be parameterized; `name` is sanitized + clamped by
      // construction above, and quoted here for defense in depth.
      await admin.query(`CREATE DATABASE "${name}"`).catch((err: unknown) => {
        // 42P04 duplicate_database: a concurrent creator won the race — fine.
        if ((err as { code?: string }).code !== "42P04") throw err;
      });
    }
  } finally {
    await admin.end();
  }

  const { db, pool } = createDbClient(suiteUrl);
  try {
    await runMigrations(db);
  } finally {
    await pool.end();
  }
  return suiteUrl;
}
