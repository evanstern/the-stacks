import { describe, expect, it } from "vitest";
import { project } from "../src/index.js";
import { makeRows, PLAYER_A, PLAYER_B, type RowSpec } from "./helpers.js";

const dm = { role: "dm" } as const;
const turn = (actor: string, ch: string | null = null) => ({
  mode: "turn" as const,
  activeActor: actor,
  activeCharacterId: ch,
});
const change = (before: unknown, after: unknown): RowSpec => ({
  type: "table-mode.changed",
  payload: { reason: "r", before, after },
});
const fold = (specs: RowSpec[]) => project(makeRows(specs), dm);

describe("table mode (AC #3)", () => {
  it("starts free", () => {
    expect(fold([]).tableMode).toEqual({ mode: "free" });
  });

  it("free -> turn -> turn (new actor) -> free", () => {
    const free = { mode: "free" };
    const rows = [
      change(free, turn(PLAYER_A, "ana")),
      change(turn(PLAYER_A, "ana"), turn(PLAYER_B, "bram")),
      change(turn(PLAYER_B, "bram"), free),
    ];
    expect(fold(rows.slice(0, 1)).tableMode).toEqual(turn(PLAYER_A, "ana"));
    expect(fold(rows.slice(0, 2)).tableMode).toEqual(turn(PLAYER_B, "bram"));
    const p = fold(rows);
    expect(p.tableMode).toEqual(free);
    expect(p.diagnostics.beforeMismatches).toBe(0);
    expect(p.ledger.filter((l) => l.kind === "change")).toHaveLength(3);
  });

  it("counts a mismatched before and still applies after", () => {
    const p = fold([change(turn(PLAYER_A), turn(PLAYER_B))]);
    expect(p.diagnostics.beforeMismatches).toBe(1);
    expect(p.tableMode).toEqual(turn(PLAYER_B));
  });
});
