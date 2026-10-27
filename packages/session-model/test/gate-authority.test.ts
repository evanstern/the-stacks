import { describe, expect, it } from "vitest";
import { fixtures } from "../src/fixtures/index.js";
import { commitAuthority, project } from "../src/index.js";
import {
  aiDm,
  ana,
  bram,
  DM_USER,
  dmFold,
  outsider,
  seatedDm,
} from "./gate-helpers.js";
import { PLAYER_A, PLAYER_B, type RowSpec } from "./helpers.js";

const BRAM = "ai:companion:bram";
const PLAYER_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const object = (actor: string): RowSpec => ({
  type: "action.commented",
  payload: { actionId: "act-party", stance: "object", text: "no" },
  opts: { actor },
});

describe("commitAuthority (AC #6)", () => {
  describe("free mode", () => {
    const p = dmFold();
    it("the declarer commits their character's action", () => {
      expect(commitAuthority(p, ana, "act-ana")).toEqual({
        ok: true,
        authority: "declarer",
      });
      expect(commitAuthority(p, { actor: BRAM }, "act-bram")).toEqual({
        ok: true,
        authority: "declarer",
      });
    });
    it("refuses a non-declarer and a non-controller", () => {
      expect(commitAuthority(p, bram, "act-ana")).toEqual({
        ok: false,
        code: "COMMIT_NOT_ALLOWED",
      });
      expect(commitAuthority(p, outsider, "act-ana")).toEqual({
        ok: false,
        code: "COMMIT_NOT_ALLOWED",
      });
    });
  });

  describe("turn mode", () => {
    const p = dmFold({
      turn: { activeActor: BRAM, activeCharacterId: "bram" },
    });
    it("only the active actor commits, for the active character", () => {
      expect(commitAuthority(p, bram, "act-bram")).toEqual({
        ok: true,
        authority: "active-player",
      });
      expect(commitAuthority(p, ana, "act-ana")).toEqual({
        ok: false,
        code: "COMMIT_NOT_ALLOWED",
      });
      expect(commitAuthority(p, bram, "act-ana")).toEqual({
        ok: false,
        code: "COMMIT_NOT_ALLOWED",
      });
    });
    it("a null activeCharacterId accepts any character the actor controls", () => {
      const q = dmFold({
        turn: { activeActor: PLAYER_A, activeCharacterId: null },
      });
      expect(commitAuthority(q, ana, "act-ana")).toEqual({
        ok: true,
        authority: "active-player",
      });
    });
    it("a mismatched activeCharacterId refuses", () => {
      const q = dmFold({
        turn: { activeActor: PLAYER_A, activeCharacterId: "bram" },
      });
      expect(commitAuthority(q, ana, "act-ana")).toEqual({
        ok: false,
        code: "COMMIT_NOT_ALLOWED",
      });
    });
  });

  describe("party scope", () => {
    it("one human in the party commits as group", () => {
      expect(commitAuthority(dmFold(), ana, "act-party")).toEqual({
        ok: true,
        authority: "group",
      });
    });
    it("a companion or an outsider does not commit for the party", () => {
      const p = dmFold();
      expect(commitAuthority(p, bram, "act-party")).toEqual({
        ok: false,
        code: "COMMIT_NOT_ALLOWED",
      });
      expect(commitAuthority(p, outsider, "act-party")).toEqual({
        ok: false,
        code: "COMMIT_NOT_ALLOWED",
      });
    });
    it("two humans need group sign-off", () => {
      const p = dmFold({ twoHumans: true });
      expect(commitAuthority(p, ana, "act-party")).toEqual({
        ok: false,
        code: "GROUP_SIGNOFF_REQUIRED",
        waiting: [PLAYER_B],
        objecting: [],
      });
      expect(commitAuthority(p, { actor: PLAYER_B }, "act-party")).toEqual({
        ok: false,
        code: "GROUP_SIGNOFF_REQUIRED",
        waiting: [PLAYER_A],
        objecting: [],
      });
    });
    it("without present, three humans list every other human as waiting", () => {
      const p = dmFold({
        twoHumans: true,
        extra: [
          {
            type: "party.member.changed",
            payload: {
              reason: "j",
              characterId: "dara",
              before: null,
              after: {
                characterId: "dara",
                name: "Dara",
                controller: { kind: "player", userId: PLAYER_C },
                combatantId: null,
              },
            },
          },
        ],
      });
      expect(commitAuthority(p, ana, "act-party")).toEqual({
        ok: false,
        code: "GROUP_SIGNOFF_REQUIRED",
        waiting: [PLAYER_B, PLAYER_C].sort(),
        objecting: [],
      });
    });
    it("with present, the acting human's own approval completes the quorum", () => {
      const p = dmFold({ twoHumans: true });
      expect(
        commitAuthority(p, { actor: PLAYER_B }, "act-party", [
          PLAYER_A,
          PLAYER_B,
        ]),
      ).toEqual({ ok: true, authority: "group" });
    });
    it("with present, a waiting human blocks the declarer's commit", () => {
      const p = dmFold({ twoHumans: true });
      expect(
        commitAuthority(p, ana, "act-party", [PLAYER_A, PLAYER_B]),
      ).toEqual({
        ok: false,
        code: "GROUP_SIGNOFF_REQUIRED",
        waiting: [PLAYER_B],
        objecting: [],
      });
    });
    it("with present, an absent waiting human does not block", () => {
      const p = dmFold({ twoHumans: true });
      expect(commitAuthority(p, ana, "act-party", [PLAYER_A])).toEqual({
        ok: true,
        authority: "group",
      });
    });
    it("with present, an objector blocks and is named", () => {
      const p = dmFold({ twoHumans: true, extra: [object(PLAYER_B)] });
      expect(
        commitAuthority(p, ana, "act-party", [PLAYER_A, PLAYER_B]),
      ).toEqual({
        ok: false,
        code: "GROUP_SIGNOFF_REQUIRED",
        waiting: [],
        objecting: [PLAYER_B],
      });
    });
    it("with present, a one-human party still commits as group", () => {
      expect(commitAuthority(dmFold(), ana, "act-party", [PLAYER_A])).toEqual({
        ok: true,
        authority: "group",
      });
    });
    it("party scope applies in turn mode too", () => {
      const p = dmFold({
        turn: { activeActor: BRAM, activeCharacterId: null },
      });
      expect(commitAuthority(p, ana, "act-party")).toEqual({
        ok: true,
        authority: "group",
      });
    });
  });

  describe("the DM", () => {
    it("the AI DM always commits", () => {
      expect(commitAuthority(dmFold(), aiDm, "act-ana")).toEqual({
        ok: true,
        authority: "dm",
      });
      expect(commitAuthority(dmFold(), aiDm, "act-party")).toEqual({
        ok: true,
        authority: "dm",
      });
    });
    it("the seated human DM commits; an unseated user does not", () => {
      const p = dmFold({ humanDm: true });
      expect(commitAuthority(p, seatedDm, "act-ana")).toEqual({
        ok: true,
        authority: "dm",
      });
      expect(commitAuthority(p, { actor: DM_USER }, "act-party")).toEqual({
        ok: true,
        authority: "dm",
      });
      expect(commitAuthority(dmFold(), seatedDm, "act-ana")).toEqual({
        ok: false,
        code: "COMMIT_NOT_ALLOWED",
      });
    });
  });

  describe("the DM over an objection (US3)", () => {
    const humanDm = dmFold({
      twoHumans: true,
      humanDm: true,
      extra: [object(PLAYER_B)],
    });
    const aiSeat = dmFold({ twoHumans: true, extra: [object(PLAYER_B)] });
    it("the seated human DM commits with dm, with and without present", () => {
      expect(commitAuthority(humanDm, seatedDm, "act-party")).toEqual({
        ok: true,
        authority: "dm",
      });
      expect(
        commitAuthority(humanDm, seatedDm, "act-party", [PLAYER_A, PLAYER_B]),
      ).toEqual({ ok: true, authority: "dm" });
    });
    it("ai:dm commits with dm, with and without present", () => {
      expect(commitAuthority(aiSeat, aiDm, "act-party")).toEqual({
        ok: true,
        authority: "dm",
      });
      expect(
        commitAuthority(aiSeat, aiDm, "act-party", [PLAYER_A, PLAYER_B]),
      ).toEqual({ ok: true, authority: "dm" });
    });
  });

  describe("action state", () => {
    it("refuses an unknown action", () => {
      expect(commitAuthority(dmFold(), aiDm, "nope")).toEqual({
        ok: false,
        code: "UNKNOWN_ACTION",
      });
    });
    it("refuses an action that is already committed", () => {
      const p = dmFold({
        extra: [
          {
            type: "action.committed",
            payload: { actionId: "act-ana", authority: "declarer" },
            opts: { actor: PLAYER_A },
          },
        ],
      });
      expect(commitAuthority(p, aiDm, "act-ana")).toEqual({
        ok: false,
        code: "ACTION_NOT_OPEN",
      });
    });
    it("a discussed action is still open", () => {
      const p = dmFold({
        extra: [
          {
            type: "action.commented",
            payload: { actionId: "act-ana", stance: "comment", text: "hm" },
            opts: { actor: BRAM },
          },
        ],
      });
      expect(commitAuthority(p, ana, "act-ana").ok).toBe(true);
    });
  });
});

describe("commit authority replays every fixture (SC-006)", () => {
  for (const f of fixtures) {
    it(`${f.name}: each action.committed re-derives its recorded authority`, () => {
      for (const event of f.events) {
        if (event.type !== "action.committed") continue;
        const before = project(
          f.events.filter((e) => e.seq < event.seq),
          { role: "dm" },
        );
        const payload = event.payload as {
          actionId: string;
          authority: string;
        };
        const marker = f.events
          .filter(
            (e) =>
              e.seq < event.seq &&
              e.type === "presence.recorded" &&
              (e.payload as { purpose?: string; actionId?: string }).purpose ===
                "signoff" &&
              (e.payload as { actionId?: string }).actionId ===
                payload.actionId,
          )
          .at(-1);
        const present = (marker?.payload as { present: string[] } | undefined)
          ?.present;
        expect(
          commitAuthority(
            before,
            { actor: event.actor },
            payload.actionId,
            present,
          ),
          `${f.name} seq ${event.seq}`,
        ).toEqual({ ok: true, authority: payload.authority });
      }
    });
  }
});
