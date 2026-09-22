import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit config: generates SQL migrations from src/schema/ into
 * drizzle/, which are committed (research D3) — never `push`ed.
 */
export default defineConfig({
  schema: "./src/schema",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
