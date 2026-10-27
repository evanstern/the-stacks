import { describe, expect, it } from "vitest";
import {
  activeActorFor,
  canAct,
  currentTurn,
  floorHeld,
  INCAPACITATING,
  nextSettleStep,
} from "../src/index.js";
import {
  BRAM_ACTOR,
  CADE_USER,
  DM_USER,
  dmFold,
  floorFold,
} from "./gate-helpers.js";
import { PLAYER_A } from "./helpers.js";

describe("activeActorFor (research R2)", () => {
  const p = floorFold();
  it("a player-controlled combatant names the player and the character", () => {
    expect(activeActorFor(p, "ana")).toEqual({
      activeActor: PLAYER_A,
      activeCharacterId: "ana",
    });
    expect(activeActorFor(p, "cade")).toEqual({
      activeActor: CADE_USER,
      activeCharacterId: "cade",
    });
  });
  it("a companion names its actor string and the character", () => {
    expect(activeActorFor(p, "bram")).toEqual({
      activeActor: BRAM_ACTOR,
      activeCharacterId: "bram",
    });
  });
  it("a monster names ai:dm and no character", () => {
    expect(activeActorFor(p, "goblin")).toEqual({
      activeActor: "ai:dm",
      activeCharacterId: null,
    });
  });
});

describe("canAct (research R1)", () => {
  it("INCAPACITATING lists the engine's stopping conditions", () => {
    expect([...INCAPACITATING].sort()).toEqual([
      "incapacitated",
      "paralyzed",
      "petrified",
      "stunned",
      "unconscious",
    ]);
  });
  it("a conscious combatant acts; a dying one does not", () => {
    expect(canAct(floorFold().engine, "bram")).toBe(true);
    expect(canAct(floorFold({ downBram: true }).engine, "bram")).toBe(false);
  });
  it("an unknown combatant counts as able", () => {
    expect(canAct(floorFold().engine, "nobody")).toBe(true);
  });
});

describe("nextSettleStep (research R1)", () => {
  it("an able active combatant needs no step", () => {
    expect(nextSettleStep(floorFold({ active: "ana" }).engine)).toBeNull();
  });
  it("no encounter needs no step", () => {
    expect(nextSettleStep(dmFold().engine)).toBeNull();
  });
  it("a dying active combatant rolls a death save", () => {
    const p = floorFold({ downBram: true, active: "bram" });
    expect(nextSettleStep(p.engine)).toEqual({
      type: "death-save.roll",
      targetId: "bram",
    });
  });
  it("a monster that cannot act passes the turn unrolled", () => {
    const p = floorFold({ active: "goblin" });
    const goblin = p.engine.combatants.goblin;
    if (!goblin) throw new Error("no goblin");
    const down = {
      ...p.engine,
      combatants: {
        ...p.engine.combatants,
        goblin: { ...goblin, lifeState: "unconscious" as const },
      },
    };
    expect(nextSettleStep(down)).toEqual({ type: "turn.advance" });
  });
  it("a stable or dead active combatant passes the turn", () => {
    const p = floorFold({ downBram: true, active: "bram" });
    const bram = p.engine.combatants.bram;
    if (!bram) throw new Error("no bram");
    for (const lifeState of ["stable", "dead"] as const) {
      const next = {
        ...p.engine,
        combatants: { ...p.engine.combatants, bram: { ...bram, lifeState } },
      };
      expect(nextSettleStep(next)).toEqual({ type: "turn.advance" });
    }
  });
});

describe("floorHeld and currentTurn (research R6, R4)", () => {
  it("the floor is not held in a normal turn", () => {
    expect(floorHeld(floorFold())).toBe(false);
  });
  it("the floor is held when the seated DM is the active actor with no character", () => {
    const p = floorFold({ held: true });
    expect(floorHeld(p)).toBe(true);
    expect(p.tableMode).toMatchObject({ activeActor: DM_USER });
  });
  it("is never held in free mode or under an AI seat", () => {
    expect(floorHeld(dmFold())).toBe(false);
    expect(floorHeld(floorFold({ humanDm: false }))).toBe(false);
  });
  it("currentTurn is the encounter round and active combatant, or null", () => {
    expect(currentTurn(floorFold({ active: "cade" }))).toEqual({
      round: 1,
      combatantId: "cade",
    });
    expect(currentTurn(dmFold())).toBeNull();
  });
});
