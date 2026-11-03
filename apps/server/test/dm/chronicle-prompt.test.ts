import { describe, expect, it } from "vitest";
import { buildChroniclePrompt } from "../../src/dm/prompts/chronicle.js";
import { buildSnapshot } from "../../src/dm/snapshot/index.js";
import { freeEventsThrough, projectDm, testSeed } from "./helpers.js";

/** Spec 078 Story 3: the chronicle never infers a departure from the state. */

const seed = testSeed();
const base = projectDm(freeEventsThrough("narration"));
const prompt = (presence: "absent" | "present") => {
  const p = structuredClone(base);
  p.scenePresence.snag = { presence, reason: "removed", seq: 12 };
  return buildChroniclePrompt({
    snapshot: buildSnapshot(p, seed),
    transcript: [],
    goal: "Reach the ferry",
    roster: [],
    trackerNames: [],
  });
};

describe("buildChroniclePrompt presence (spec 078)", () => {
  it("lists no offstage actor in the state section", () => {
    expect(prompt("absent").user).not.toContain("Snag");
  });

  it("lists a present NPC", () => {
    expect(prompt("present").user).toContain("Snag");
  });

  it("tells the model to write a departure only when the transcript tells it", () => {
    expect(prompt("absent").system).toContain(
      "Write that someone left only when the transcript tells it.",
    );
  });
});
