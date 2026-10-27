import { fixtureIds as ids, numberRows, type SessionFixture } from "./build.js";

const sessionId = "00000000-0000-4000-8000-000000000108";

/**
 * Two `director` presence markers with different sets, between talk rows (decision-0024,
 * specs/035-presence/contracts/presence-marker.md). Exported beside `fixtures`, not inside
 * it: the contract fixture list stays at seven and the web fixture routes do not gain a
 * table.
 */
export const presenceMarker: SessionFixture = {
  name: "presence-marker",
  description:
    "Two director presence markers with different sets, one naming only the first player and one naming both players, between table-talk rows. The fold keeps the latest marker with its seq and the transcript holds the talk rows only.",
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
        text: "Is anyone else here?",
        channel: "ooc",
        characterId: null,
      },
    },
    {
      actor: "system",
      type: "presence.recorded",
      payload: { present: [ids.playerUserId], purpose: "director" },
    },
    {
      actor: ids.otherPlayerUserId,
      type: "talk",
      payload: { text: "I just joined.", channel: "ooc", characterId: null },
    },
    {
      actor: "system",
      type: "presence.recorded",
      payload: {
        present: [ids.playerUserId, ids.otherPlayerUserId],
        purpose: "director",
      },
    },
  ]),
};
