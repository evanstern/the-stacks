import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // DB-gated files share ONE database: parallel files truncate each other's
    // tables (jobs, especially) mid-test. Serialize files, not tests -- same
    // incident and fix as packages/db and apps/worker when 008 landed.
    fileParallelism: false,
  },
});
