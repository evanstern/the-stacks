import { describe, expect, it } from "vitest";
import {
  DEFAULT_POLICIES,
  type DmProposalKind,
  DmProposalKindSchema,
} from "../src/index.js";

describe("DEFAULT_POLICIES (AC #2)", () => {
  it("has exactly the DM proposal kinds as keys", () => {
    expect(Object.keys(DEFAULT_POLICIES).sort()).toEqual(
      [...DmProposalKindSchema.options].sort(),
    );
  });

  it("matches contracts/policy-and-authority.md", () => {
    const expected: Record<DmProposalKind, string> = {
      talk: "ask",
      "action.comment": "ask",
      "action.commit": "ask",
      "action.resolve": "auto",
      mechanics: "ask",
      narration: "ask",
      "table-mode": "ask",
      scene: "suggest",
      party: "ask",
      tracker: "ask",
      journal: "auto",
    };
    expect({ ...DEFAULT_POLICIES }).toEqual(expected);
  });
});
