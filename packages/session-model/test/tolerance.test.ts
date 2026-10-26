import { emptyState } from "@the-stacks/dnd5e-engine";
import { describe, expect, it } from "vitest";
import { project, type StoredEvent } from "../src/index.js";
import {
  anaCombatant,
  batchSpecs,
  envelope,
  makeRows,
  richSpecs,
  row,
  run,
} from "./helpers.js";

const dm = { role: "dm" } as const;

describe("tolerance (AC #8)", () => {
  it("unknown type, unknown version, invalid payload and type mismatch fold without throwing", () => {
    const [mech] = batchSpecs(
      run(emptyState(), {
        type: "combatant.add",
        combatant: anaCombatant,
        reason: "r",
      }).events,
      "b",
    );
    const rows: StoredEvent[] = [
      row("future.thing", { x: 1 }, { seq: 1 }),
      row(
        "talk",
        { text: "x", channel: "ic", characterId: null },
        { seq: 2, payloadVersion: 9 },
      ),
      row("talk", { text: "", channel: "ic", characterId: null }, { seq: 3 }),
      row("dice.rolled", (mech as { payload: unknown }).payload, { seq: 4 }),
      row("talk", null, { seq: 5 }),
      row(
        "talk",
        { text: "fine", channel: "ic", characterId: null },
        { seq: 6 },
      ),
    ];
    const p = project(rows, dm);
    expect(p.diagnostics.skippedUnknownType).toBe(1);
    expect(p.diagnostics.skippedUnknownVersion).toBe(1);
    expect(p.diagnostics.skippedInvalid).toBe(3);
    expect(p.throughSeq).toBe(6);
    expect(p.transcript).toHaveLength(1);
    expect(p.ledger).toEqual([]);
  });

  it("an engine event naming an unknown combatant counts engineRejected", () => {
    const damage = run(
      run(emptyState(), {
        type: "combatant.add",
        combatant: anaCombatant,
        reason: "r",
      }).state,
      {
        type: "damage.apply",
        targetId: "ana",
        components: [
          { amount: { kind: "fixed", value: 1 }, damageType: "fire" },
        ],
        reason: "r",
      },
    ).events;
    // The add event is missing: the engine state has no "ana".
    const p = project(makeRows(batchSpecs(damage, "b-dmg")), dm);
    expect(p.diagnostics.engineRejected).toBeGreaterThan(0);
    expect(p.engine).toEqual(emptyState());
    expect(p.diagnostics.skippedInvalid).toBe(0);
  });

  it("a batch missing one row folds and is named in incompleteBatches", () => {
    const events = run(emptyState(), {
      type: "roll",
      expression: "2d6",
      reason: "r",
    }).events;
    const withAttack = run(
      run(emptyState(), {
        type: "combatant.add",
        combatant: anaCombatant,
        reason: "r",
      }).state,
      { type: "exhaustion.adjust", targetId: "ana", delta: 1, reason: "r" },
    ).events;
    const all = [...events, ...withAttack];
    expect(all.length).toBeGreaterThan(1);
    const specs = batchSpecs(all, "b-split");
    const full = project(makeRows(specs), dm);
    expect(full.diagnostics.incompleteBatches).toEqual([]);
    expect(full.pendingBatches).toEqual({});
    const partial = project(makeRows(specs.slice(0, -1)), dm);
    expect(partial.diagnostics.incompleteBatches).toEqual(["b-split"]);
    expect(partial.ledger.length).toBeGreaterThan(0);
  });

  it("never throws on junk rows", () => {
    const junk = [
      row("talk", 42),
      row("narration", { deep: { deeper: [1, [2, [3]]] } }, { seq: 2 }),
      row("dice.rolled", envelope({} as never), { seq: 3 }),
    ];
    expect(() => project(junk, dm)).not.toThrow();
    expect(project(junk, dm).diagnostics.skippedInvalid).toBe(3);
  });

  it("richSpecs folds clean", () => {
    const p = project(makeRows(richSpecs()), dm);
    expect(p.diagnostics).toEqual({
      skippedUnknownType: 0,
      skippedUnknownVersion: 0,
      skippedInvalid: 0,
      outOfOrder: 0,
      ignoredTransitions: 0,
      beforeMismatches: 0,
      engineRejected: 0,
      incompleteBatches: [],
    });
  });
});
