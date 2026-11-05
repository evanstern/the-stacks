import { describe, expect, it } from "vitest";
import {
  buildCompanionPrompt,
  PROMPT_VERSION,
} from "../../src/dm/prompts/companion.js";
import { playerFacingSeed } from "../../src/dm/seed/views.js";
import { buildSnapshot } from "../../src/dm/snapshot/index.js";
import { projectDm, row } from "./helpers.js";
import { greyhollowDuo } from "./snapshot-fixtures.js";

/** TASK-0189: alpha run 3 seq 31, Tamsin asks "Odo, are you here?"; Odo answered Wenna. */
const { projections: base, seed } = greyhollowDuo();
const projections = {
  ...base,
  transcript: projectDm([
    row(31, "00000000-0000-4000-8000-000000000001", "talk", {
      text: "Odo, are you here?",
      channel: "ic",
      characterId: "tamsin",
    }),
  ]).transcript,
};
const prompt = () =>
  buildCompanionPrompt({
    seed: playerFacingSeed(seed),
    projections,
    snapshot: buildSnapshot(projections, seed),
    characterId: "odo",
    active: false,
  });

describe("companion prompt names the speaker (TASK-0189)", () => {
  it("is v8", () => expect(PROMPT_VERSION).toBe("dm.companion-v8"));

  it("states that all four keys are written (TASK-0203)", () =>
    expect(prompt().system).toContain(
      "Write all four keys every time. Set `comment`, `say` or `act` to null when you have none; never leave a key out.",
    ));

  it("names Tamsin as the speaker and Odo as addressed, not Wenna", () => {
    const { user } = prompt();
    const section = user.split("## Post that triggered you\n")[1] ?? "";
    expect(section).toContain(
      "[31] Tamsin Vale (a player character, not an NPC) said: Odo, are you here?",
    );
    expect(section).toContain("Addressed to: you.");
    expect(section).not.toMatch(/Wenna/);
  });
});
