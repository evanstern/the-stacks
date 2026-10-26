import { fixtureIds as ids, numberRows, type SessionFixture } from "./build.js";

const sessionId = "00000000-0000-4000-8000-000000000101";

export const talkOnly: SessionFixture = {
  name: "talk-only",
  description:
    "Table talk and nothing else: in-character and out-of-character lines from the player and a companion, a narrator chime-in sent as talk, and one DM whisper to the second player. Every projection except the transcript stays at its empty value, which proves talk never reaches mechanics, actions or state.",
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
      actor: ids.playerUserId,
      type: "talk",
      payload: {
        text: "Ana studies the vault door and frowns.",
        channel: "ic",
        characterId: "ana",
      },
    },
    {
      actor: ids.playerUserId,
      type: "talk",
      payload: {
        text: "Quick question: can I try the lock first?",
        channel: "ooc",
        characterId: null,
      },
    },
    {
      actor: ids.companionActor,
      type: "talk",
      payload: {
        text: "Bram keeps watch down the corridor.",
        channel: "ic",
        characterId: "bram",
      },
    },
    {
      actor: ids.dmActor,
      type: "talk",
      payload: {
        text: "The corridor behind you is quiet, and the torches hold steady.",
        channel: "ic",
        characterId: null,
      },
    },
    {
      actor: ids.dmActor,
      type: "talk",
      payload: {
        text: "Psst: you notice a scratch near the hinge.",
        channel: "ic",
        characterId: null,
      },
      visibility: ids.otherPlayerUserId,
    },
    {
      actor: ids.otherPlayerUserId,
      type: "talk",
      payload: {
        text: "I will help Ana look at the hinge.",
        channel: "ooc",
        characterId: null,
      },
    },
  ]),
};
