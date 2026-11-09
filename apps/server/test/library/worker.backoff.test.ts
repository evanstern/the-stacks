import { describe, expect, it, vi } from "vitest";
import { startIngestWorker } from "../../src/library/ingest/worker.js";
import type { DbClient } from "../../src/library/store.js";

// A database with no `jobs` table (an unmigrated stack): every call throws.
describe("ingest worker backoff", () => {
  it("waits between failed iterations and stops promptly", async () => {
    const execute = vi.fn(() => Promise.reject(new Error("no jobs table")));
    const db = {
      execute,
      select: () => {
        throw new Error("no jobs table");
      },
    } as unknown as DbClient;
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const worker = startIngestWorker({
      db,
      gateway: { embed: vi.fn() },
      embedPurpose: null,
      uploadDir: "/tmp/ingest-backoff-test",
    });
    await new Promise((r) => setTimeout(r, 500));
    expect(execute.mock.calls.length).toBeLessThanOrEqual(2);
    const t0 = Date.now();
    await worker.stop();
    expect(Date.now() - t0).toBeLessThan(500);
    quiet.mockRestore();
  });
});
