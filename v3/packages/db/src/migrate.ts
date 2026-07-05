import { fileURLToPath } from "node:url";

import { migrate as drizzleMigrate } from "drizzle-orm/node-postgres/migrator";

import type { Database } from "./client";

const MIGRATIONS_FOLDER = fileURLToPath(new URL("../migrations", import.meta.url));

export async function runMigrations(db: Database): Promise<void> {
  await drizzleMigrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
