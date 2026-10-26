import { emptyState, evolve } from "@the-stacks/dnd5e-engine";
import { describe, expect, it } from "vitest";
import { project } from "../src/index.js";
import {
  anaCombatant,
  batchSpecs,
  goblinCombatant,
  makeRows,
  member,
  PLAYER_A,
  type RowSpec,
  richRows,
  run,
  scene,
} from "./helpers.js";

const dm = { role: "dm" } as const;

describe("projections from the log alone (AC #4)", () => {
  const p = project(richRows(), dm);

  it("scene and table mode", () => {
    expect(p.scene).toEqual(scene);
    expect(p.tableMode).toEqual({
      mode: "turn",
      activeActor: PLAYER_A,
      activeCharacterId: "ana",
    });
  });

  it("party joins engine hp, life state and conditions", () => {
    expect(p.party).toHaveLength(1);
    const ana = p.party[0];
    expect(ana?.characterId).toBe("ana");
    expect(ana?.combatant?.hp).toEqual({ current: 12, max: 12, temp: 0 });
    expect(ana?.combatant?.lifeState).toBe("conscious");
    expect(ana?.combatant?.conditions).toEqual([]);
    expect(ana?.combatant?.ac).toBe(15);
  });

  it("encounter has order, round, active combatant, linked character", () => {
    const e = p.encounter;
    expect(e).not.toBeNull();
    expect(e?.round).toBe(1);
    expect(e?.order).toHaveLength(2);
    expect(e?.activeCombatantId).toBe(e?.order[e.turnIndex]?.combatantId);
    const ana = e?.order.find((o) => o.combatantId === "ana");
    expect(ana?.characterId).toBe("ana");
    expect(ana?.name).toBe("Ana");
    expect(
      e?.order.find((o) => o.combatantId === "goblin")?.characterId,
    ).toBeNull();
  });

  it("journal keeps entries in log order", () => {
    expect(p.journal.map((j) => j.entryId)).toEqual(["j-dm", "j-pub"]);
  });

  it("engine state equals the engine's own fold", () => {
    let state = emptyState();
    for (const r of makeRows([])) void r;
    const rows = richRows();
    for (const r of rows) {
      const payload = r.payload as { event?: Parameters<typeof evolve>[1] };
      if (payload && "event" in payload && payload.event) {
        state = evolve(state, payload.event);
      }
    }
    expect(p.engine).toEqual(state);
  });

  it("a party member whose combatant is absent shows combatant: null", () => {
    const specs: RowSpec[] = [
      {
        type: "party.member.changed",
        payload: {
          reason: "r",
          characterId: "ana",
          before: null,
          after: { ...member, combatantId: "ghost" },
        },
      },
      {
        type: "party.member.changed",
        payload: {
          reason: "r",
          characterId: "bram",
          before: null,
          after: {
            ...member,
            characterId: "bram",
            name: "Bram",
            combatantId: null,
          },
        },
      },
    ];
    const q = project(makeRows(specs), dm);
    expect(q.party.map((m) => m.combatant)).toEqual([null, null]);
  });

  it("party join, replace and remove, and a later engine add joins the member", () => {
    const base = { reason: "r", characterId: "ana" };
    const add = run(emptyState(), {
      type: "combatant.add",
      combatant: anaCombatant,
      reason: "r",
    });
    const specs: RowSpec[] = [
      {
        type: "party.member.changed",
        payload: { ...base, before: null, after: member },
      },
      ...batchSpecs(add.events, "b-1"),
      {
        type: "party.member.changed",
        payload: {
          ...base,
          before: member,
          after: { ...member, name: "Ana B" },
        },
      },
    ];
    const joined = project(makeRows(specs.slice(0, 1)), dm);
    expect(joined.party[0]?.combatant).toBeNull();
    const full = project(makeRows(specs), dm);
    expect(full.party[0]?.name).toBe("Ana B");
    expect(full.party[0]?.combatant?.hp.max).toBe(12);
    const left = project(
      makeRows([
        ...specs,
        {
          type: "party.member.changed",
          payload: {
            ...base,
            before: { ...member, name: "Ana B" },
            after: null,
          },
        },
      ]),
      dm,
    );
    expect(left.party).toEqual([]);
    expect(left.diagnostics.beforeMismatches).toBe(0);
  });

  it("encounter is null with no encounter, and omits unknown combatants", () => {
    expect(project(makeRows([]), dm).encounter).toBeNull();
    const gob = run(emptyState(), {
      type: "combatant.add",
      combatant: goblinCombatant,
      reason: "r",
    });
    expect(
      project(makeRows(batchSpecs(gob.events, "b")), dm).encounter,
    ).toBeNull();
  });
});
