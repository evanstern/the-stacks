import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createDmEnqueuer } from "../../src/dm/enqueue.js";
import { listDmJobs } from "../../src/dm/jobs.js";
import { clearDmJobsBeforeEach } from "./worker-world.js";
import { db, loudSkip, reachable, requireDb } from "./world.js";

/**
 * The follow-up rule for a floor row (specs/049-turn-floor R8, TASK-0050 Phase 3): a human's
 * turn-mode `table-mode.changed` row queues the AI follow-up once; `ai:dm`'s own rows queue none.
 */

loudSkip("enqueue-floor.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

const HUMAN = "00000000-0000-4000-8000-0000000000a1";

const modeRow = (
  actor: string,
  after: {
    mode: "turn" | "free";
    activeActor?: string;
    activeCharacterId?: string | null;
  },
  seq = 9,
) =>
  ({
    sessionId: "",
    seq,
    actor,
    type: "table-mode.changed",
    payload: { reason: "floor", before: { mode: "turn" }, after },
    payloadVersion: 1,
    visibility: "public",
    ts: "2026-10-27T00:00:00.000Z",
  }) as never;

function setup() {
  const sessionId = randomUUID();
  const enqueuer = createDmEnqueuer({
    db: requireDb(),
    nudge: () => {},
    loadProjections: async () => ({ actions: [] }) as never,
  });
  const turnJobs = () => listDmJobs(requireDb(), sessionId, 20, "turn");
  const companionJobs = () =>
    listDmJobs(requireDb(), sessionId, 20, "companion");
  return { sessionId, enqueuer, turnJobs, companionJobs };
}

describe.skipIf(!reachable)("floor follow-ups (database)", () => {
  it("a human row naming ai:dm queues one npc-turn", async () => {
    const { sessionId, enqueuer, turnJobs } = setup();
    await enqueuer.onAppended(sessionId, [
      modeRow(HUMAN, {
        mode: "turn",
        activeActor: "ai:dm",
        activeCharacterId: null,
      }),
    ]);
    const rows = await turnJobs();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.input).toMatchObject({ trigger: "npc-turn" });
  });

  it("a human row naming a companion queues one companion turn job", async () => {
    const { sessionId, enqueuer, companionJobs } = setup();
    await enqueuer.onAppended(sessionId, [
      modeRow(HUMAN, {
        mode: "turn",
        activeActor: "ai:companion:odo",
        activeCharacterId: "odo",
      }),
    ]);
    const rows = await companionJobs();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.input).toMatchObject({
      reason: "turn",
      companions: ["odo"],
    });
  });

  it("a human row naming a human queues nothing", async () => {
    const { sessionId, enqueuer, turnJobs, companionJobs } = setup();
    await enqueuer.onAppended(sessionId, [
      modeRow(HUMAN, {
        mode: "turn",
        activeActor: "00000000-0000-4000-8000-0000000000a2",
        activeCharacterId: "kestrel",
      }),
    ]);
    expect(await turnJobs()).toHaveLength(0);
    expect(await companionJobs()).toHaveLength(0);
  });

  it("an ai:dm row queues none, whichever actor it names", async () => {
    const { sessionId, enqueuer, turnJobs, companionJobs } = setup();
    await enqueuer.onAppended(sessionId, [
      modeRow("ai:dm", {
        mode: "turn",
        activeActor: "ai:dm",
        activeCharacterId: null,
      }),
      modeRow(
        "ai:dm",
        {
          mode: "turn",
          activeActor: "ai:companion:odo",
          activeCharacterId: "odo",
        },
        10,
      ),
    ]);
    expect(await turnJobs()).toHaveLength(0);
    expect(await companionJobs()).toHaveLength(0);
  });

  it("a row that leaves turn mode queues nothing", async () => {
    const { sessionId, enqueuer, turnJobs } = setup();
    await enqueuer.onAppended(sessionId, [modeRow(HUMAN, { mode: "free" })]);
    expect(await turnJobs()).toHaveLength(0);
  });

  it("the same human row twice queues one npc-turn", async () => {
    const { sessionId, enqueuer, turnJobs } = setup();
    const row = modeRow(HUMAN, {
      mode: "turn",
      activeActor: "ai:dm",
      activeCharacterId: null,
    });
    await enqueuer.onAppended(sessionId, [row]);
    await enqueuer.onAppended(sessionId, [row]);
    expect(await turnJobs()).toHaveLength(1);
  });
});
