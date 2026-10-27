import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { createDb } from "../db.js";

/**
 * Playtest database isolation (specs/032-playtest-harness plan.md). Every CLI
 * run plays against its own `<base>_playtest` database, never the worktree's
 * app database or the shared test database. Same pattern as `bench/load/db.ts`.
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

export interface ResolvedPlaytestUrl {
  baseUrl: string;
  playtestUrl: string;
}

/**
 * Resolves the playtest database URL (`PLAYTEST_DATABASE_URL` override, else
 * `TEST_DATABASE_URL || DATABASE_URL` suffixed `_playtest`). Throws when the
 * playtest URL equals the base URL or its host is not loopback.
 */
export function resolvePlaytestUrl(
  env: NodeJS.ProcessEnv,
): ResolvedPlaytestUrl {
  const baseUrl = env.TEST_DATABASE_URL || env.DATABASE_URL;
  if (!baseUrl) {
    throw new Error(
      "resolvePlaytestUrl: TEST_DATABASE_URL or DATABASE_URL is required",
    );
  }
  const playtestUrl =
    env.PLAYTEST_DATABASE_URL || suffixDatabaseName(baseUrl, "_playtest");
  if (playtestUrl === baseUrl) {
    throw new Error(
      "resolvePlaytestUrl: the playtest database URL must differ from the base database URL",
    );
  }
  const hostname = new URL(playtestUrl).hostname;
  if (!isLoopback(hostname)) {
    throw new Error(
      `resolvePlaytestUrl: the playtest database host "${hostname}" is not loopback`,
    );
  }
  return { baseUrl, playtestUrl };
}

const MIGRATIONS_FOLDER = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../drizzle",
);

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Drops (if present), recreates and migrates the playtest database. Refuses
 * when another connection to it already exists.
 */
export async function recreatePlaytestDb(
  baseUrl: string,
  playtestUrl: string,
): Promise<void> {
  const dbName = databaseName(playtestUrl);
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
        `recreatePlaytestDb: database "${dbName}" has ${inUse} existing connection(s) — refusing a concurrent run`,
      );
    }
    await admin.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(dbName)}`);
    await admin.query(`CREATE DATABASE ${quoteIdentifier(dbName)}`);
  } finally {
    await admin.end();
  }

  const db = createDb(playtestUrl);
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await db.$client.end();
  }
}
