import { activeActorFor, type Proposer } from "@the-stacks/session-model";
import { afterAll, describe, expect, it } from "vitest";
import { listDmJobs } from "../../src/dm/jobs.js";
import { loadProjections } from "../../src/session/projections.js";
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
  loudSkip,
  player,
  reachable,
  readRows,
  requireDb,
  startScene,
  TAMSIN_USER,
  type World,
} from "./world.js";

/**
 * The TASK-0050 merge condition (specs/049-turn-floor Phase 4, FR-024, SC-001): one full round
 * with two human seats (Ana on Tamsin, Bram on Kestrel) and one AI companion (Pip, Odo's seat)
 * through the real gate, queue and worker on the fake gateway. The floor passes Ana (End turn)
 * to Bram (commit and resolve) to Pip (companion turn) to the goblin (monster turn) and back
 * to Ana in round 2.
 */

loudSkip("turn-floor-round.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});
clearDmJobsBeforeEach();

const BRAM_USER = "00000000-0000-4000-8000-0000000000a2";
const bram: Proposer = { kind: "human", userId: BRAM_USER, role: "player" };
const aiDm: Proposer = { kind: "ai", actor: "ai:dm" };
const PIP = "ai:companion:odo";

const holders = async (w: World) =>
  (await readRows(w))
    .filter((r) => r.type === "table-mode.changed")
    .map(
      (r) =>
        (r.payload as { after: { mode: string; activeActor?: string } }).after
          .activeActor ?? "free",
    );

const turnOf = async (w: World) => {
  const p = await w.projections();
  if (!p.encounter) throw new Error("no encounter");
  return {
    round: p.encounter.round,
    combatantId: p.encounter.activeCombatantId,
  };
};

async function roundWorld() {
  const s = script("turn-floor-round.json");
  const w = await createWorld({
    dice: s.dice,
    calls: [
      ...s.calls,
      // Chronicle passes vary with idle timing; spare ones are harmless.
      ...[1, 2, 3].map(() => ({
        purpose: "dm.chronicle",
        respond: { type: "json", value: { entries: [] } },
      })),
    ],
  });
  await startScene(w);
  const { result } = await w.runResolve({
    director: {
      tableMode: { to: "turn", encounterId: "reed-camp", reason: "Fight." },
    },
    job: { id: "00000000-0000-4000-8000-000000000a60" },
  });
  if (!result.ok) throw new Error(`turn mode failed: ${result.error.message}`);
  // Bram takes Kestrel. Odo stays Pip, the AI companion.
  const p0 = await w.projections();
  const kestrel = p0.party.find((m) => m.characterId === "kestrel");
  if (!kestrel) throw new Error("no kestrel");
  const party = await w.as(aiDm, {
    kind: "party",
    reason: "Bram takes Kestrel",
    characterId: "kestrel",
    after: {
      characterId: "kestrel",
      name: kestrel.name,
      controller: { kind: "player", userId: BRAM_USER },
      combatantId: kestrel.combatantId,
    },
  });
  if (!party.ok) throw new Error(`party refused: ${party.refusal.code}`);
  // Three goblins flee, so the round holds one monster turn (Snag).
  for (const id of ["goblin-2", "goblin-3", "goblin-4"]) {
    const fled = await w.as(aiDm, {
      kind: "scene-presence",
      actorId: id,
      reason: "fled",
    });
    if (!fled.ok) throw new Error(`${id} stayed: ${fled.refusal.code}`);
  }
  return w;
}

describe.skipIf(!reachable)("turn floor, a full round (database)", () => {
  it("passes the floor Ana, Bram, Pip, the goblin, then Ana in round 2", async () => {
    const w = await roundWorld();
    const { worker } = workerFor(w);
    const start = await w.projections();
    expect(start.encounter?.order.map((o) => o.combatantId)).toEqual([
      "tamsin",
      "kestrel",
      "odo",
      "snag",
    ]);
    expect(start.encounter?.round).toBe(1);
    expect(start.tableMode).toMatchObject({ activeActor: TAMSIN_USER });

    // AC #2: Ana's open action takes Bram's suggestion; both viewers see it.
    const anaAct = await w.as(player, {
      kind: "action.declare",
      action: {
        actionId: "act-ana",
        characterId: "tamsin",
        scope: "character",
        text: "Tamsin swings at the goblin.",
      },
    });
    expect(anaAct.ok).toBe(true);
    const comment = await w.as(bram, {
      kind: "action.comment",
      comment: {
        actionId: "act-ana",
        stance: "comment",
        text: "Shove it into the pit instead.",
      },
    });
    expect(comment.ok).toBe(true);
    for (const viewer of [
      { role: "player" as const, userId: TAMSIN_USER },
      { role: "player" as const, userId: BRAM_USER },
    ]) {
      const seen = await loadProjections(requireDb(), w.sessionId, viewer);
      const card = seen.actions.find((a) => a.actionId === "act-ana");
      expect(JSON.stringify(card)).toContain("Shove it into the pit instead.");
    }

    // AC #1: Bram declares ahead of his turn; his commit is refused and writes nothing.
    const bramAct = await w.as(bram, {
      kind: "action.declare",
      action: {
        actionId: "act-bram",
        characterId: "kestrel",
        scope: "character",
        text: "Kestrel slips along the old posts.",
      },
    });
    expect(bramAct.ok).toBe(true);
    const rowsBefore = (await readRows(w)).length;
    const early = await w.as(bram, {
      kind: "action.commit",
      actionId: "act-bram",
    });
    expect(early.ok ? "ok" : early.refusal.code).toBe("COMMIT_NOT_ALLOWED");
    expect(await readRows(w)).toHaveLength(rowsBefore);

    // Ana withdraws her open action and ends her turn: the floor goes to Bram.
    const withdrawn = await w.as(player, {
      kind: "action.withdraw",
      actionId: "act-ana",
    });
    expect(withdrawn.ok).toBe(true);
    const ended = await w.as(player, {
      kind: "floor",
      op: "end",
      turn: await turnOf(w),
      reason: "Tamsin ends her turn.",
    });
    expect(ended.ok).toBe(true);
    const afterEnd = await w.projections();
    expect(afterEnd.tableMode).toMatchObject({
      activeActor: BRAM_USER,
      activeCharacterId: "kestrel",
    });
    expect(afterEnd.encounter?.round).toBe(1);

    // Bram commits his own action on his turn; the worker resolves it and
    // advances to Pip, whose companion turn job acts; the goblin follows.
    const committed = await w.as(bram, {
      kind: "action.commit",
      actionId: "act-bram",
    });
    expect(committed.ok).toBe(true);
    await tick();
    await drainAll(worker);

    const end = await w.projections();
    expect(end.encounter?.round).toBe(2);
    expect(end.encounter?.activeCombatantId).toBe("tamsin");
    expect(end.tableMode).toMatchObject({
      mode: "turn",
      ...activeActorFor(end, "tamsin"),
    });
    expect(await holders(w)).toEqual([
      TAMSIN_USER,
      BRAM_USER,
      PIP,
      "ai:dm",
      TAMSIN_USER,
    ]);

    // Each turn ended once: one advance for Ana, Bram, Pip and the goblin.
    const rows = await readRows(w);
    expect(rows.filter((r) => r.type === "turn.advanced")).toHaveLength(4);
    const committers = rows
      .filter((r) => r.type === "action.committed")
      .map((r) => r.actor);
    expect(committers).toEqual([BRAM_USER, PIP]);

    // The script is spent (chronicle passes vary with idle timing).
    const left = w.scripted.remaining();
    expect(left.dice).toBe(0);
    for (const [purpose, n] of Object.entries(left.calls)) {
      if (purpose !== "dm.chronicle")
        expect([purpose, n]).toEqual([purpose, 0]);
    }

    // Jobs: three turn jobs (Bram, Pip, Snag), one companion turn job; none failed.
    const jobs = await listDmJobs(requireDb(), w.sessionId, 50);
    expect(jobs.filter((j) => j.status === "failed")).toEqual([]);
    expect(jobs.filter((j) => j.kind === "turn")).toHaveLength(3);
    expect(jobs.filter((j) => j.kind === "companion")).toHaveLength(1);
  });
});
