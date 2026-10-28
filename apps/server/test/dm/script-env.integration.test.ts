import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createGateway } from "../../src/ai/gateway.js";
import { memorySink } from "../../src/ai/usage.js";
import { enqueueTurn, listDmJobs } from "../../src/dm/jobs.js";
import { createAiRuntime } from "../../src/dm/script/env.js";
import { createDmWorker } from "../../src/dm/worker.js";
import { readFrom } from "../../src/events/log.js";
import { createGate } from "../../src/gate/index.js";
import { dmModelCalls } from "../../src/schema/dm-model-calls.js";
import { toStoredEvent } from "../../src/session/events.js";
import { loadProjections } from "../../src/session/projections.js";
import { clearDmJobsBeforeEach, drainAll } from "./worker-world.js";
import { db, loudSkip, reachable, requireDb, TAMSIN_USER } from "./world.js";

loudSkip("script-env.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

describe.skipIf(!reachable)(
  "script mode through the DM worker (database)",
  () => {
    it("narrates a scene-start from the env-built runtime", async () => {
      const runtime = createAiRuntime({
        DM_FAKE_SCRIPT: "greyhollow-live",
        STACKS_ENV: "task-158",
      });
      expect(runtime.scriptName).toBe("greyhollow-live");

      // Wired as index.ts wires it (plan D2).
      const gateway = createGateway({
        config: runtime.aiConfig,
        sink: memorySink(),
        adapters: runtime.adapters,
      });
      const gate = createGate({ db: requireDb(), rng: runtime.gateRng });
      const sessionId = randomUUID();
      const loadDm = (id: string) =>
        loadProjections(requireDb(), id, { role: "dm" });
      const worker = createDmWorker({
        db: requireDb(),
        gateway,
        gate,
        retrieve: async () => {
          throw new Error("no retrieval in script mode");
        },
        loadProjections: loadDm,
        minSimilarity: 0.3,
      });

      await enqueueTurn(requireDb(), sessionId, "scene-start", null, {
        start: { seedId: "greyhollow-ford", seats: { tamsin: TAMSIN_USER } },
      });
      await drainAll(worker);

      const turns = await listDmJobs(requireDb(), sessionId, 10, "turn");
      expect(turns).toHaveLength(1);
      expect(turns[0]?.status).toBe("succeeded");

      const rows = (
        await readFrom(requireDb(), { sessionId, limit: 1000 })
      ).map(toStoredEvent);
      const narration = rows.find((r) => r.type === "narration");
      expect(narration).toBeDefined();
      expect(
        (narration?.payload as { text: string } | undefined)?.text,
      ).toContain("The party reaches Greyhollow Ford");

      const calls = await requireDb()
        .select()
        .from(dmModelCalls)
        .where(eq(dmModelCalls.sessionId, sessionId));
      expect(calls.length).toBeGreaterThan(0);
      // The scene-start queues a chronicle job; the script holds its call.
      const chronicleJobs = await listDmJobs(
        requireDb(),
        sessionId,
        10,
        "chronicle",
      );
      expect(chronicleJobs).toHaveLength(1);
      expect(chronicleJobs[0]?.status).toBe("succeeded");
      const chronicleCalls = calls.filter((c) => c.purpose === "dm.chronicle");
      expect(chronicleCalls.length).toBeGreaterThan(0);
      for (const c of chronicleCalls) {
        expect(c.jobKind).toBe("chronicle");
        expect(c.outcome).toBe("ok");
        expect(c.errorKind).toBeNull();
      }
      for (const c of calls) {
        expect(c.provider).toBe("scripted");
        expect(c.costUsd).toBeNull();
      }
    });
  },
);
