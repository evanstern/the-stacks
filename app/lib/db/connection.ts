import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const SQLITE_URL_PREFIX = "file:";

export type Database = DatabaseSync;

export function resolveDatabasePath(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.DATABASE_URL ?? env.THE_STACKS_DB_PATH;

  if (!configured || configured.trim() === "") {
    return resolve(process.cwd(), "data", "the-stacks.sqlite");
  }

  if (configured.startsWith(SQLITE_URL_PREFIX)) {
    return resolve(configured.slice(SQLITE_URL_PREFIX.length));
  }

  return resolve(configured);
}

export function openDatabase(path = resolveDatabasePath()): Database {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }

  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA journal_mode = WAL");
  return db;
}

export function closeDatabase(db: Database): void {
  db.close();
}
