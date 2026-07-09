import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // DB-gated files share ONE database (the compose Postgres): parallel files
    // race on first-ever runMigrations (both try to apply a new migration) and
    // on cross-file TRUNCATEs. Serializing files — not tests — keeps the suite
    // honest without per-file scratch databases. Found the hard way when 0002
    // landed: two workers applied it concurrently and one lost.
    fileParallelism: false,
  },
});
