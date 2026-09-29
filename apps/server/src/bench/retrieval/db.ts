import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { createDb } from "../../db.js";
import type { DbClient } from "../../library/store.js";
import { libraryDocuments } from "../../schema/library.js";

/**
 * The bench's own database (research R7, contracts/bench-cli.md run steps
 * 6-7): never the app's database, created and migrated on demand, refused
 * when it would collide with the base URL.
 */

function benchDbName(benchUrl: string): string {
  return new URL(benchUrl).pathname.replace(/^\//, "");
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * `BENCH_DATABASE_URL` when set; otherwise the base URL (`TEST_DATABASE_URL
 * || DATABASE_URL`, `db:migrate`'s own precedence) with the database name
 * suffixed `_bench` (contract invariant 5).
 */
export function resolveBenchUrl(env: NodeJS.ProcessEnv): {
  baseUrl: string;
  benchUrl: string;
} {
  const baseUrl = env.TEST_DATABASE_URL || env.DATABASE_URL;
  if (!baseUrl) {
    throw new Error(
      "TEST_DATABASE_URL or DATABASE_URL must be set to resolve a bench database",
    );
  }
  const benchUrl =
    env.BENCH_DATABASE_URL ||
    (() => {
      const parsed = new URL(baseUrl);
      parsed.pathname = `/${benchDbName(baseUrl)}_bench`;
      return parsed.toString();
    })();
  if (benchUrl === baseUrl) {
    throw new Error(
      "the bench database must not be the same as the base database (BENCH_DATABASE_URL resolved equal to the base URL)",
    );
  }
  return { baseUrl, benchUrl };
}

/** Connects to the base URL's server and creates the bench database if absent. */
export async function ensureBenchDb(
  baseUrl: string,
  benchUrl: string,
): Promise<void> {
  const name = benchDbName(benchUrl);
  const pool = new Pool({ connectionString: baseUrl });
  try {
    const existing = await pool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [name],
    );
    if (existing.rowCount === 0) {
      await pool.query(`CREATE DATABASE ${quoteIdent(name)}`);
    }
  } finally {
    await pool.end();
  }
}

/** Applies drizzle's committed migrations to the bench database. */
export async function migrateBenchDb(benchUrl: string): Promise<void> {
  const db = createDb(benchUrl);
  // Resolved relative to this file's own location (src/ in tests, dist/
  // after a build) — both sit 3 levels under apps/server.
  const migrationsFolder = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../drizzle",
  );
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await db.$client.end();
  }
}

/** Wipes every bench document (and, by cascade, its chunks/embeddings) before a new strategy. */
export async function resetLibrary(db: DbClient): Promise<void> {
  await db.delete(libraryDocuments);
}
