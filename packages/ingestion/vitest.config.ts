import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // DB-gated files share ONE database and truncate the same tables.
    // Serialize files, not tests — same incident and fix as packages/db,
    // apps/worker, and apps/api when 008 landed its suites.
    fileParallelism: false,
  },
});
