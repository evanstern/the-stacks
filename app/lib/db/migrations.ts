import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Database } from "./connection.js";

const migrationsDirectory = fileURLToPath(new URL("./migrations", import.meta.url));

export type MigrationRecord = {
  version: string;
  applied: boolean;
};

export function runMigrations(db: Database): MigrationRecord[] {
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `);

  const selectMigration = db.prepare("SELECT version FROM schema_migrations WHERE version = ?");
  const insertMigration = db.prepare("INSERT INTO schema_migrations (version) VALUES (?)");
  const records: MigrationRecord[] = [];

  const migrations = readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  db.exec("BEGIN");
  try {
    for (const migration of migrations) {
      const version = basename(migration, ".sql");
      const existing = selectMigration.get(version);

      if (existing) {
        records.push({ version, applied: false });
        continue;
      }

      db.exec(readFileSync(join(migrationsDirectory, migration), "utf8"));
      insertMigration.run(version);
      records.push({ version, applied: true });
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return records;
}
