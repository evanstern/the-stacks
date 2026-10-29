import { describe, expect, it } from "vitest";
import { assemble } from "../../src/dm/nodes/assemble.js";
import {
  aiCompanionIds,
  legalizeDirector,
} from "../../src/dm/nodes/director.js";
import type { DirectorOutput } from "../../src/dm/nodes/schemas.js";
import { CAPS } from "../../src/dm/prompts/common.js";
import { buildDirectorPrompt } from "../../src/dm/prompts/director.js";
import { buildSnapshot, renderSnapshot } from "../../src/dm/snapshot/index.js";
import { makeCtx } from "./helpers.js";
import { greyhollowTrio } from "./snapshot-fixtures.js";

/**
 * Spec 061 (no database): with three humans and no companion, the actor
 * snapshot views label every party member a human player and the AI DM has no
 * companion to prompt.
 */

const { projections, seed } = greyhollowTrio();
const snapshot = buildSnapshot(projections, seed);

function lines(opts: Parameters<typeof renderSnapshot>[1]): string[] {
  const r = renderSnapshot(snapshot, opts);
  if (!r.ok) throw new Error("snapshot overflow");
  return r.lines;
}

describe("trio actor snapshot", () => {
  it("the fiction view calls all three human players, never a companion", () => {
    const fiction = lines({ view: "fiction", cap: CAPS.snapshotFiction });
    const named = (name: string) =>
      fiction.find((l) => l.startsWith(name)) ?? "";
    expect(named("Tamsin Vale")).toContain("party, human player");
    expect(named("Brother Odo")).toContain("party, human player");
    expect(named("Kestrel")).toContain("party, human player");
    expect(fiction.join("\n")).not.toContain("AI companion");
  });

  it("the dm view lists three players and no companion", () => {
    const dm = lines({ view: "dm", cap: CAPS.snapshotDm });
    for (const id of ["tamsin", "odo", "kestrel"]) {
      const line = dm.find((l) => l.startsWith(`${id} `)) ?? "";
      expect(line).toContain("party, player");
    }
    expect(dm.join("\n")).not.toContain("ai-companion");
  });
});

const hold = (companions: string[]): DirectorOutput => ({
  beat: { decision: "hold", companions, reason: "ask" },
  tableMode: { to: "stay" },
  trackers: [],
  scene: { status: "continue" },
  pacing: { tension: "low", spotlight: null, beatId: null },
  goalNote: "",
  companionPrompts: [],
});

describe("trio director", () => {
  it("has no AI companion ids", () => {
    expect(aiCompanionIds(projections)).toEqual([]);
  });

  it("the director prompt has no AI companions section", async () => {
    const ctx = makeCtx({
      seed,
      deps: { loadProjections: async () => projections },
    });
    const assembled = await assemble(ctx);
    if (!assembled.ok) throw new Error("assemble failed");
    const { user } = buildDirectorPrompt({
      ctx,
      assembled: assembled.output,
      aiCompanions: aiCompanionIds(projections),
      runnableEncounterIds: [],
    });
    expect(user).not.toContain("## AI companions in the party");
  });

  it("overrides a hold naming a human character and empties companionPrompts", () => {
    const out = legalizeDirector(
      { ...hold(["odo"]), companionPrompts: ["odo"] },
      {
        trigger: "commit",
        forceResolve: false,
        projections,
        seed,
        beat: [],
      },
    );
    expect(out.beat).toEqual({ decision: "resolve" });
    expect(out.overrides).toContainEqual({
      decision: "hold",
      reason: "a named companion is not an AI companion in the party",
    });
    expect(out.companionPrompts).toEqual([]);
    expect(out.overrides).toContainEqual({
      decision: "companionPrompts",
      reason: "a prompted character is not an AI companion in the party",
    });
  });
});
