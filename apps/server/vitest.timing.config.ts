import { defineConfig } from "vitest/config";

export default defineConfig({
  // Serial files: the latency gate must not overlap the CPU-heavy ddb bench (spec 106 FR-011).
  test: { include: ["test/**/*.bench-test.ts"], fileParallelism: false },
});
