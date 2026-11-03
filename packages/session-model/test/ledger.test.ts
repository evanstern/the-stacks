import { emptyState } from "@the-stacks/dnd5e-engine";
import { describe, expect, it } from "vitest";
import { project } from "../src/index.js";
import {
  anaCombatant,
  batchSpecs,
  makeRows,
  richRows,
  run,
} from "./helpers.js";

const dm = { role: "dm" } as const;

describe("ledger (AC #6)", () => {
  const rows = richRows();
  const p = project(rows, dm);

  it("has one roll row per dice.rolled, with reason and faces", () => {
    const dice = rows.filter((r) => r.type === "dice.rolled");
    const rolls = p.ledger.filter((l) => l.kind === "roll");
    expect(dice.length).toBeGreaterThan(0);
    expect(rolls).toHaveLength(dice.length);
    for (const l of rolls) {
      if (l.kind !== "roll") continue;
      expect(l.reason.length).toBeGreaterThan(0);
      const faces = l.roll.terms.flatMap((t) =>
        t.kind === "dice" ? t.faces : [],
      );
      expect(faces.length).toBeGreaterThan(0);
      expect(l.batchId).toBeTruthy();
    }
    expect(rolls.some((l) => l.kind === "roll" && l.actionId === "act-1")).toBe(
      true,
    );
  });

  it("has one outcome row per resolved marker", () => {
    const markers = rows.filter(
      (r) =>
        r.type === "attack.resolved" ||
        r.type === "check.resolved" ||
        r.type === "rest.completed",
    );
    expect(markers.length).toBeGreaterThan(0);
    expect(p.ledger.filter((l) => l.kind === "outcome")).toHaveLength(
      markers.length,
    );
  });

  it("has one change row per engine and session state change, with before and after", () => {
    const changeTypes = new Set([
      "combatant.added",
      "combatant.removed",
      "hp.changed",
      "life-state.changed",
      "death-saves.changed",
      "condition.applied",
      "condition.changed",
      "condition.removed",
      "hit-dice.changed",
      "spell-slots.changed",
      "assist.granted",
      "assist.ended",
      "encounter.started",
      "encounter.changed",
      "turn.advanced",
      "encounter.ended",
      "table-mode.changed",
      "scene.changed",
      "party.member.changed",
      "tracker.changed",
    ]);
    const expected = rows.filter((r) => changeTypes.has(r.type));
    const changes = p.ledger.filter((l) => l.kind === "change");
    expect(changes).toHaveLength(expected.length);
    for (const l of changes) {
      if (l.kind !== "change") continue;
      expect(l.reason.length).toBeGreaterThan(0);
      expect(l.before !== null || l.after !== null).toBe(true);
    }
    const added = changes.find(
      (l) => l.kind === "change" && l.type === "combatant.added",
    );
    expect(added?.kind === "change" && added.subject).toBe("ana");
    const scene = changes.find(
      (l) => l.kind === "change" && l.type === "scene.changed",
    );
    expect(scene?.kind === "change" && scene.subject).toBe("vault");
    expect(scene?.kind === "change" && scene.batchId).toBeNull();
  });

  it("is in seq order", () => {
    const seqs = p.ledger.map((l) => l.seq);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
  });

  it("keeps rows even when the engine rejects the event", () => {
    const setup = run(emptyState(), {
      type: "combatant.add",
      combatant: anaCombatant,
      reason: "r",
    });
    const damage = run(setup.state, {
      type: "damage.apply",
      targetId: "ana",
      components: [{ amount: { kind: "fixed", value: 1 }, damageType: "fire" }],
      reason: "r",
    });
    // The add batch is absent: the engine rejects the damage events.
    const q = project(makeRows(batchSpecs(damage.events, "b-dmg")), dm);
    expect(q.diagnostics.engineRejected).toBeGreaterThan(0);
    expect(q.ledger.some((l) => l.kind === "change")).toBe(true);
  });
});
