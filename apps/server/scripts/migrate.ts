import { migrate } from "drizzle-orm/node-postgres/migrator";
import { loadConfig } from "../src/config.ts";
import { createDb } from "../src/db.ts";

// Run with an explicit .ts extension (see package.json's db:migrate script):
// this file is executed directly via Node's native TypeScript stripping,
// not compiled by tsc, so it can't use the .js-suffixed imports src/ uses
// for its own bundler-resolved build.

const config = loadConfig();
const db = createDb(config.databaseUrl);

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
} catch (err) {
  console.error("Migration failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await db.$client.end();
}
