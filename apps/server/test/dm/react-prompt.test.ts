import { describe, expect, it } from "vitest";
import {
  buildReactPrompt,
  CAP_LINE,
  PROMPT_VERSION,
  RULES,
} from "../../src/dm/prompts/react.js";
import { playerFacingSeed } from "../../src/dm/seed/views.js";
import { buildSnapshot } from "../../src/dm/snapshot/index.js";
import { testSeed } from "./helpers.js";
import { greyhollowDuo } from "./snapshot-fixtures.js";

const { projections, seed } = greyhollowDuo();
const base = {
  seed: playerFacingSeed(testSeed()),
  roster: [],
  snapshot: buildSnapshot(projections, seed),
  posts: [],
  humans: [],
  triggers: [{ kind: "addressed" as const, actorId: "wenna", party: false }],
  transcriptTail: [],
  presentNpcIds: ["wenna"],
  encounterIds: ["reed-camp"],
  reachesCap: false,
};

describe("react prompt (specs/065 D4)", () => {
  it("is versioned dm.react-v5", () => {
    expect(PROMPT_VERSION).toBe("dm.react-v5");
  });

  it("states the confirm and answer rules and the outcome list (spec 066)", () => {
    const { system } = buildReactPrompt(base);
    expect(RULES).toMatch(/confirm/);
    expect(RULES).toMatch(/never write an item for a companion/i);
    expect(RULES).toMatch(/ask_dm/);
    expect(system).toContain('"confirm"');
    expect(system).toContain('"answer"');
  });

  it("lists the human characters and marks an ask_dm post", () => {
    const { user } = buildReactPrompt({
      ...base,
      humans: [{ id: "tamsin", name: "Tamsin Vale" }],
      posts: [
        { seq: 7, speaker: "Tamsin Vale", text: "@dm how high?", rule: 3 },
      ],
    });
    expect(user).toContain("tamsin (Tamsin Vale)");
    expect(user).toContain("[7] Tamsin Vale (ask_dm): @dm how high?");
  });

  it("states the outcome, voice, digit, dice and player-view rules", () => {
    const { system } = buildReactPrompt(base);
    expect(system).toContain(RULES);
    expect(RULES).toMatch(/one outcome/i);
    expect(RULES).toMatch(/NO digits/);
    expect(RULES).toMatch(/dice/i);
    expect(RULES).toMatch(/outside the player view/i);
    expect(system).toContain(
      '"outcome":"none"|"reply"|"scene"|"escalate"|"confirm"',
    );
  });

  it("lists the present NPC voice and the code triggers", () => {
    const { user } = buildReactPrompt(base);
    expect(user).toContain("wenna (Wenna Marsh");
    expect(user).toContain("addressed:");
    expect(user).toContain("reed-camp");
  });

  it("adds the cap line only at the cap", () => {
    expect(buildReactPrompt(base).user).not.toContain(CAP_LINE);
    expect(buildReactPrompt({ ...base, reachesCap: true }).user).toContain(
      CAP_LINE,
    );
  });
});
