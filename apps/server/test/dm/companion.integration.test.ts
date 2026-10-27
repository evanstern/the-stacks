import { afterAll, describe, expect, it } from "vitest";
import { runCompanionJob } from "../../src/dm/companion.js";
import { enqueueTurnForced, listDmJobs } from "../../src/dm/jobs.js";
import type { RecordedCall } from "../../src/dm/pipeline/context.js";
import { loadSeed } from "../../src/dm/seed/load.js";
import {
  createWorld,
  db,
  loudSkip,
  reachable,
  readRows,
  startScene,
  type World,
} from "./world.js";

loudSkip("companion.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});

const AI_DM = { kind: "ai", actor: "ai:dm" } as const;

const companionCall = (value: unknown) => ({
  purpose: "dm.companion",
  respond: { type: "json", value },
});

async function turnModeWith(w: World, active: string) {
  await startScene(w);
  const res = await w.gate.submit(w.sessionId, AI_DM, {
    kind: "table-mode",
    summary: null,
    rationale: null,
    reason: "Test: give the turn to a companion.",
    after: {
      mode: "turn",
      activeActor: `ai:companion:${active}`,
      activeCharacterId: active,
    },
  });
  if (!res.ok) throw new Error(`table-mode refused: ${res.refusal.code}`);
}

const recorded: RecordedCall[] = [];

function deps(w: World, enqueue?: (id: string) => Promise<unknown>) {
  const base = w.ctx().deps;
  recorded.length = 0;
  return {
    gateway: base.gateway,
    gate: base.gate,
    loadProjections: base.loadProjections,
    loadSeed: (id: string) => loadSeed(id),
    enqueueTurnForced: enqueue ?? (async () => {}),
    fence: async () => true,
    log: () => {},
    recordCall: async (c: RecordedCall) => {
      recorded.push(c);
    },
  };
}

const jobOf = (
  w: World,
  companions: string[],
  reason: "hold" | "turn" | "prompt",
) => ({
  id: "00000000-0000-4000-8000-0000000000c1",
  input: {
    v: 1 as const,
    sessionId: w.sessionId,
    companions,
    reason,
    beatJobId: null,
  },
});

const signal = new AbortController().signal;

describe.skipIf(!reachable)("AI companions (database)", () => {
  it("an active companion talks, declares and commits as active-player", async () => {
    const w = await createWorld({
      calls: [
        companionCall({
          say: "Stay behind me, Tamsin.",
          comment: null,
          act: {
            text: "Odo steps to the shutter and braces it open.",
            commit: true,
          },
        }),
      ],
    });
    await turnModeWith(w, "odo");
    const result = await runCompanionJob(
      deps(w),
      jobOf(w, ["odo"], "turn"),
      signal,
    );
    expect(result.plays[0]?.status).toBe("played");
    expect(result.plays[0]?.submissions.map((s) => [s.kind, s.ok])).toEqual([
      ["talk", true],
      ["action.declare", true],
      ["action.commit", true],
    ]);
    const rows = await readRows(w);
    const talk = rows.find((r) => r.type === "talk");
    expect(talk?.actor).toBe("ai:companion:odo");
    const declared = rows.find((r) => r.type === "action.declared");
    expect(declared?.actor).toBe("ai:companion:odo");
    expect(
      (declared as unknown as { payload: { actionId: string } }).payload
        .actionId,
    ).toBe("act-odo-1");
    const committed = rows.find((r) => r.type === "action.committed");
    expect(committed?.actor).toBe("ai:companion:odo");
    expect(
      (committed as unknown as { payload: { authority: string } }).payload
        .authority,
    ).toBe("active-player");
    expect(w.scripted.remaining().calls["dm.companion"]).toBe(0);

    // Seqs (TASK-0116): each ok submission names the rows it appended.
    const seqs = result.plays[0]?.submissions.flatMap((s) => s.seqs) ?? [];
    expect(seqs).toHaveLength(3);
    expect(seqs).toEqual(
      rows
        .filter((r) =>
          ["talk", "action.declared", "action.committed"].includes(r.type),
        )
        .filter((r) => r.actor === "ai:companion:odo")
        .map((r) => r.seq),
    );

    // Usage (TASK-0116): the stored call carries the six fields and was recorded.
    const call = result.calls[0];
    expect(call?.provider).not.toBeNull();
    expect(call?.model).not.toBeNull();
    expect(call?.inputTokens).not.toBeNull();
    expect(call?.outputTokens).not.toBeNull();
    expect(call?.durationMs).not.toBeNull();
    expect(recorded).toHaveLength(result.calls.length);
    expect(recorded[0]).toMatchObject({
      purpose: call?.purpose,
      provider: call?.provider,
      model: call?.model,
      inputTokens: call?.inputTokens,
    });
  });

  it("refuses and records a commit from a companion who is not active", async () => {
    const w = await createWorld({
      calls: [
        companionCall({
          say: null,
          comment: null,
          act: { text: "Kestrel looses an arrow.", commit: true },
        }),
      ],
    });
    await turnModeWith(w, "odo");
    const result = await runCompanionJob(
      deps(w),
      jobOf(w, ["kestrel"], "turn"),
      signal,
    );
    const subs = result.plays[0]?.submissions ?? [];
    expect(subs.map((s) => [s.kind, s.ok, s.code])).toEqual([
      ["action.declare", true, null],
      ["action.commit", false, "COMMIT_NOT_ALLOWED"],
    ]);
    const rows = await readRows(w);
    expect(rows.some((r) => r.type === "action.committed")).toBe(false);
  });

  it("replaces a null act in turn mode with a committed hold-position act", async () => {
    const w = await createWorld({
      calls: [companionCall({ say: null, comment: null, act: null })],
    });
    await turnModeWith(w, "odo");
    await runCompanionJob(deps(w), jobOf(w, ["odo"], "turn"), signal);
    const rows = await readRows(w);
    const declared = rows.find((r) => r.type === "action.declared");
    expect(
      (declared as unknown as { payload: { text: string } }).payload.text,
    ).toBe("holds position and watches for an opening");
    expect(rows.some((r) => r.type === "action.committed")).toBe(true);
  });

  it("a hold job ends by forcing the queued turn", async () => {
    const w = await createWorld({
      calls: [
        companionCall({
          say: "Hm. I do not like this.",
          comment: null,
          act: null,
        }),
      ],
    });
    await startScene(w);
    await runCompanionJob(
      deps(w, (id) => enqueueTurnForced(db as NonNullable<typeof db>, id)),
      jobOf(w, ["odo"], "hold"),
      signal,
    );
    const jobs = await listDmJobs(
      db as NonNullable<typeof db>,
      w.sessionId,
      10,
      "turn",
    );
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.status).toBe("queued");
    expect(
      (jobs[0] as unknown as { input: { forceResolve: boolean } }).input
        .forceResolve,
    ).toBe(true);
  });

  it("skips a companion who is not in the party", async () => {
    const w = await createWorld();
    await startScene(w);
    const result = await runCompanionJob(
      deps(w),
      jobOf(w, ["nobody"], "prompt"),
      signal,
    );
    expect(result.plays[0]?.status).toBe("skipped");
  });
});
