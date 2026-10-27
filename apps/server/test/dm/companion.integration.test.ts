import { afterAll, describe, expect, it } from "vitest";
import { runCompanionJob } from "../../src/dm/companion.js";
import { enqueueTurnForced, listDmJobs } from "../../src/dm/jobs.js";
import { loadSeed } from "../../src/dm/seed/load.js";
import { withManyMonsters } from "./snapshot-fixtures.js";
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

function deps(w: World, enqueue?: (id: string) => Promise<unknown>) {
  const base = w.ctx().deps;
  return {
    gateway: base.gateway,
    gate: base.gate,
    loadProjections: base.loadProjections,
    loadSeed: (id: string) => loadSeed(id),
    enqueueTurnForced: enqueue ?? (async () => {}),
    fence: async () => true,
    log: () => {},
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

  it("an overflowing seat state records an error play, logs state-overflow and makes no model call", async () => {
    const w = await createWorld({
      calls: [companionCall({ say: "unused", comment: null, act: null })],
    });
    await turnModeWith(w, "odo");
    const d = deps(w);
    const logs: Record<string, unknown>[] = [];
    const result = await runCompanionJob(
      {
        ...d,
        loadProjections: async (id: string) =>
          withManyMonsters(await d.loadProjections(id), 90),
        log: (l) => logs.push(l),
      },
      jobOf(w, ["odo"], "turn"),
      signal,
    );
    expect(result.plays.map((p) => [p.companionId, p.status])).toEqual([
      ["odo", "error"],
    ]);
    expect(result.calls).toEqual([]);
    expect(
      logs.find((l) => l.event === "dm.companion.state-overflow"),
    ).toMatchObject({
      view: "seat",
    });
    expect(w.scripted.remaining().calls["dm.companion"]).toBe(1);
  });
});
