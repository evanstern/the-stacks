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
 * Spec 061 (database): the trio seed seats three humans through the real queue,
 * no companion job is queued, and group sign-off and the turn floor behave with
 * three human seats.
 */

loudSkip("trio.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

const ODO_USER = "00000000-0000-4000-8000-0000000000a3";
const KESTREL_USER = "00000000-0000-4000-8000-0000000000a2";
const odoPlayer: Proposer = { kind: "human", userId: ODO_USER, role: "player" };
const kestrelPlayer: Proposer = {
  kind: "human",
  userId: KESTREL_USER,
  role: "player",
};
const TRIO = loadSeed("greyhollow-ford-trio");

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

/** A trio table after scene start through the real queue. */
async function trioWorld(presence: PresenceReader) {
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
      seedId: "greyhollow-ford-trio",
      seats: {
        tamsin: TAMSIN_USER,
        odo: ODO_USER,
        kestrel: KESTREL_USER,
      },
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

const ALL = [TAMSIN_USER, ODO_USER, KESTREL_USER];

describe.skipIf(!reachable)("three humans at one table (database)", () => {
  it("scene start seats tamsin, odo and kestrel as players and queues no companion job", async () => {
    const c = crowd(ALL);
    const { w } = await trioWorld(c.reader);
    const p = await w.projections();
    expect(p.scene?.sceneId).toBe("greyhollow-ford-trio");
    expect(p.party).toHaveLength(3);
    const by = (id: string) => p.party.find((m) => m.characterId === id);
    expect(by("tamsin")?.controller).toEqual({
      kind: "player",
      userId: TAMSIN_USER,
    });
    expect(by("odo")?.controller).toEqual({
      kind: "player",
      userId: ODO_USER,
    });
    expect(by("kestrel")?.controller).toEqual({
      kind: "player",
      userId: KESTREL_USER,
    });
    expect(p.party.some((m) => m.controller.kind === "ai-companion")).toBe(
      false,
    );
    const jobs = await listDmJobs(requireDb(), w.sessionId, 50);
    expect(jobs.filter((j) => j.status === "failed")).toEqual([]);
    expect(jobs.filter((j) => j.kind === "companion")).toEqual([]);
  });

  it("a party action with all three present commits only after all three approve", async () => {
    const c = crowd(ALL);
    const { w } = await trioWorld(c.reader);
    await declareParty(w, player, "act-party");
    const before = (await readRows(w)).length;

    const early = await w.as(player, {
      kind: "action.commit",
      actionId: "act-party",
    });
    expect(early.ok ? "ok" : early.refusal.code).toBe("GROUP_SIGNOFF_REQUIRED");
    if (!early.ok)
      expect(
        [...(early.refusal.details as { waiting: string[] }).waiting].sort(),
      ).toEqual([ODO_USER, KESTREL_USER].sort());
    expect(await readRows(w)).toHaveLength(before);

    const first = await w.as(odoPlayer, {
      kind: "action.comment",
      comment: { actionId: "act-party", stance: "approve", text: "Agreed." },
    });
    expect(first.ok).toBe(true);
    expect(
      (await w.projections()).actions.find((a) => a.actionId === "act-party")
        ?.status,
    ).not.toBe("committed");

    const second = await w.as(kestrelPlayer, {
      kind: "action.comment",
      comment: { actionId: "act-party", stance: "approve", text: "Agreed." },
    });
    expect(second.ok).toBe(true);
    expect(
      (await w.projections()).actions.find((a) => a.actionId === "act-party")
        ?.status,
    ).toBe("committed");
  });

  it("with kestrel's player absent, the other two approvals commit it", async () => {
    const c = crowd([TAMSIN_USER, ODO_USER]);
    const { w } = await trioWorld(c.reader);
    await declareParty(w, player, "act-party");
    const early = await w.as(player, {
      kind: "action.commit",
      actionId: "act-party",
    });
    expect(early.ok ? "ok" : early.refusal.code).toBe("GROUP_SIGNOFF_REQUIRED");
    if (!early.ok)
      expect(early.refusal.details).toEqual({
        waiting: [ODO_USER],
        objecting: [],
      });
    const approved = await w.as(odoPlayer, {
      kind: "action.comment",
      comment: { actionId: "act-party", stance: "approve", text: "Agreed." },
    });
    expect(approved.ok).toBe(true);
    expect(
      (await w.projections()).actions.find((a) => a.actionId === "act-party")
        ?.status,
    ).toBe("committed");
  });

  it("in turn mode the floor passes an absent player's turn to the next actor and queues no companion turn", async () => {
    const c = crowd([TAMSIN_USER, ODO_USER]);
    const { w } = await trioWorld(c.reader);
    const base = { ...w.ctx(), seed: TRIO };
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
    const order = p0.encounter?.order.map((o) => o.combatantId) ?? [];
    expect(order.slice(0, 3)).toEqual(["tamsin", "kestrel", "odo"]);
    expect(p0.tableMode).toMatchObject({ activeActor: TAMSIN_USER });

    // Tamsin ends her turn: the floor goes to kestrel's player, who is not here.
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

    const result = await runFloorJob(
      {
        db: requireDb(),
        gate: w.gate,
        loadProjections: () => w.projections(),
        presence: c.reader,
        log: () => {},
      },
      {
        id: "00000000-0000-4000-8000-000000000f11",
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
      activeActor: ODO_USER,
      activeCharacterId: "odo",
    });
    const jobs = await listDmJobs(requireDb(), w.sessionId, 50);
    expect(jobs.filter((j) => j.kind === "companion")).toEqual([]);
    expect(
      jobs.filter(
        (j) =>
          j.kind === "turn" && JSON.stringify(j.input).includes("ai:companion"),
      ),
    ).toEqual([]);
  });
});
