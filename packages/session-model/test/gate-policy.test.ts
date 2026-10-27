import { describe, expect, it } from "vitest";
import {
  DEFAULT_POLICIES,
  type DmProposalKind,
  DmProposalKindSchema,
  effectivePolicy,
  type Proposal,
  ProposalSchema,
  routeProposal,
} from "../src/index.js";
import { aiDm, ana, bram, dmFold, seatedDm } from "./gate-helpers.js";

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
      "scene-presence": "ask",
      journal: "auto",
      floor: "ask",
    };
    expect({ ...DEFAULT_POLICIES }).toEqual(expected);
  });
});

const note = { summary: null, rationale: null };
const narration: Proposal = ProposalSchema.parse({
  kind: "narration",
  narration: { text: "The door groans.", actionIds: [] },
});
const declare: Proposal = ProposalSchema.parse({
  kind: "action.declare",
  action: {
    actionId: "act-new",
    characterId: "ana",
    scope: "character",
    text: "Ana waits.",
  },
});

describe("effectivePolicy (AC #2)", () => {
  it("is auto for every kind under an AI seat", () => {
    const p = dmFold();
    for (const kind of DmProposalKindSchema.options) {
      expect(effectivePolicy(p.gate, kind)).toBe("auto");
    }
  });

  it("an AI seat ignores overrides", () => {
    const gate = {
      seat: { kind: "ai" as const },
      policyOverrides: { journal: "ask" as const },
    };
    expect(effectivePolicy(gate, "journal")).toBe("auto");
  });

  it("a human seat uses the defaults, and overrides win", () => {
    const p = dmFold({ humanDm: true });
    for (const kind of DmProposalKindSchema.options) {
      expect(effectivePolicy(p.gate, kind)).toBe(DEFAULT_POLICIES[kind]);
    }
    const gate = {
      ...p.gate,
      policyOverrides: { journal: "ask" as const, scene: "auto" as const },
    };
    expect(effectivePolicy(gate, "journal")).toBe("ask");
    expect(effectivePolicy(gate, "scene")).toBe("auto");
    expect(effectivePolicy(gate, "mechanics")).toBe("ask");
  });
});

describe("routeProposal", () => {
  it("routes humans and companions direct", () => {
    const p = dmFold({ humanDm: true });
    for (const who of [seatedDm, ana, bram]) {
      expect(routeProposal(p, who, narration)).toEqual({ route: "direct" });
    }
  });

  it("routes ai:dm by the effective policy", () => {
    const human = dmFold({ humanDm: true });
    expect(routeProposal(human, aiDm, narration)).toEqual({
      route: "policy",
      policy: "ask",
    });
    const scene = ProposalSchema.parse({
      kind: "scene",
      reason: "r",
      after: null,
    });
    expect(routeProposal(human, aiDm, scene)).toEqual({
      route: "policy",
      policy: "suggest",
    });
    expect(routeProposal(dmFold(), aiDm, narration)).toEqual({
      route: "policy",
      policy: "auto",
    });
  });

  it("refuses ai:dm action.declare under any seat", () => {
    for (const p of [dmFold(), dmFold({ humanDm: true })]) {
      expect(routeProposal(p, aiDm, declare)).toEqual({
        route: "refuse",
        code: "NOT_AUTHORIZED",
      });
    }
    expect(note).toBeDefined();
  });
});
