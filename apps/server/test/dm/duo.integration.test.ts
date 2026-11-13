import type { Proposer } from "@the-stacks/session-model";
import { afterAll, describe, expect, it } from "vitest";
import { runFloorJob } from "../../src/dm/floor.js";
import { enqueueTurn, listDmJobs } from "../../src/dm/jobs.js";
import { assemble } from "../../src/dm/nodes/assemble.js";
import { resolve } from "../../src/dm/nodes/resolve.js";
import { loadSeed } from "../../src/dm/seed/load.js";
import type { PresenceReader } from "../../src/presence/index.js";
import {
  clearDmJobsBeforeEach,
  drainAll,
  script,
  workerFor,
} from "./worker-world.js";
import {
  createWorld,
  db,
  defaultDirector,
  loudSkip,
  player,
  reachable,
  readRows,
  requireDb,
  TAMSIN_USER,
  type World,
} from "./world.js";

/**
 * Spec 054 research R9 (database): the duo seed seats two humans through the real
 * queue, and group sign-off and the turn floor behave with two human seats.
 */

loudSkip("duo.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

const KESTREL_USER = "00000000-0000-4000-8000-0000000000a2";
const kestrelPlayer: Proposer = {
  kind: "human",
  userId: KESTREL_USER,
  role: "player",
};
const DUO = loadSeed("greyhollow-ford-duo");

/** Who is at the table, moved by the test. */
function crowd(initial: string[]) {
  let present = [...initial];
  const reader: PresenceReader = {
    presentUsers: () =>
      present.map((userId) => ({ userId, displayName: userId })),
    isPresent: (_sessionId, actor) =>
      actor.startsWith("ai:") || present.includes(actor),
    onChange: () => () => {},
  };
  return {
    reader,
    set(ids: string[]) {
      present = [...ids];
    },
  };
}

/** A duo table after scene start through the real queue. */
async function duoWorld(presence: PresenceReader) {
  const s = script("turn-floor-round.json");
  const sceneStart = script("scene-start.json");
  const w = await createWorld({
    dice: s.dice,
    calls: [
      ...sceneStart.calls,
      // Chronicle passes vary with idle timing; spare ones are harmless.
      ...[1, 2, 3].map(() => ({
        purpose: "dm.chronicle",
        respond: { type: "json", value: { entries: [] } },
      })),
    ],
    presence,
  });
  const wired = workerFor(w, { presence });
  await enqueueTurn(requireDb(), w.sessionId, "scene-start", null, {
    start: {
      seedId: "greyhollow-ford-duo",
      seats: { tamsin: TAMSIN_USER, kestrel: KESTREL_USER },
    },
  });
  await drainAll(wired.worker);
  return { w, ...wired };
}

async function declareParty(w: World, who: Proposer, actionId: string) {
  const declared = await w.as(who, {
    kind: "action.declare",
    action: {
      actionId,
      characterId: null,
      scope: "party",
      text: "The party crosses the ford together.",
    },
  });
  if (!declared.ok)
    throw new Error(`declare refused: ${declared.refusal.code}`);
}

describe.skipIf(!reachable)("two humans at one table (database)", () => {
  it("scene start seats tamsin and kestrel as players and odo as the companion", async () => {
    const c = crowd([TAMSIN_USER, KESTREL_USER]);
    const { w } = await duoWorld(c.reader);
    const p = await w.projections();
    expect(p.scene?.sceneId).toBe("greyhollow-ford-duo");
    expect(p.party).toHaveLength(3);
    const by = (id: string) => p.party.find((m) => m.characterId === id);
    expect(by("tamsin")?.controller).toEqual({
      kind: "player",
      userId: TAMSIN_USER,
    });
    expect(by("kestrel")?.controller).toEqual({
      kind: "player",
      userId: KESTREL_USER,
    });
    expect(by("odo")?.controller).toEqual({
      kind: "ai-companion",
      actor: "ai:companion:odo",
    });
    const jobs = await listDmJobs(requireDb(), w.sessionId, 50);
    expect(jobs.filter((j) => j.status === "failed")).toEqual([]);
  });

  it("a party action with both present commits only after both approve", async () => {
    const c = crowd([TAMSIN_USER, KESTREL_USER]);
    const { w } = await duoWorld(c.reader);
    await declareParty(w, player, "act-party");
    const before = (await readRows(w)).length;

    const early = await w.as(player, {
      kind: "action.commit",
      actionId: "act-party",
    });
    expect(early.ok ? "ok" : early.refusal.code).toBe("GROUP_SIGNOFF_REQUIRED");
    if (!early.ok)
      expect(early.refusal.details).toEqual({
        waiting: [KESTREL_USER],
        objecting: [],
      });
    expect(await readRows(w)).toHaveLength(before);

    const approved = await w.as(kestrelPlayer, {
      kind: "action.comment",
      comment: { actionId: "act-party", stance: "approve", text: "Agreed." },
    });
    expect(approved.ok).toBe(true);
    if (approved.ok)
      expect(approved.events.map((e) => e.type)).toEqual([
        "action.commented",
        "presence.recorded",
        "action.committed",
      ]);
    const status = (await w.projections()).actions.find(
      (a) => a.actionId === "act-party",
    )?.status;
    expect(status).toBe("committed");
  });

  it("with kestrel's player absent, tamsin's player alone commits it", async () => {
    const c = crowd([TAMSIN_USER]);
    const { w } = await duoWorld(c.reader);
    await declareParty(w, player, "act-party");
    const committed = await w.as(player, {
      kind: "action.commit",
      actionId: "act-party",
    });
    expect(committed.ok ? "ok" : committed.refusal.code).toBe("ok");
    const status = (await w.projections()).actions.find(
      (a) => a.actionId === "act-party",
    )?.status;
    expect(status).toBe("committed");
  });

  it("in turn mode the floor passes an absent kestrel player's turn to odo", async () => {
    const c = crowd([TAMSIN_USER]);
    const { w } = await duoWorld(c.reader);
    // Bring in the reed-camp fight with the duo seed (the helper world uses the single-human seed).
    const base = { ...w.ctx(), seed: DUO };
    const assembled = await assemble(base);
    if (!assembled.ok) throw new Error("assemble failed");
    const started = await resolve({
      ...base,
      results: {
        assemble: assembled.output,
        director: {
          ...defaultDirector,
          tableMode: {
            to: "turn",
            encounterId: "reed-camp",
            reason: "Fight.",
          },
        },
        interpret: { readings: [] },
      },
    });
    if (!started.ok)
      throw new Error(`turn mode failed: ${started.error.message}`);

    const p0 = await w.projections();
    expect(p0.encounter?.order.slice(0, 3).map((o) => o.combatantId)).toEqual([
      "tamsin",
      "kestrel",
      "odo",
    ]);
    expect(p0.tableMode).toMatchObject({ activeActor: TAMSIN_USER });

    // Tamsin's player ends the turn: the floor goes to kestrel's player, who is not here.
    const ended = await w.as(player, {
      kind: "floor",
      op: "end",
      turn: {
        round: p0.encounter?.round ?? 1,
        combatantId: p0.encounter?.activeCombatantId ?? "",
      },
      reason: "Tamsin ends her turn.",
    });
    expect(ended.ok).toBe(true);
    expect((await w.projections()).tableMode).toMatchObject({
      activeActor: KESTREL_USER,
      activeCharacterId: "kestrel",
    });

    // The absence check the enqueuer arms for the holder, run directly: no timer, no race.
    const result = await runFloorJob(
      {
        db: requireDb(),
        gate: w.gate,
        loadProjections: () => w.projections(),
        presence: c.reader,
        log: () => {},
      },
      {
        id: "00000000-0000-4000-8000-000000000f10",
        input: {
          v: 1,
          sessionId: w.sessionId,
          check: "absence",
          actionId: null,
          holder: KESTREL_USER,
          stanceSeq: null,
          notBefore: new Date().toISOString(),
        },
      },
    );
    expect(result.outcome).toBe("passed");
    expect((await w.projections()).tableMode).toMatchObject({
      activeActor: "ai:companion:odo",
    });
  });
});
