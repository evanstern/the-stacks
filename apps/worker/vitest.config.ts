import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // DB-gated files share ONE database and one jobs queue: parallel files
    // truncate each other's tables mid-test and claimNext() steals jobs
    // across suites. Serialize files, not tests (same incident and fix as
    // packages/db/vitest.config.ts when 008 landed).
    fileParallelism: false,
  },
});
