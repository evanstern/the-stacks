import { defineConfig } from "vitest/config";

/**
 * Integration suites share ONE real Postgres (`TEST_DATABASE_URL`) —
 * `jobs`, `library_*`, `users`. Vitest's default file-level parallelism
 * runs test files in separate workers against that same database, so one
 * file's claims/wholesale deletes can race another's. This was a latent
 * hazard from Phase 1 on (jobs.integration.test.ts's `drainQueue()` claims
 * any claimable row) but stayed invisible until the ingest worker
 * (specs/017-ingestion-pipeline T021) started polling that same queue in
 * the background and a test started asserting on outcomes past enqueue —
 * a concurrently-run file could steal and fail its job first (T023, T024).
 */
export default defineConfig({
  test: {
    fileParallelism: false,
  },
});
