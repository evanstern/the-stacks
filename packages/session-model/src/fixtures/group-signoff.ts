import { fixtureIds as ids, numberRows, type SessionFixture } from "./build.js";

const sessionId = "00000000-0000-4000-8000-000000000109";

export const groupSignoff: SessionFixture = {
  name: "group-signoff",
  description:
    "Group sign-off on party actions (specs/044-group-signoff). Ana and Cleo (two players) and Bram (an AI companion) form the party under the AI DM. Ana declares party action P1 and Cleo objects, then approves: the approval completes the quorum, so one batch holds the comment, a signoff presence marker naming both players and the group commit. Ana then declares party action P2, Cleo objects, and the AI DM commits it with DM authority and no marker.",
  sessionId,
  viewers: {
    dm: { role: "dm" },
    players: [
      { role: "player", userId: ids.playerUserId },
      { role: "player", userId: ids.otherPlayerUserId },
    ],
  },
  events: numberRows(sessionId, [
    {
      actor: ids.dmActor,
      type: "party.member.changed",
      payload: {
        reason: "Ana joins the party",
        characterId: "ana",
        before: null,
        after: {
          characterId: "ana",
          name: "Ana",
          controller: { kind: "player", userId: ids.playerUserId },
          combatantId: null,
        },
      },
    },
    {
      actor: ids.dmActor,
      type: "party.member.changed",
      payload: {
        reason: "Cleo joins the party",
        characterId: "cleo",
        before: null,
        after: {
          characterId: "cleo",
          name: "Cleo",
          controller: { kind: "player", userId: ids.otherPlayerUserId },
          combatantId: null,
        },
      },
    },
    {
      actor: ids.dmActor,
      type: "party.member.changed",
      payload: {
        reason: "Bram joins the party",
        characterId: "bram",
        before: null,
        after: {
          characterId: "bram",
          name: "Bram",
          controller: { kind: "ai-companion", actor: ids.companionActor },
          combatantId: null,
        },
      },
    },
    {
      actor: ids.playerUserId,
      type: "action.declared",
      payload: {
        actionId: "act-p1",
        characterId: null,
        scope: "party",
        text: "We climb the old well to the cellar.",
      },
    },
    {
      actor: ids.otherPlayerUserId,
      type: "action.commented",
      payload: {
        actionId: "act-p1",
        stance: "object",
        text: "The rope looks rotten.",
      },
    },
    {
      actor: ids.otherPlayerUserId,
      type: "action.commented",
      payload: {
        actionId: "act-p1",
        stance: "approve",
        text: "Fine, if we test the rope first.",
      },
    },
    {
      actor: "system",
      type: "presence.recorded",
      payload: {
        present: [ids.playerUserId, ids.otherPlayerUserId],
        purpose: "signoff",
        actionId: "act-p1",
      },
    },
    {
      actor: ids.otherPlayerUserId,
      type: "action.committed",
      payload: { actionId: "act-p1", authority: "group" },
    },
    {
      actor: ids.playerUserId,
      type: "action.declared",
      payload: {
        actionId: "act-p2",
        characterId: null,
        scope: "party",
        text: "We light the lantern and follow the draught.",
      },
    },
    {
      actor: ids.otherPlayerUserId,
      type: "action.commented",
      payload: {
        actionId: "act-p2",
        stance: "object",
        text: "I would rather keep the dark.",
      },
    },
    {
      actor: ids.dmActor,
      type: "action.committed",
      payload: { actionId: "act-p2", authority: "dm" },
    },
  ]),
};
