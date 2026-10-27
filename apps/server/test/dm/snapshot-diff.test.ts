import { describe, expect, it } from "vitest";
import { buildSnapshot, diffSnapshots } from "../../src/dm/snapshot/index.js";
import {
  clone,
  combatant,
  condition,
  greyhollowFight,
} from "./snapshot-fixtures.js";

function pair(
  mutate: (p: ReturnType<typeof greyhollowFight>["projections"]) => void,
) {
  const { projections, seed } = greyhollowFight();
  const s0 = buildSnapshot(projections, seed);
  const p1 = clone(projections);
  mutate(p1);
  p1.throughSeq = 130;
  return { s0, s1: buildSnapshot(p1, seed), seed };
}

describe("diffSnapshots", () => {
  it("is empty on identical input", () => {
    const { projections, seed } = greyhollowFight();
    const s = buildSnapshot(projections, seed);
    expect(diffSnapshots(s, s)).toEqual({
      fromSeq: 120,
      toSeq: 120,
      actors: [],
      stage: [],
    });
    expect(
      diffSnapshots(s, buildSnapshot(clone(projections), seed)).actors,
    ).toEqual([]);
  });

  it("gives one hp and one life-state entry for a kill", () => {
    const { s0, s1 } = pair((p) => {
      const g = p.engine.combatants["goblin-3"];
      if (!g) throw new Error("no goblin");
      g.hp = { current: 0, max: 10, temp: 0 };
      g.lifeState = "dead";
    });
    const d = diffSnapshots(s0, s1);
    expect(d.fromSeq).toBe(120);
    expect(d.toSeq).toBe(130);
    expect(d.actors).toEqual([
      {
        kind: "hp",
        actorId: "goblin-3",
        before: { current: 10, temp: 0 },
        after: { current: 0, temp: 0 },
      },
      {
        kind: "life-state",
        actorId: "goblin-3",
        before: "conscious",
        after: "dead",
      },
    ]);
    expect(d.stage).toEqual([]);
  });

  it("matches conditions by instanceId: one applied, one removed", () => {
    const { projections, seed } = greyhollowFight();
    const p0 = clone(projections);
    const o = p0.engine.combatants.odo;
    if (!o) throw new Error("no odo");
    o.conditions = [condition("i1", "poisoned")];
    const s0 = buildSnapshot(p0, seed);
    const p1 = clone(p0);
    const o1 = p1.engine.combatants.odo;
    if (!o1) throw new Error("no odo");
    o1.conditions = [condition("i2", "poisoned")];
    const s1 = buildSnapshot(p1, seed);
    expect(diffSnapshots(s0, s1).actors).toEqual([
      {
        kind: "condition",
        actorId: "odo",
        op: "applied",
        condition: "poisoned",
      },
      {
        kind: "condition",
        actorId: "odo",
        op: "removed",
        condition: "poisoned",
      },
    ]);
  });

  it("reports joined and left actors", () => {
    const { s0, s1 } = pair((p) => {
      p.engine.combatants["goblin-9"] = combatant("goblin-9", "Goblin");
      delete p.engine.combatants["goblin-4"];
    });
    const d = diffSnapshots(s0, s1);
    expect(d.actors).toEqual([
      { kind: "joined", actorId: "goblin-9" },
      { kind: "left", actorId: "goblin-4", name: "Goblin" },
    ]);
  });

  it("reports encounter start and end", () => {
    const { projections, seed } = greyhollowFight();
    const noFight = clone(projections);
    noFight.encounter = null;
    noFight.engine.encounter = null;
    noFight.tableMode = { mode: "free" };
    const sNo = buildSnapshot(noFight, seed);
    const sFight = buildSnapshot(projections, seed);
    const started = diffSnapshots(sNo, sFight);
    expect(started.stage).toEqual([
      { kind: "table-mode", before: "free", after: "turn" },
      { kind: "active-actor", before: null, after: "snag" },
      { kind: "encounter-started" },
    ]);
    // initiative appears for the actors that rolled
    expect(started.actors.filter((a) => a.kind === "initiative")).toHaveLength(
      5,
    );
    const ended = diffSnapshots(sFight, sNo);
    expect(ended.stage).toEqual([
      { kind: "table-mode", before: "turn", after: "free" },
      { kind: "active-actor", before: "snag", after: null },
      { kind: "encounter-ended" },
    ]);
  });

  it("reports round, active actor, tracker and scene changes in union order", () => {
    const { s0, s1 } = pair((p) => {
      if (p.encounter) {
        p.encounter.round = 3;
        p.encounter.activeCombatantId = "tamsin";
      }
      const t = p.trackers[0];
      if (t) t.filled = 3;
      p.trackers.push({
        trackerId: "alarm",
        name: "Alarm",
        segments: 4,
        filled: 1,
        note: null,
      });
      p.scene = { sceneId: "next", title: "Next", summary: "", location: null };
    });
    expect(diffSnapshots(s0, s1).stage).toEqual([
      { kind: "active-actor", before: "snag", after: "tamsin" },
      { kind: "round", before: 2, after: 3 },
      { kind: "tracker", trackerId: "dusk", before: 2, after: 3 },
      { kind: "tracker", trackerId: "alarm", before: null, after: 1 },
      { kind: "scene", before: "greyhollow-ford", after: "next" },
    ]);
  });

  it("gives active-actor when an AI companion's turn begins", () => {
    const { s0, s1 } = pair((p) => {
      p.tableMode = {
        mode: "turn",
        activeActor: "ai:companion:odo",
        activeCharacterId: null,
      };
    });
    expect(diffSnapshots(s0, s1).stage).toEqual([
      { kind: "active-actor", before: "snag", after: "odo" },
    ]);
  });

  it("gives nothing for a max-HP-only change", () => {
    const { s0, s1 } = pair((p) => {
      const t = p.engine.combatants.tamsin;
      if (t) t.hp = { current: 18, max: 30, temp: 0 };
    });
    expect(diffSnapshots(s0, s1).actors).toEqual([]);
  });

  it("reports resources with both whole values", () => {
    const { s0, s1 } = pair((p) => {
      const o = p.engine.combatants.odo;
      if (o)
        o.spellSlots = {
          standard: { "1": { max: 3, expended: 2 } },
          pact: null,
        };
    });
    const d = diffSnapshots(s0, s1);
    expect(d.actors).toHaveLength(1);
    expect(d.actors[0]).toMatchObject({ kind: "resources", actorId: "odo" });
  });
});
