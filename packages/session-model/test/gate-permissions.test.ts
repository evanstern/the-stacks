import { describe, expect, it } from "vitest";
import {
  checkPermission,
  type GateRequest,
  GateRequestSchema,
  type Proposer,
} from "../src/index.js";
import {
  aiDm,
  ana,
  bram,
  dmFold,
  operator,
  outsider,
  seatedDm,
} from "./gate-helpers.js";
import { member, scene, tracker } from "./helpers.js";

const req = (r: unknown): GateRequest => GateRequestSchema.parse(r);

const requests: Record<string, GateRequest> = {
  talk: req({
    kind: "talk",
    talk: { text: "Hi", channel: "ooc", characterId: null },
  }),
  "talk.ic-ana": req({
    kind: "talk",
    talk: { text: "Hi", channel: "ic", characterId: "ana" },
  }),
  "talk.ic-npc": req({
    kind: "talk",
    talk: { text: "Hi", channel: "ic", characterId: null },
  }),
  "declare.ana": req({
    kind: "action.declare",
    action: {
      actionId: "a1",
      characterId: "ana",
      scope: "character",
      text: "x",
    },
  }),
  "declare.bram": req({
    kind: "action.declare",
    action: {
      actionId: "a1",
      characterId: "bram",
      scope: "character",
      text: "x",
    },
  }),
  "declare.party": req({
    kind: "action.declare",
    action: { actionId: "a1", characterId: null, scope: "party", text: "x" },
  }),
  "action.comment": req({
    kind: "action.comment",
    comment: { actionId: "act-ana", stance: "comment", text: "x" },
  }),
  "action.commit": req({ kind: "action.commit", actionId: "act-ana" }),
  "action.withdraw": req({ kind: "action.withdraw", actionId: "act-ana" }),
  "action.resolve": req({
    kind: "action.resolve",
    resolution: {
      actionId: "act-ana",
      outcome: "no-effect",
      batchIds: [],
      refusalCode: null,
    },
  }),
  mechanics: req({ kind: "mechanics", command: { type: "roll" } }),
  narration: req({
    kind: "narration",
    narration: { text: "x", actionIds: [] },
  }),
  "table-mode": req({
    kind: "table-mode",
    reason: "r",
    after: { mode: "free" },
  }),
  scene: req({ kind: "scene", reason: "r", after: scene }),
  party: req({ kind: "party", reason: "r", characterId: "ana", after: member }),
  tracker: req({
    kind: "tracker",
    reason: "r",
    trackerId: "ritual",
    after: tracker,
  }),
  "floor.end": req({
    kind: "floor",
    op: "end",
    turn: { round: 1, combatantId: "ana" },
    reason: "r",
  }),
  "floor.take": req({
    kind: "floor",
    op: "take",
    turn: { round: 1, combatantId: "ana" },
    reason: "r",
  }),
  "floor.return": req({
    kind: "floor",
    op: "return",
    turn: { round: 1, combatantId: "ana" },
    reason: "r",
  }),
  journal: req({
    kind: "journal",
    entry: { entryId: "j", title: "t", body: "b", sourceActionIds: [] },
  }),
  "proposal.approve": req({ kind: "proposal.approve", proposalId: "p1" }),
  "proposal.reject": req({ kind: "proposal.reject", proposalId: "p1" }),
  "gate.policy": req({
    kind: "gate.policy",
    reason: "r",
    proposalKind: "journal",
    policy: "ask",
  }),
  "dm.seat": req({ kind: "dm.seat", reason: "r", after: { kind: "ai" } }),
};

type Who =
  | "seatedDm"
  | "aiDm"
  | "companion"
  | "player"
  | "outsider"
  | "operator";
const proposers: Record<Who, Proposer> = {
  seatedDm,
  aiDm,
  companion: bram,
  player: ana,
  outsider,
  operator,
};

const DM_KIND_ROW: Record<Who, boolean> = {
  seatedDm: true,
  aiDm: true,
  companion: false,
  player: false,
  outsider: false,
  operator: false,
};

