import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { exportSession } from "../../src/playtest/export.js";
import { jobs } from "../../src/schema/jobs.js";
import { db, loudSkip, reachable, requireDb } from "./world.js";

/** TASK-0355: session 6031b671 (577 jobs) lost its 77 oldest jobs to a 500 cap in `jobs.json`. */
loudSkip("export-all-jobs.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});

describe.skipIf(!reachable)(
  "exportSession on a long session (database)",
  () => {
    it("exports every job, the oldest factsThrough included", async () => {
      const sessionId = randomUUID();
      const base = Date.parse("2026-11-15T00:00:00Z");
      const total = 577;
      await requireDb()
        .insert(jobs)
        .values(
          Array.from({ length: total }, (_, i) => ({
            kind: "turn",
            sessionId,
            status: "succeeded",
            input: { trigger: "manual" },
            result: { checkpoint: { factsThrough: i + 1 } },
            createdAt: new Date(base + i * 1000),
          })),
        );
      const { jobs: out } = await exportSession(requireDb(), sessionId);
      expect(out).toHaveLength(total);
      expect(out[0]?.factsThrough).toBe(total); // newest first
      expect(out[total - 1]?.factsThrough).toBe(1); // the oldest survives
    });
  },
);
