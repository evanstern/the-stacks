import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { runCompanionJob } from "../../src/dm/companion.js";
import { createDmEnqueuer } from "../../src/dm/enqueue.js";
import { listDmJobs } from "../../src/dm/jobs.js";
import { loadSeed } from "../../src/dm/seed/load.js";
import {
  clearDmJobsBeforeEach,
  drainAll,
  tick,
  workerFor,
} from "./worker-world.js";
import {
  createWorld,
  db,
  loudSkip,
  player,
  reachable,
  readRows,
  requireDb,
  startScene,
  type World,
} from "./world.js";

/**
 * The gate listener's react rule (specs/036-companion-react FR-001-FR-004):
 * a human reaction on a companion's open action queues one coalesced
 * `react` companion job.
 */

loudSkip("companion-react.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

const HUMAN = "00000000-0000-4000-8000-0000000000a1";

const commented = (
  actor: string,
  actionId: string,
  stance: "comment" | "approve" | "object",
  seq: number,
) =>
  ({
    sessionId: "",
    seq,
    actor,
    type: "action.commented",
    payload: { actionId, stance, text: `t${seq}` },
    payloadVersion: 1,
    visibility: "table",
    ts: "2026-10-26T00:00:00.000Z",
  }) as never;

function setup(actions: { actionId: string; actor: string; status: string }[]) {
  const sessionId = randomUUID();
  const enqueuer = createDmEnqueuer({
    db: requireDb(),
    nudge: () => {},
    loadProjections: async () => ({ actions }) as never,
    reactQuietMs: 0,
  });
  const jobs = () => listDmJobs(requireDb(), sessionId, 20, "companion");
  return { sessionId, enqueuer, jobs };
}

const reasonOf = (job: { input: unknown }) =>
  (job.input as { reason: string }).reason;

const companions = (job: { input: unknown }) =>
  (job.input as { companions: string[] }).companions;

describe.skipIf(!reachable)("companion react trigger (database)", () => {
  it.each(["comment", "approve", "object"] as const)(
    "a human %s on a companion's open action queues one react job",
    async (stance) => {
      const { sessionId, enqueuer, jobs } = setup([
        {
          actionId: "act-odo-1",
          actor: "ai:companion:odo",
          status: "declared",
        },
      ]);
      await enqueuer.onAppended(sessionId, [
        commented(HUMAN, "act-odo-1", stance, 5),
      ]);
      const rows = await jobs();
      expect(rows).toHaveLength(1);
      expect(reasonOf(rows[0] as never)).toBe("react");
      expect(companions(rows[0] as never)).toEqual(["odo"]);
    },
  );

  it("comments by ai:dm and by a companion queue none", async () => {
    const { sessionId, enqueuer, jobs } = setup([
      { actionId: "act-odo-1", actor: "ai:companion:odo", status: "discussed" },
    ]);
    await enqueuer.onAppended(sessionId, [
      commented("ai:dm", "act-odo-1", "comment", 5),
      commented("ai:companion:mira", "act-odo-1", "comment", 6),
    ]);
    expect(await jobs()).toHaveLength(0);
  });

  it("a human comment on a human's action, or on a closed action, queues none", async () => {
    const { sessionId, enqueuer, jobs } = setup([
      { actionId: "act-h-1", actor: HUMAN, status: "declared" },
      { actionId: "act-odo-2", actor: "ai:companion:odo", status: "committed" },
    ]);
    await enqueuer.onAppended(sessionId, [
      commented(HUMAN, "act-h-1", "comment", 5),
      commented(HUMAN, "act-odo-2", "comment", 6),
    ]);
    expect(await jobs()).toHaveLength(0);
  });

  it("five human comments queue one job", async () => {
    const { sessionId, enqueuer, jobs } = setup([
      { actionId: "act-odo-1", actor: "ai:companion:odo", status: "discussed" },
    ]);
    for (let seq = 5; seq < 10; seq++) {
      await enqueuer.onAppended(sessionId, [
        commented(HUMAN, "act-odo-1", "comment", seq),
      ]);
    }
    const rows = await jobs();
    expect(rows).toHaveLength(1);
    expect(companions(rows[0] as never)).toEqual(["odo"]);
  });
});

const companionCall = (value: unknown) => ({
  purpose: "dm.companion",
  respond: { type: "json", value },
});

const jsonCall = (purpose: string, value: unknown) => ({
  purpose,
  respond: { type: "json", value },
});

const turnCalls = (actionId: string) => [
  jsonCall("dm.director", {
    beat: { decision: "resolve" },
    tableMode: { to: "stay" },
    trackers: [],
    scene: { status: "continue" },
    pacing: { tension: "low", spotlight: null, beatId: "ferry-house" },
    goalNote: "Let the party settle on Odo's caution.",
    companionPrompts: [],
  }),
  jsonCall("dm.interpret", {
    readings: [
      {
        actionId,
        intent: "talk",
        uncertain: false,
        needsAdjudication: false,
        rulesQuestion: null,
        clarify: null,
        steps: [],
      },
    ],
  }),
  {
    purpose: "dm.narrate",
    respond: {
      type: "text",
      value: "Odo lowers his voice and tells the party to wait and listen.",
    },
  },
  jsonCall("dm.audit", { verdict: "pass", issues: [] }),
  jsonCall("dm.chronicle", { entries: [] }),
];

/** Odo declares `act-odo-1` without committing it (M2 e8c848ec seq 29-34). */
async function odoDeclaresOpenAction(w: World) {
  const base = w.ctx().deps;
  const result = await runCompanionJob(
    {
      gateway: base.gateway,
      gate: base.gate,
      loadProjections: base.loadProjections,
      loadSeed: (id: string) => loadSeed(id),
      enqueueTurnForced: async () => {},
      fence: async () => true,
      log: () => {},
    },
    {
      id: "00000000-0000-4000-8000-0000000000c1",
      input: {
        v: 1 as const,
        sessionId: w.sessionId,
        companions: ["odo"],
        reason: "prompt" as const,
        beatJobId: null,
      },
    },
    new AbortController().signal,
  );
  expect(result.plays[0]?.submissions.map((s) => [s.kind, s.ok])).toEqual([
    ["action.declare", true],
  ]);
}

const humanComment = (
  w: World,
  stance: "comment" | "approve" | "object",
  text: string,
) =>
  w.as(player, {
    kind: "action.comment",
    comment: { actionId: "act-odo-1", stance, text },
  });

describe.skipIf(!reachable)("companion react resolution (database)", () => {
  it("M2 e8c848ec seq 35-38: a human reaction re-runs Odo and closes act-odo-1", async () => {
    const w = await createWorld({
      calls: [
        companionCall({
          say: null,
          comment: null,
          act: { text: "Odo asks who is there.", commit: false },
          pending: [],
        }),
        companionCall({
          say: null,
          comment: null,
          act: null,
          pending: [{ actionId: "act-odo-1", decision: "commit", text: null }],
        }),
        ...turnCalls("act-odo-1"),
      ],
    });
    const { worker } = workerFor(w, { reactQuietMs: 0 });
    await startScene(w);
    await odoDeclaresOpenAction(w);
    expect((await w.projections()).actions[0]?.status).toBe("declared");

    expect((await humanComment(w, "comment", "Who is there?")).ok).toBe(true);
    expect((await humanComment(w, "approve", "Let's be cautious")).ok).toBe(
      true,
    );
    await tick();
    await drainAll(worker);

    const jobs = (await listDmJobs(requireDb(), w.sessionId, 20)).reverse();
    const companionRuns = jobs.filter((j) => j.kind === "companion");
    expect(
      companionRuns.map((j) => (j.input as { reason: string }).reason),
    ).toEqual(["react"]);
    expect(w.scripted.remaining().calls["dm.companion"]).toBe(0);

    const rows = await readRows(w);
    const committed = rows.find((r) => r.type === "action.committed");
    expect(committed?.actor).toBe("ai:companion:odo");
    expect((committed?.payload as { actionId: string }).actionId).toBe(
      "act-odo-1",
    );
    expect(
      jobs.filter((j) => j.kind === "turn").map((j) => j.error ?? j.status),
    ).toEqual(["succeeded"]);
    const odo1 = (await w.projections()).actions.find(
      (a) => a.actionId === "act-odo-1",
    );
    expect(odo1?.status).toBe("resolved");
  });
});