// Expected allowed cells per request; every cell not listed is refused.
const allowed: Record<string, Who[]> = {
  talk: ["seatedDm", "aiDm", "companion", "player", "outsider", "operator"],
  "talk.ic-ana": ["seatedDm", "aiDm", "player"],
  "talk.ic-npc": [
    "seatedDm",
    "aiDm",
    "companion",
    "player",
    "outsider",
    "operator",
  ],
  "declare.ana": ["player"],
  "declare.bram": ["companion"],
  "declare.party": ["companion", "player"],
  "action.comment": ["seatedDm", "aiDm", "companion", "player"],
  "action.commit": [
    "seatedDm",
    "aiDm",
    "companion",
    "player",
    "outsider",
    "operator",
  ],
  "action.withdraw": ["seatedDm", "player"],
  // Who may END is narrowed at plan time (FLOOR_NOT_HELD, absent-human rule).
  "floor.end": ["seatedDm", "aiDm", "companion", "player"],
  "floor.take": ["seatedDm"],
  "floor.return": ["seatedDm"],
  "proposal.approve": ["seatedDm"],
  "proposal.reject": ["seatedDm"],
  "gate.policy": ["seatedDm", "operator"],
  "dm.seat": ["operator"],
};
for (const key of [
  "action.resolve",
  "mechanics",
  "narration",
  "table-mode",
  "scene",
  "party",
  "tracker",
  "journal",
]) {
  allowed[key] = (Object.keys(DM_KIND_ROW) as Who[]).filter(
    (w) => DM_KIND_ROW[w],
  );
}

describe("permission matrix (contracts/proposals.md)", () => {
  const p = dmFold({ humanDm: true });
  for (const [name, request] of Object.entries(requests)) {
    for (const [who, proposer] of Object.entries(proposers) as [
      Who,
      Proposer,
    ][]) {
      const expected = (allowed[name] ?? []).includes(who);
      it(`${name} / ${who}: ${expected ? "allowed" : "refused"}`, () => {
        const result = checkPermission(p, proposer, request);
        expect(result.ok).toBe(expected);
        if (!result.ok) {
          expect(["NOT_AUTHORIZED", "NOT_DM"]).toContain(result.code);
        }
      });
    }
  }

  it("floor take/return by a party member is NOT_DM; by ai:dm or an outsider NOT_AUTHORIZED", () => {
    for (const name of ["floor.take", "floor.return"]) {
      const request = requests[name] as GateRequest;
      expect(checkPermission(p, ana, request)).toMatchObject({
        ok: false,
        code: "NOT_DM",
      });
      expect(checkPermission(p, bram, request)).toMatchObject({
        ok: false,
        code: "NOT_DM",
      });
      for (const who of [aiDm, outsider, operator]) {
        expect(checkPermission(p, who, request)).toMatchObject({
          ok: false,
          code: "NOT_AUTHORIZED",
        });
      }
    }
  });

  it("proposal.approve by a non-DM is NOT_DM", () => {
    const result = checkPermission(
      p,
      ana,
      requests["proposal.approve"] as GateRequest,
    );
    expect(result).toMatchObject({ ok: false, code: "NOT_DM" });
  });

  it("an AI seat leaves no human DM: approve is refused for everyone", () => {
    const ai = dmFold();
    for (const proposer of Object.values(proposers)) {
      expect(
        checkPermission(
          ai,
          proposer,
          requests["proposal.approve"] as GateRequest,
        ).ok,
      ).toBe(false);
    }
  });

  it("an operator who is also the seated DM may seat the AI back", () => {
    const seated: Proposer = {
      kind: "human",
      userId: seatedDm.kind === "human" ? seatedDm.userId : "",
      role: "operator",
    };
    expect(
      checkPermission(p, seated, requests["dm.seat"] as GateRequest).ok,
    ).toBe(true);
  });
});
