import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Every DB-gated file here derives its OWN database (ensureSuiteDatabase,
    // TASK-8 convention — unique suite id per file), so files can run in
    // parallel: cross-file contamination is structurally impossible, not
    // merely serialized away.
    fileParallelism: true,
  },
});
