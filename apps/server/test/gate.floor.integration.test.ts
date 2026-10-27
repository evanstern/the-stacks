import {
  activeActorFor,
  type Proposer,
  type StoredEvent,
} from "@the-stacks/session-model";
import { afterAll, describe, expect, it } from "vitest";
import {
  createWorld,
  db,
  HUMAN_DM,
  loudSkip,
  operator,
  player,
  reachable,
  readRows,
  startScene,
  TAMSIN_USER,
  type World,
} from "./dm/world.js";

/**
 * The `floor` request through the real gate (specs/049-turn-floor Phase 3, US2 and US3): two
 * human seats (Tamsin, Bram on Kestrel), a seated human DM, and a turn-mode encounter.
 */

loudSkip("gate.floor.integration.test.ts");
afterAll(async () => {
  await db?.$client.end();
});

const BRAM_USER = "00000000-0000-4000-8000-0000000000a2";
const bram: Proposer = { kind: "human", userId: BRAM_USER, role: "player" };
const aiDm: Proposer = { kind: "ai", actor: "ai:dm" };
const initDice = (first: number) =>
  [1, 1, 1, 1, 1, 1, 1].map((d, i) => (i === first ? 20 : d));

async function floorWorld() {
  const seen: { a: string[][]; b: string[][] } = { a: [], b: [] };
  const w = await createWorld({
    dice: initDice(0),
    gate: (g) => {
      g.onAppended((_sid, events: StoredEvent[]) =>
        seen.a.push(events.map((e) => e.type)),
      );
      g.onAppended((_sid, events: StoredEvent[]) =>
        seen.b.push(events.map((e) => e.type)),
      );
      return g;
    },
  });
  await startScene(w);
  const { result } = await w.runResolve({
    director: {
      tableMode: { to: "turn", encounterId: "reed-camp", reason: "Fight." },
    },
    job: { id: "00000000-0000-4000-8000-000000000a50" },
  });
  if (!result.ok) throw new Error(`turn mode failed: ${result.error.message}`);
  // Bram takes Kestrel; a human takes the DM seat.
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
  const seat = await w.as(operator, {
    kind: "dm.seat",
    reason: "A human takes the DM seat",
    after: { kind: "human", userId: HUMAN_DM },
  });
  if (!seat.ok) throw new Error(`seat refused: ${seat.refusal.code}`);
  return { w, seen };
}

const turnOf = async (w: World) => {
  const p = await w.projections();
  if (!p.encounter) throw new Error("no encounter");
  return {
    round: p.encounter.round,
    combatantId: p.encounter.activeCombatantId,
  };
};
const floor = async (
  w: World,
  who: Proposer,
  op: "end" | "take" | "return",
  turn?: { round: number; combatantId: string },
) =>
  w.as(who, {
    kind: "floor",
    op,
    turn: turn ?? (await turnOf(w)),
    reason: `${op} the floor`,
  });
const refusalCode = (r: Awaited<ReturnType<World["as"]>>) =>
  r.ok ? "ok" : r.refusal.code;

describe.skipIf(!reachable)("gate floor requests (database)", () => {
  it("End turn by the active human lands one batch and names the next holder", async () => {
    const { w, seen } = await floorWorld();
    const p0 = await w.projections();
    expect(p0.tableMode).toMatchObject({ activeActor: TAMSIN_USER });
    const before = (await readRows(w)).length;
    seen.a.length = 0;
    seen.b.length = 0;

    const res = await floor(w, player, "end");
    expect(res.ok).toBe(true);
    const rows = (await readRows(w)).slice(before);
    const types = rows.map((r) => r.type);
    expect(types.filter((t) => t === "turn.advanced")).toHaveLength(1);
    expect(types.at(-1)).toBe("table-mode.changed");
    const p1 = await w.projections();
    const next = p1.encounter?.activeCombatantId ?? "";
    expect(next).not.toBe("tamsin");
    expect(p1.tableMode).toMatchObject({
      mode: "turn",
      ...activeActorFor(p1, next),
    });
    // Every subscriber receives the table-mode row, in one notification.
    expect(seen.a).toHaveLength(1);
    expect(seen.a[0]).toContain("table-mode.changed");
    expect(seen.b).toEqual(seen.a);
  });

  it("another human is refused FLOOR_NOT_HELD and the log is unchanged", async () => {
    const { w } = await floorWorld();
    const before = (await readRows(w)).length;
    const res = await floor(w, bram, "end");
    expect(refusalCode(res)).toBe("FLOOR_NOT_HELD");
    expect(await readRows(w)).toHaveLength(before);
  });

  it("a stale turn is refused TURN_MOVED and the log is unchanged", async () => {
    const { w } = await floorWorld();
    const now = await turnOf(w);
    const before = (await readRows(w)).length;
    const res = await floor(w, player, "end", {
      round: now.round + 1,
      combatantId: now.combatantId,
    });
    expect(refusalCode(res)).toBe("TURN_MOVED");
    expect(await readRows(w)).toHaveLength(before);
  });

  it("the DM passes, takes and returns the floor", async () => {
    const { w, seen } = await floorWorld();
    const start = await turnOf(w);

    const passed = await floor(w, operator, "end");
    expect(passed.ok).toBe(true);
    const afterPass = await turnOf(w);
    expect(afterPass.combatantId).not.toBe(start.combatantId);

    seen.a.length = 0;
    seen.b.length = 0;
    const taken = await floor(w, operator, "take");
    expect(taken.ok).toBe(true);
    const p = await w.projections();
    expect(p.tableMode).toEqual({
      mode: "turn",
      activeActor: HUMAN_DM,
      activeCharacterId: null,
    });
    expect(await turnOf(w)).toEqual(afterPass);
    expect(seen.a).toEqual([["table-mode.changed"]]);
    expect(seen.b).toEqual(seen.a);

    const returned = await floor(w, operator, "return");
    expect(returned.ok).toBe(true);
    const p2 = await w.projections();
    expect(p2.tableMode).toMatchObject({
      mode: "turn",
      ...activeActorFor(p2, afterPass.combatantId),
    });
    expect(await turnOf(w)).toEqual(afterPass);
  });

  it("a player cannot take or return the floor", async () => {
    const { w } = await floorWorld();
    const before = (await readRows(w)).length;
    expect(refusalCode(await floor(w, player, "take"))).toBe("NOT_DM");
    expect(refusalCode(await floor(w, player, "return"))).toBe("NOT_DM");
    expect(await readRows(w)).toHaveLength(before);
  });

  it("a player commit while the DM holds the floor is COMMIT_NOT_ALLOWED", async () => {
    const { w } = await floorWorld();
    const declared = await w.as(player, {
      kind: "action.declare",
      action: {
        actionId: "act-floor-1",
        characterId: "tamsin",
        scope: "character",
        text: "Tamsin swings.",
      },
    });
    expect(declared.ok).toBe(true);
    const taken = await floor(w, operator, "take");
    expect(taken.ok).toBe(true);
    const before = (await readRows(w)).length;
    const res = await w.as(player, {
      kind: "action.commit",
      actionId: "act-floor-1",
    });
    expect(refusalCode(res)).toBe("COMMIT_NOT_ALLOWED");
    expect(await readRows(w)).toHaveLength(before);
  });
});
