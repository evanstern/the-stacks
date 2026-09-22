import { migrate } from "drizzle-orm/node-postgres/migrator";
import { loadConfig } from "../src/config.ts";
import { createDb } from "../src/db.ts";

// Run with an explicit .ts extension (see package.json's db:migrate script):
// this file is executed directly via Node's native TypeScript stripping,
// not compiled by tsc, so it can't use the .js-suffixed imports src/ uses
// for its own bundler-resolved build.

// TEST_DATABASE_URL first, DATABASE_URL second — the same precedence the
// integration tests use, and for the same reason. This script runs on the
// HOST (quickstart step 2, `pnpm --filter @the-stacks/server db:migrate`),
// but DATABASE_URL names the database the way the APP CONTAINER reaches it
// (`@db:5432`, a compose service name) and the host cannot resolve that.
// Without this precedence the documented command fails with
// "Failed query: CREATE SCHEMA IF NOT EXISTS drizzle" on every fresh setup.
// Inside the container TEST_DATABASE_URL is unset, so DATABASE_URL applies
// and container-run migration is unaffected.
const config = loadConfig();
const databaseUrl = process.env.TEST_DATABASE_URL || config.databaseUrl;
const db = createDb(databaseUrl);

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
} catch (err) {
  console.error("Migration failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await db.$client.end();
}
