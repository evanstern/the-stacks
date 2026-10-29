import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { createSession } from "../../src/auth/session.js";
import { listDmJobs } from "../../src/dm/jobs.js";
import { users } from "../../src/schema/auth.js";
import {
  clearDmJobsBeforeEach,
  drainAll,
  script,
  tick,
  workerFor,
} from "./worker-world.js";
import {
  createWorld,
  db,
  HUMAN_DM,
  loudSkip,
  operator,
  reachable,
  readRows,
  requireDb,
  startScene,
  type World,
} from "./world.js";

// TASK-0159 (spec 055, SC-002): a seated human DM carries out the AI DM's
// scene-start suggestion, and the next AI DM turn loads the seed.

loudSkip("human-dm-scene.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

const SEED_ID = "greyhollow-ford";

/** A world with a human DM seated, the scene-start resolve run, a worker attached. */
async function humanDmWorld() {
  const s = script("human-dm-approval.json");
  const w = await createWorld({ dice: s.dice, calls: s.calls });
  const { worker } = workerFor(w);
  const seat = await w.as(operator, {
    kind: "dm.seat",
    reason: "A human takes the DM seat before the scene starts",
    after: { kind: "human", userId: HUMAN_DM },
  });
  expect(seat.ok ? "ok" : seat.refusal).toBe("ok");
  await startScene(w);
  return { w, worker };
}

/** The scene proposals still pending on the world. */
async function pendingScenes(w: World) {
  const p = await w.projections();
  return p.proposals.filter(
    (x) => x.kind === "scene" && x.status === "pending",
  );
}

/** The session's approval turn job, once the enqueuer has queued it. */
async function approvalJob(w: World) {
  const turns = await listDmJobs(requireDb(), w.sessionId, 20, "turn");
  return turns.find(
    (j) => (j.input as { trigger?: string }).trigger === "approval",
  );
}

async function cookieFor(role: "operator" | "player") {
  const [row] = await requireDb()
    .insert(users)
    .values({
      username: `test-${randomUUID()}`,
      displayName: "Test User",
      role,
      passwordHash: "unused",
    })
    .returning({ id: users.id });
  const session = await createSession(requireDb(), (row as { id: string }).id);
  return `session=${session.token}`;
}

function appOnWorld() {
  return createApp({
    databaseProbe: { reachable: async () => true },
    db: requireDb(),
    dm: { nudge: () => {} },
  });
}

const startBody = {
  seedId: SEED_ID,
  seats: { tamsin: "00000000-0000-4000-8000-0000000000a1" },
};

async function sceneStartJobs(w: World) {
  return (await listDmJobs(requireDb(), w.sessionId, 100, "turn")).filter(
    (j) => (j.input as { trigger?: string }).trigger === "scene-start",
  );
}

async function getStartState(
  app: ReturnType<typeof appOnWorld>,
  cookie: string,
  w: World,
) {
  const res = await app.request(`/dm/sessions/${w.sessionId}/start`, {
    headers: { cookie },
  });
  expect(res.status).toBe(200);
  return (await res.json()) as { state: string };
}

type TurnResult = {
  outcome: { status: string };
  checkpoint: { beat: string[] | null };
  failure?: { kind: string; node: string };
};

describe.skipIf(!reachable)(
  "human DM carries out a scene suggestion (database)",
  () => {
    it("(a) the scene-start turn leaves one pending scene suggestion and no scene", async () => {
      const { w } = await humanDmWorld();
      const pending = await pendingScenes(w);
      expect(pending).toHaveLength(1);
      const [seed] = pending;
      expect(seed).toMatchObject({
        proposer: "ai:dm",
        policy: "suggest",
        kind: "scene",
      });
      expect(
        (seed as unknown as { proposal: { after: { sceneId: string } | null } })
          .proposal.after?.sceneId,
      ).toBe(SEED_ID);
      const p = await w.projections();
      expect(p.scene).toBeNull();
    });

    it("(b) baseline: dismissing the suggestion only leaves the approval turn empty-beat with no scene", async () => {
      const { w, worker } = await humanDmWorld();
      const [seed] = await pendingScenes(w);
      const rejected = await w.as(operator, {
        kind: "proposal.reject",
        proposalId: seed?.proposalId,
        reason: null,
      });
      expect(rejected.ok).toBe(true);
      await tick();
      await drainAll(worker);

      const job = await approvalJob(w);
      expect(job?.status).toBe("succeeded");
      const result = job?.result as TurnResult;
      expect(result.outcome.status).toBe("empty-beat");
      // The worker finished the job before assemble: no checkpoint beat.
      expect(result.checkpoint.beat).toBeNull();
      expect((await w.projections()).scene).toBeNull();
    });

    it("(c) scene request then dismiss: the approval turn loads the seed and runs assemble", async () => {
      const { w, worker } = await humanDmWorld();
      const [seed] = await pendingScenes(w);
      const after = (seed as unknown as { proposal: { after: unknown } })
        .proposal.after;

      // The human DM's own scene request applies directly (permission matrix).
      const changed = await w.as(operator, {
        kind: "scene",
        reason: "The DM carries out the scene suggestion",
        after,
      });
      expect(changed.ok ? "ok" : changed.refusal).toBe("ok");
      expect((await w.projections()).scene?.sceneId).toBe(SEED_ID);

      const rejected = await w.as(operator, {
        kind: "proposal.reject",
        proposalId: seed?.proposalId,
        reason: null,
      });
      expect(rejected.ok).toBe(true);
      await tick();
      await drainAll(worker);

      const job = await approvalJob(w);
      expect(job?.status).toBe("succeeded");
      const result = job?.result as TurnResult;
      expect(result.failure).toBeUndefined();
      expect(result.outcome.status).not.toBe("failed");
      // currentSeed returned the seed (not no-scene or bad-seed): the runner
      // ran assemble and froze the beat. A no-scene finish leaves it null.
      expect(result.checkpoint.beat).not.toBeNull();
      // One row: with a human DM the scene-start turn leaves the scene as a
      // pending suggestion, so only the DM's carry-out writes scene.changed.
      expect(
        (await readRows(w)).filter((r) => r.type === "scene.changed"),
      ).toHaveLength(1);
    });

    it("(e) a second start while the suggestion is pending is 409 and enqueues no job", async () => {
      const { w } = await humanDmWorld();
      const app = appOnWorld();
      const cookie = await cookieFor("operator");
      const before = (await sceneStartJobs(w)).length;
      const res = await app.request(`/dm/sessions/${w.sessionId}/start`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify(startBody),
      });
      expect(res.status).toBe(409);
      const json = (await res.json()) as {
        error: { kind: string; message: string };
      };
      expect(json.error.kind).toBe("conflict");
      expect(json.error.message).toBe("A scene start is waiting for the DM.");
      expect(await sceneStartJobs(w)).toHaveLength(before);
    });

    it("(f) GET start reports pending, then started once the DM carries it out", async () => {
      const { w } = await humanDmWorld();
      const app = appOnWorld();
      const cookie = await cookieFor("operator");
      expect(await getStartState(app, cookie, w)).toEqual({
        state: "pending",
      });

      const [seed] = await pendingScenes(w);
      const after = (seed as unknown as { proposal: { after: unknown } })
        .proposal.after;
      const changed = await w.as(operator, {
        kind: "scene",
        reason: "The DM carries out the scene suggestion",
        after,
      });
      expect(changed.ok ? "ok" : changed.refusal).toBe("ok");
      const rejected = await w.as(operator, {
        kind: "proposal.reject",
        proposalId: seed?.proposalId,
        reason: null,
      });
      expect(rejected.ok).toBe(true);
      expect(await getStartState(app, cookie, w)).toEqual({
        state: "started",
      });
    });

    it("(g) GET start returns none after the DM dismisses the suggestion", async () => {
      const { w } = await humanDmWorld();
      const app = appOnWorld();
      const cookie = await cookieFor("operator");
      const [seed] = await pendingScenes(w);
      const rejected = await w.as(operator, {
        kind: "proposal.reject",
        proposalId: seed?.proposalId,
        reason: null,
      });
      expect(rejected.ok).toBe(true);
      expect(await getStartState(app, cookie, w)).toEqual({ state: "none" });
    });
  },
);
