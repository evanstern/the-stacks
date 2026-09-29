import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { hashPassword } from "../../auth/password.js";
import { createSession } from "../../auth/session.js";
import { createDb } from "../../db.js";
import { users } from "../../schema/auth.js";

/**
 * Load database isolation (specs/021-load-bench research R3). Every local
 * case runs against its own `<base>_load` database — never the worktree's
 * app database or the shared test database other suites use.
 */

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isLoopback(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname.replace(/^\[|\]$/g, ""));
}

function suffixDatabaseName(url: string, suffix: string): string {
  const u = new URL(url);
  u.pathname = `${u.pathname}${suffix}`;
  return u.toString();
}

function databaseName(url: string): string {
  return new URL(url).pathname.replace(/^\//, "");
}

export interface ResolvedLoadUrl {
  baseUrl: string;
  loadUrl: string;
}

/**
 * Resolves the load database URL from the environment (`LOAD_DATABASE_URL`
 * override, else `TEST_DATABASE_URL || DATABASE_URL` suffixed `_load`).
 * Refuses (throws) when the load URL equals the base URL, or when its host
 * is not loopback — a local case never touches a shared server.
 */
export function resolveLoadUrl(env: NodeJS.ProcessEnv): ResolvedLoadUrl {
  const baseUrl = env.TEST_DATABASE_URL || env.DATABASE_URL;
  if (!baseUrl) {
    throw new Error(
      "resolveLoadUrl: TEST_DATABASE_URL or DATABASE_URL is required",
    );
  }
  const loadUrl = env.LOAD_DATABASE_URL || suffixDatabaseName(baseUrl, "_load");
  if (loadUrl === baseUrl) {
    throw new Error(
      "resolveLoadUrl: the load database URL must differ from the base database URL",
    );
  }
  const hostname = new URL(loadUrl).hostname;
  if (!isLoopback(hostname)) {
    throw new Error(
      `resolveLoadUrl: the load database host "${hostname}" is not loopback`,
    );
  }
  return { baseUrl, loadUrl };
}

const MIGRATIONS_FOLDER = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../drizzle",
);

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Drops (if present), recreates, and migrates the load database — run
 * before each local case (research R3), never two cases at once. Connects
 * to `baseUrl` to issue the DROP/CREATE (a database can't drop itself).
 * Refuses when another connection to the load database already exists.
 */
export async function recreateLoadDb(
  baseUrl: string,
  loadUrl: string,
): Promise<void> {
  const dbName = databaseName(loadUrl);
  const admin = new Client({ connectionString: baseUrl });
  await admin.connect();
  try {
    const { rows } = await admin.query(
      "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = $1",
      [dbName],
    );
    const inUse = Number(rows[0]?.n ?? 0);
    if (inUse > 0) {
      throw new Error(
        `recreateLoadDb: database "${dbName}" has ${inUse} existing connection(s) — refusing a concurrent run`,
      );
    }
    await admin.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(dbName)}`);
    await admin.query(`CREATE DATABASE ${quoteIdentifier(dbName)}`);
  } finally {
    await admin.end();
  }

  const db = createDb(loadUrl);
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await db.$client.end();
  }
}

export interface LoadDbFacts {
  postgres: string;
  maxConnections: number;
}

/** Reads server_version and max_connections from the load database (results provenance, contracts/results-format.md `target`). */
export async function describeLoadDb(loadUrl: string): Promise<LoadDbFacts> {
  const client = new Client({ connectionString: loadUrl });
  await client.connect();
  try {
    const [{ rows: versionRows }, { rows: maxConnRows }] = await Promise.all([
      client.query("SHOW server_version"),
      client.query("SHOW max_connections"),
    ]);
    return {
      postgres: versionRows[0].server_version as string,
      maxConnections: Number(maxConnRows[0].max_connections),
    };
  } finally {
    await client.end();
  }
}

/** Drops the load database (best effort — callers treat failure as a warning, per contracts/bench-cli.md step 7). */
export async function dropLoadDb(
  baseUrl: string,
  loadUrl: string,
): Promise<void> {
  const dbName = databaseName(loadUrl);
  const admin = new Client({ connectionString: baseUrl });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(dbName)}`);
  } finally {
    await admin.end();
  }
}

export interface SeededUser {
  id: string;
  token: string;
}

/**
 * Seeds `n` player users with sessions (research R9). One scrypt hash is
 * computed once and reused for every user — sign-in itself is kept out of
 * the loop so it never dominates a step's latency.
 */
export async function seedUsers(
  db: ReturnType<typeof createDb>,
  n: number,
): Promise<SeededUser[]> {
  const passwordHash = await hashPassword("load-bench-not-a-real-password");
  const seeded: SeededUser[] = [];
  for (let i = 0; i < n; i++) {
    const [row] = await db
      .insert(users)
      .values({
        username: `load-bench-${randomUUID()}`,
        displayName: `Load Bench User ${i + 1}`,
        role: "player",
        passwordHash,
      })
      .returning({ id: users.id });
    const session = await createSession(db, row.id);
    seeded.push({ id: row.id, token: session.token });
  }
  return seeded;
}

/**
 * Preloads `rows` terminal `succeeded` jobs (research R4), so the claim
 * query runs against a realistic table instead of an empty one. One
 * `INSERT ... SELECT generate_series`, spread a second apart into the past
 * so `created_at` ordering is meaningful.
 */
export async function preloadHistory(
  db: ReturnType<typeof createDb>,
  rows: number,
): Promise<void> {
  if (rows <= 0) return;
  await db.execute(sql`
    INSERT INTO jobs (kind, book, status, attempts, input, result, created_at, started_at, finished_at)
    SELECT
      'ingest',
      'load-history-' || gs,
      'succeeded',
      1,
      '{"format":"markdown","filename":"history.md","bytes":0,"uploadPath":""}'::jsonb,
      '{"pages":1,"duplicatePages":0,"ignoredEntries":0,"skippedEntries":0,"parser":"markdown","documentId":"00000000-0000-0000-0000-000000000000","chunkCount":1,"replaced":false,"embedding":{"status":"skipped","reason":"history preload"}}'::jsonb,
      now() - (interval '1 second' * gs),
      now() - (interval '1 second' * gs),
      now() - (interval '1 second' * gs)
    FROM generate_series(1, ${rows}) AS gs
  `);
}
