/**
 * drizzle-kit config — DEV TOOLING ONLY. `drizzle-kit generate` diffs
 * src/schema/*.ts against migrations/ and emits new SQL files; applying them
 * at runtime is src/migrate.ts's job (at API boot, research R10). This file
 * is never imported by product code.
 *
 * Numbering gotcha: drizzle-kit derives the next migration prefix from
 * migrations/meta/_journal.json (lastEntry.idx + 1). The journal's idx was
 * deliberately set to 1 to match the 0001_init tag after a manual file
 * rename fixed a numbering collision — don't "correct" it back to 0, or the
 * next generate will mint a duplicate prefix.
 */
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/*.ts",
  out: "./migrations",
  dbCredentials: {
    // Fallback matches the local docker-compose Postgres (port 5442) so
    // `drizzle-kit generate`/`push` work out of the box in dev; real
    // deployments always set DATABASE_URL.
    url: process.env.DATABASE_URL ?? "postgresql://stacks_v3:stacks_v3@localhost:5442/stacks_v3",
  },
});
