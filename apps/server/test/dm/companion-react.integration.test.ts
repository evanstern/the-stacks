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
  payloadOf,
  player,
  reachable,
  readRows,
  requireDb,
  startScene,
  TAMSIN_USER,
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
  jsonCall("dm.chronicle", { entries: [] }),
];

function runOdo(w: World, reason: "prompt" | "react") {
  const base = w.ctx().deps;
  return runCompanionJob(
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
        reason,
        beatJobId: null,
      },
    },
    new AbortController().signal,
  );
}

/** Odo declares `act-odo-1` without committing it (M2 e8c848ec seq 29-34). */
async function odoDeclaresOpenAction(w: World) {
  const result = await runOdo(w, "prompt");
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
    expect(payloadOf<{ actionId: string }>(committed).actionId).toBe(
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

  it("invalid companion output still commits the open action (default)", async () => {
    const w = await createWorld({
      calls: [
        companionCall({
          say: null,
          comment: null,
          act: { text: "Odo asks who is there.", commit: false },
          pending: [],
        }),
        {
          purpose: "dm.companion",
          respond: { type: "text", value: "not json" },
        },
        {
          purpose: "dm.companion",
          respond: { type: "text", value: "not json" },
        },
      ],
    });
    await startScene(w);
    await odoDeclaresOpenAction(w);
    await humanComment(w, "approve", "Go on.");
    const result = await runOdo(w, "react");
    expect(result.plays[0]?.status).toBe("invalid-output");
    expect(result.plays[0]?.submissions.map((s) => [s.kind, s.ok])).toEqual([
      ["action.commit", true],
    ]);
    const odo1 = (await w.projections()).actions.find(
      (a) => a.actionId === "act-odo-1",
    );
    expect(odo1?.status).toBe("committed");
  });

  it("a prompt run that declares a new act while act-odo-1 is open commits act-odo-1 only (seq 44)", async () => {
    const w = await createWorld({
      calls: [
        companionCall({
          say: null,
          comment: null,
          act: { text: "Odo asks who is there.", commit: false },
          pending: [],
        }),
        companionCall({
          say: "Steady now.",
          comment: null,
          act: { text: "Odo draws a second blade.", commit: true },
          pending: [],
        }),
      ],
    });
    await startScene(w);
    await odoDeclaresOpenAction(w);
    const result = await runOdo(w, "prompt");
    expect(result.plays[0]?.submissions.map((s) => [s.kind, s.ok])).toEqual([
      ["talk", true],
      ["action.commit", true],
    ]);
    const rows = await readRows(w);
    expect(rows.filter((r) => r.type === "action.declared")).toHaveLength(1);
    expect(
      payloadOf<{ actionId: string }>(
        rows.find((r) => r.type === "action.committed"),
      ).actionId,
    ).toBe("act-odo-1");
  });

  it("a react run with no unanswered human reaction is skipped with no model call", async () => {
    const w = await createWorld({
      calls: [
        companionCall({
          say: null,
          comment: null,
          act: { text: "Odo asks who is there.", commit: false },
          pending: [],
        }),
      ],
    });
    await startScene(w);
    await odoDeclaresOpenAction(w);
    const result = await runOdo(w, "react");
    expect(result.plays[0]?.status).toBe("skipped");
    expect(result.calls).toHaveLength(0);
    expect(w.scripted.remaining().calls["dm.companion"]).toBe(0);
  });

  it("a human approval that auto-commits a companion's party action queue one commit turn and no react job", async () => {
    const CLEO = "00000000-0000-4000-8000-0000000000a2";
    const w = await createWorld({
      calls: [
        companionCall({
          say: null,
          comment: null,
          act: { text: "Odo asks who is there.", commit: false },
          pending: [],
        }),
      ],
      presence: {
        presentUsers: () =>
          [TAMSIN_USER].map((userId) => ({
            userId,
            displayName: userId,
          })),
        isPresent: () => true,
        onChange: () => () => {},
      },
    });
    workerFor(w, { reactQuietMs: 0 });
    await startScene(w);
    // A second human seat joins the party, so group sign-off applies.
    const joined = await w.as(
      { kind: "ai", actor: "ai:dm" },
      {
        kind: "party",
        reason: "Cleo joins the party",
        characterId: "cleo",
        after: {
          characterId: "cleo",
          name: "Cleo",
          controller: { kind: "player", userId: CLEO },
          combatantId: null,
        },
      },
    );
    expect(joined.ok ? "ok" : joined.refusal).toBe("ok");
    // Odo declares a party-scope action; the declarer defaults to approve.
    const declared = await w.as(
      { kind: "ai", actor: "ai:companion:odo" },
      {
        kind: "action.declare",
        action: {
          actionId: "act-odo-1",
          characterId: null,
          scope: "party",
          text: "Odo leads the party across the ford.",
        },
      },
    );
    expect(declared.ok).toBe(true);
    // Cleo is seated but absent, so Tamsin's approval alone completes the quorum: the
    // comment, the signoff marker and the commit land in one batch.
    const approved = await humanComment(w, "approve", "Agreed");
    expect(approved.ok).toBe(true);
    const rows = await readRows(w);
    expect(rows.filter((r) => r.type === "action.committed")).toHaveLength(1);
    await tick();

    const jobs = await listDmJobs(requireDb(), w.sessionId, 20);
    expect(jobs.filter((j) => j.kind === "companion")).toHaveLength(0);
    expect(jobs.filter((j) => j.kind === "turn")).toHaveLength(1);
  });

  it("five human comments inside the window run Odo once, and the prompt carries all five", async () => {
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
    for (let i = 1; i <= 5; i++) {
      await humanComment(w, "comment", `reaction number ${i}`);
    }
    await tick();
    await drainAll(worker);
    const jobs = await listDmJobs(requireDb(), w.sessionId, 20, "companion");
    expect(jobs).toHaveLength(1);
    expect(w.scripted.remaining().calls["dm.companion"]).toBe(0);
    // One declare run plus one react run; the react prompt names all five.
    const companionCalls = w.scripted.provider.chatCalls.filter(
      (c) => c.request.purpose === "dm.companion",
    );
    expect(companionCalls).toHaveLength(2);
    const prompt = JSON.stringify(companionCalls[1]?.request.messages);
    for (let i = 1; i <= 5; i++) {
      expect(prompt).toContain(`reaction number ${i}`);
    }
  });
});

