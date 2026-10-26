import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createDmEnqueuer } from "../../src/dm/enqueue.js";
import { enqueueTurn, listDmJobs } from "../../src/dm/jobs.js";
import { MAX_ATTEMPTS } from "../../src/jobs/queue.js";
import { jobs } from "../../src/schema/jobs.js";
import {
  clearDmJobsBeforeEach,
  script,
  tick,
  workerFor,
} from "./worker-world.js";
import {
  commitAction,
  createWorld,
  db,
  loudSkip,
  reachable,
  readRows,
  requireDb,
  startScene,
  TAMSIN_USER,
} from "./world.js";

loudSkip("worker.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

describe.skipIf(!reachable)("DM worker (database)", () => {
  it("a committed action enqueues one turn; a second commit does not add another", async () => {
    const s = script("audit-regenerate.json");
    const w = await createWorld({ dice: s.dice, calls: s.calls });
    const { nudges } = workerFor(w);
    await startScene(w);
    await commitAction(w, "Tamsin forces the stuck shutter.", "act-shutter");
    await commitAction(w, "Tamsin checks the lintel.", "act-lintel");
    await tick();
    const queued = await listDmJobs(requireDb(), w.sessionId, 10, "turn");
    expect(queued.filter((j) => j.status === "queued")).toHaveLength(1);
    expect(nudges.count).toBeGreaterThan(0);
  });

  it("fills the scene-start job's start from its input", async () => {
    const w = await createWorld({
      dice: [],
      calls: [
        {
          purpose: "dm.director",
          respond: {
            type: "json",
            value: {
              beat: { decision: "resolve" },
              tableMode: { to: "stay" },
              trackers: [],
              scene: { status: "continue" },
              pacing: {
                tension: "low",
                spotlight: null,
                beatId: "ferry-house",
              },
              goalNote: "Open at the ford.",
              companionPrompts: [],
            },
          },
        },
      ],
    });
    const { worker } = workerFor(w);
    await enqueueTurn(requireDb(), w.sessionId, "scene-start", null, {
      start: { seedId: "greyhollow-ford", seats: { tamsin: TAMSIN_USER } },
    });
    await worker.drain();
    const p = await w.projections();
    expect(p.scene?.sceneId).toBe("greyhollow-ford");
    const seat = p.party.find((m) => m.characterId === "tamsin");
    expect(seat?.controller).toEqual({ kind: "player", userId: TAMSIN_USER });
  });

  it("appends the failure notice for a job abandoned past MAX_ATTEMPTS", async () => {
    const w = await createWorld();
    const { worker } = workerFor(w);
    await startScene(w);
    const id = randomUUID();
    await requireDb()
      .insert(jobs)
      .values({
        id,
        kind: "turn",
        sessionId: w.sessionId,
        status: "running",
        stage: "assemble",
        attempts: MAX_ATTEMPTS,
        claimToken: randomUUID(),
        input: {
          v: 1,
          sessionId: w.sessionId,
          trigger: "manual",
          triggerSeq: null,
          forceResolve: false,
          start: null,
        },
      });
    await requireDb().execute(
      sql`UPDATE jobs SET heartbeat_at = now() - interval '5 minutes' WHERE id = ${id}`,
    );
    await worker.processOne();
    const all = await listDmJobs(requireDb(), w.sessionId, 10, "turn");
    expect(all.find((j) => j.id === id)?.status).toBe("failed");
    const notice = (await readRows(w)).find(
      (r) =>
        r.type === "talk" &&
        r.visibility === "dm" &&
        (r.payload as { text: string }).text.includes("abandoned"),
    );
    expect(notice).toBeDefined();
  });

  it("appends the failure notice when a turn fails", async () => {
    const w = await createWorld({ calls: [] });
    const { worker } = workerFor(w);
    await startScene(w);
    await commitAction(w, "Tamsin knocks.", "act-knock");
    await tick();
    await worker.drain();
    const turn = (await listDmJobs(requireDb(), w.sessionId, 10, "turn")).find(
      (j) => j.status === "failed",
    );
    expect(turn?.error).toMatch(/^stopped at /);
    const notice = (await readRows(w)).find(
      (r) =>
        r.type === "talk" &&
        (r.payload as { text: string }).text.startsWith(
          "The DM runtime stopped",
        ),
    );
    expect(notice).toBeDefined();
  });
});

describe.skipIf(!reachable)("DM enqueuer on approvals (database)", () => {
  const row = (type: string, payload: unknown, seq: number) => ({
    sessionId: "",
    seq,
    actor: "x",
    type,
    payload,
    payloadVersion: 1,
    visibility: "dm",
    ts: "2026-10-26T00:00:00.000Z",
  });

  it("enqueues a turn when an ai:dm proposal is approved or rejected, not another proposer's", async () => {
    const sessionId = randomUUID();
    const loadProjections = async () =>
      ({
        proposals: [
          { proposalId: "p-dm", proposer: "ai:dm" },
          { proposalId: "p-human", proposer: TAMSIN_USER },
        ],
      }) as never;
    const enqueuer = createDmEnqueuer({
      db: requireDb(),
      nudge: () => {},
      loadProjections,
    });
    await enqueuer.onAppended(sessionId, [
      row("proposal.approved", { proposalId: "p-human", batchId: null }, 3),
    ] as never);
    expect(await listDmJobs(requireDb(), sessionId, 10)).toHaveLength(0);

    await enqueuer.onAppended(sessionId, [
      row("proposal.rejected", { proposalId: "p-dm", reason: null }, 4),
    ] as never);
    const queued = await listDmJobs(requireDb(), sessionId, 10);
    expect(queued).toHaveLength(1);
    expect(
      (queued[0] as unknown as { input: { trigger: string } }).input.trigger,
    ).toBe("approval");
  });
});
