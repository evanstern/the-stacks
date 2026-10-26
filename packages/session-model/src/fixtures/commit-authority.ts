import { fixtureIds as ids, numberRows, type SessionFixture } from "./build.js";

const sessionId = "00000000-0000-4000-8000-000000000107";

export const commitAuthority: SessionFixture = {
  name: "commit-authority",
  description:
    "Who may commit which action. Ana (a player) and Bram (an AI companion) join the party under the AI DM. In free mode Ana declares a character action, Bram declares his own, Ana declares a party action and Bram approves it by comment. The table then turns to Bram's turn and Ana declares a second character action. The commit-authority function must give each actor a different answer in free mode and in turn mode.",
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
        actionId: "act-a1",
        characterId: "ana",
        scope: "character",
        text: "Ana studies the carved lintel.",
      },
    },
    {
      actor: ids.companionActor,
      type: "action.declared",
      payload: {
        actionId: "act-b1",
        characterId: "bram",
        scope: "character",
        text: "Bram checks the corridor behind them.",
      },
    },
    {
      actor: ids.playerUserId,
      type: "action.declared",
      payload: {
        actionId: "act-p1",
        characterId: null,
        scope: "party",
        text: "We take the left passage together.",
      },
    },
    {
      actor: ids.companionActor,
      type: "action.commented",
      payload: {
        actionId: "act-p1",
        stance: "approve",
        text: "Left suits me.",
      },
    },
    {
      actor: ids.dmActor,
      type: "table-mode.changed",
      payload: {
        reason: "Bram acts first",
        before: { mode: "free" },
        after: {
          mode: "turn",
          activeActor: ids.companionActor,
          activeCharacterId: "bram",
        },
      },
    },
    {
      actor: ids.playerUserId,
      type: "action.declared",
      payload: {
        actionId: "act-a2",
        characterId: "ana",
        scope: "character",
        text: "Ana readies her pick for the next lock.",
      },
    },
  ]),
};