describe.skipIf(!reachable)("companion withdraw and revise (database)", () => {
  const declareCall = companionCall({
    say: null,
    comment: null,
    act: { text: "Odo asks who is there.", commit: false },
    pending: [],
  });
  const statusOf = async (w: World, actionId: string) =>
    (await w.projections()).actions.find((a) => a.actionId === actionId)
      ?.status;

  it("an objection then a withdraw closes act-odo-1 and queues no turn job", async () => {
    const w = await createWorld({
      calls: [
        declareCall,
        companionCall({
          say: null,
          comment: null,
          act: null,
          pending: [
            { actionId: "act-odo-1", decision: "withdraw", text: null },
          ],
        }),
      ],
    });
    const { worker } = workerFor(w, { reactQuietMs: 0 });
    await startScene(w);
    await odoDeclaresOpenAction(w);
    expect((await humanComment(w, "object", "Too risky.")).ok).toBe(true);
    await tick();
    await drainAll(worker);

    expect(await statusOf(w, "act-odo-1")).toBe("withdrawn");
    const rows = await readRows(w);
    const withdrawn = rows.find((r) => r.type === "action.withdrawn");
    expect(withdrawn?.actor).toBe("ai:companion:odo");
    expect(payloadOf<{ actionId: string }>(withdrawn).actionId).toBe(
      "act-odo-1",
    );
    expect(rows.some((r) => r.type === "action.committed")).toBe(false);
    const jobs = await listDmJobs(requireDb(), w.sessionId, 20);
    expect(jobs.filter((j) => j.kind === "turn")).toHaveLength(0);
    expect(w.scripted.remaining().calls["dm.companion"]).toBe(0);
  });

  it("turn mode: the active companion withdraws its only open action and still ends its turn", async () => {
    const w = await createWorld({
      calls: [
        declareCall,
        companionCall({
          say: null,
          comment: null,
          act: null,
          pending: [
            { actionId: "act-odo-1", decision: "withdraw", text: null },
          ],
        }),
      ],
    });
    workerFor(w, { reactQuietMs: 0 });
    await startScene(w);
    await odoDeclaresOpenAction(w);
    const turn = await w.gate.submit(
      w.sessionId,
      { kind: "ai", actor: "ai:dm" },
      {
        kind: "table-mode",
        summary: null,
        rationale: null,
        reason: "Test: give the turn to Odo.",
        after: {
          mode: "turn",
          activeActor: "ai:companion:odo",
          activeCharacterId: "odo",
        },
      },
    );
    expect(turn.ok).toBe(true);
    await humanComment(w, "object", "Too risky.");
    const result = await runOdo(w, "react");
    expect(result.plays[0]?.submissions.map((s) => [s.kind, s.ok])).toEqual([
      ["action.withdraw", true],
      ["action.declare", true],
      ["action.commit", true],
    ]);
    expect(await statusOf(w, "act-odo-1")).toBe("withdrawn");
    const next = (await w.projections()).actions.find(
      (a) => a.actionId !== "act-odo-1",
    );
    expect(next?.status).toBe("committed");
    expect(next?.actor).toBe("ai:companion:odo");
    await tick();
    const jobs = await listDmJobs(requireDb(), w.sessionId, 20);
    expect(jobs.filter((j) => j.kind === "turn")).toHaveLength(1);
  });

  it("a revise withdraws the old action and declares and commits the new text", async () => {
    const w = await createWorld({
      calls: [
        declareCall,
        companionCall({
          say: null,
          comment: null,
          act: null,
          pending: [
            {
              actionId: "act-odo-1",
              decision: "revise",
              text: "Odo knocks softly and waits.",
            },
          ],
        }),
      ],
    });
    await startScene(w);
    await odoDeclaresOpenAction(w);
    await humanComment(w, "object", "Do not shout.");
    const result = await runOdo(w, "react");
    expect(result.plays[0]?.submissions.map((s) => [s.kind, s.ok])).toEqual([
      ["action.withdraw", true],
      ["action.declare", true],
      ["action.commit", true],
    ]);
    expect(await statusOf(w, "act-odo-1")).toBe("withdrawn");
    const revised = (await w.projections()).actions.find(
      (a) => a.actionId !== "act-odo-1",
    );
    expect(revised?.text).toBe("Odo knocks softly and waits.");
    expect(revised?.status).toBe("committed");
    expect(revised?.actor).toBe("ai:companion:odo");
  });

  it("a revise decision without text is invalid output and takes the default", async () => {
    const w = await createWorld({
      calls: [
        declareCall,
        companionCall({
          say: null,
          comment: null,
          act: null,
          pending: [{ actionId: "act-odo-1", decision: "revise", text: null }],
        }),
        companionCall({
          say: null,
          comment: null,
          act: null,
          pending: [{ actionId: "act-odo-1", decision: "revise", text: null }],
        }),
      ],
    });
    await startScene(w);
    await odoDeclaresOpenAction(w);
    await humanComment(w, "approve", "Fine.");
    const result = await runOdo(w, "react");
    expect(result.plays[0]?.status).toBe("invalid-output");
    expect(await statusOf(w, "act-odo-1")).toBe("committed");
  });

  it("invalid companion output after an objection withdraws the action (default)", async () => {
    const w = await createWorld({
      calls: [
        declareCall,
        { purpose: "dm.companion", respond: { type: "text", value: "no" } },
        { purpose: "dm.companion", respond: { type: "text", value: "no" } },
      ],
    });
    await startScene(w);
    await odoDeclaresOpenAction(w);
    await humanComment(w, "object", "No.");
    const result = await runOdo(w, "react");
    expect(result.plays[0]?.status).toBe("invalid-output");
    expect(result.plays[0]?.submissions.map((s) => [s.kind, s.ok])).toEqual([
      ["action.withdraw", true],
    ]);
    expect(await statusOf(w, "act-odo-1")).toBe("withdrawn");
  });

  it("the latest human stance decides the default: object then approve commits", async () => {
    const w = await createWorld({
      calls: [
        declareCall,
        { purpose: "dm.companion", respond: { type: "text", value: "no" } },
        { purpose: "dm.companion", respond: { type: "text", value: "no" } },
      ],
    });
    await startScene(w);
    await odoDeclaresOpenAction(w);
    await humanComment(w, "object", "No.");
    await humanComment(w, "approve", "Fine, go.");
    await runOdo(w, "react");
    expect(await statusOf(w, "act-odo-1")).toBe("committed");
  });
});
