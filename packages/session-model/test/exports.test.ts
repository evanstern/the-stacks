import * as main from "@the-stacks/session-model";
import type {
  MechanicsRecipe,
  SessionFixture,
} from "@the-stacks/session-model/fixtures";
import * as fx from "@the-stacks/session-model/fixtures";
import { describe, expect, it } from "vitest";

describe("package entry points", () => {
  it("the main entry exports the fold and does not re-export fixtures", () => {
    expect(typeof main.project).toBe("function");
    expect(typeof main.applyEvent).toBe("function");
    expect("fixtures" in main).toBe(false);
  });

  it("the main entry exports the Phase 1 gate vocabulary", () => {
    for (const name of [
      "ProposalKindSchema",
      "DmProposalKindSchema",
      "ProposalSchema",
      "GateRequestSchema",
      "GATE_REQUEST_KINDS",
      "GATE_REQUEST_VERSION",
      "mechanicsProposal",
      "actorOf",
      "DmSeatSchema",
      "PolicySchema",
      "DEFAULT_POLICIES",
      "effectivePolicy",
      "GateRefusalCodeSchema",
      "ProposalCreatedV1",
      "ProposalApprovedV1",
      "ProposalRejectedV1",
      "DmSeatChangedV1",
      "GatePolicyChangedV1",
      "pendingProposals",
      "findProposal",
    ]) {
      expect(name in main, name).toBe(true);
    }
  });

  it("the fixtures subpath exports the contract, with types", () => {
    const list: readonly SessionFixture[] = fx.fixtures;
    const recipes: readonly MechanicsRecipe[] = fx.recipes;
    expect(list).toHaveLength(5);
    expect(recipes.length).toBeGreaterThan(0);
    expect(fx.fixtureIds.dmActor).toBe("ai:dm");
    expect(fx.talkOnly.name).toBe("talk-only");
    expect(fx.unknownAndInvalid.name).toBe("unknown-and-invalid");
    expect(main.project(list[0]?.events ?? [], { role: "dm" }).throughSeq).toBe(
      list[0]?.events.length,
    );
  });
});
