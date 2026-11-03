import { describe, expect, it } from "vitest";
import { agencyRule } from "../../src/dm/doctrine/doctrine.js";
import {
  AUDITOR_PROMPT_VERSION,
  buildAuditorPrompt,
} from "../../src/playtest/auditor/prompt.js";
import type { Segment } from "../../src/playtest/auditor/segments.js";
import { loadDoctored } from "./helpers.js";

const seg: Segment = {
  index: 0,
  narrationSeq: null,
  fromSeq: 1,
  toSeq: 1,
  rows: [],
  ledger: [],
};

describe("auditor prompt party section (spec 074)", () => {
  it("lists controllers and holds the auditor agency rule", () => {
    const seed = structuredClone(loadDoctored().seed);
    const [a, b] = seed.characters;
    if (!a || !b) throw new Error("seed needs two characters");
    a.name = "Tamsin Vale";
    a.seat = "human";
    b.name = "Brother Odo";
    b.seat = "companion";
    const { user } = buildAuditorPrompt(seg, seed);
    expect(AUDITOR_PROMPT_VERSION).toBe("playtest.audit-v2");
    expect(user).toContain("## Party");
    expect(user).toContain("Tamsin Vale (human player)");
    expect(user).toContain("Brother Odo (AI companion)");
    expect(user).toContain(agencyRule("auditor"));
  });

  it("renders (party unknown) for a null seed and keeps the rule", () => {
    const { user } = buildAuditorPrompt(seg, null);
    expect(user).toContain("(party unknown)");
    expect(user).toContain(agencyRule("auditor"));
  });
});
