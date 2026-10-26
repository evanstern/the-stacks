import {
  fixtureIds as ids,
  mechanicsBatch,
  numberRows,
  type SessionFixture,
} from "./build.js";

const sessionId = "00000000-0000-4000-8000-000000000104";

export const secretTracker: SessionFixture = {
  name: "secret-tracker",
  description:
    "DM secrets next to public play. A secret tracker is created and advanced twice, a hidden stealth roll lands, and a DM-only journal entry is written, all with dm visibility. The DM sees all of it. Player viewers see the public scene and talk only: no tracker, no hidden roll reason, no DM journal entry.",
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
      type: "scene.changed",
      payload: {
        reason: "The party enters the chapel",
        before: null,
        after: {
          sceneId: "chapel",
          title: "The ruined chapel",
          summary: "Candle stubs ring a cracked altar.",
          location: "Hillside",
        },
      },
    },
    {
      actor: ids.dmActor,
      type: "tracker.changed",
      payload: {
        reason: "The cult begins its ritual",
        trackerId: "ritual",
        before: null,
        after: {
          trackerId: "ritual",
          name: "The cult completes the ritual",
          segments: 6,
          filled: 0,
          note: "The cult needs three more nights.",
        },
      },
      visibility: "dm",
    },
    {
      actor: ids.dmActor,
      type: "tracker.changed",
      payload: {
        reason: "The party lingers at the chapel door",
        trackerId: "ritual",
        before: {
          trackerId: "ritual",
          name: "The cult completes the ritual",
          segments: 6,
          filled: 0,
          note: "The cult needs three more nights.",
        },
        after: {
          trackerId: "ritual",
          name: "The cult completes the ritual",
          segments: 6,
          filled: 1,
          note: "The cult needs three more nights.",
        },
      },
      visibility: "dm",
    },
    ...mechanicsBatch(
      { batchId: "b-hidden-roll", actor: ids.dmActor, visibility: "dm" },
      [
        {
          type: "dice.rolled",
          v: 1,
          reason: "Cult scout hides behind the altar",
          expression: "1d20+4",
          mode: "normal",
          purpose: "roll",
          critical: false,
          combatantId: null,
          terms: [
            {
              kind: "dice",
              sign: 1,
              count: 1,
              sides: 20,
              keep: null,
              faces: [11],
              kept: [true],
              subtotal: 11,
            },
            {
              kind: "modifier",
              value: 4,
            },
          ],
          total: 15,
          natural: 11,
        },
      ],
    ),
    {
      actor: ids.dmActor,
      type: "tracker.changed",
      payload: {
        reason: "A guard rings the alarm bell",
        trackerId: "ritual",
        before: {
          trackerId: "ritual",
          name: "The cult completes the ritual",
          segments: 6,
          filled: 1,
          note: "The cult needs three more nights.",
        },
        after: {
          trackerId: "ritual",
          name: "The cult completes the ritual",
          segments: 6,
          filled: 2,
          note: "The cult needs three more nights.",
        },
      },
      visibility: "dm",
    },
    {
      actor: ids.dmActor,
      type: "journal.entry.added",
      payload: {
        entryId: "j-dm-cult",
        title: "Cult plans",
        body: "The cult scout is waiting behind the altar with a signal bell.",
        sourceActionIds: [],
      },
      visibility: "dm",
    },
    {
      actor: ids.playerUserId,
      type: "talk",
      payload: {
        text: "Ana pushes the chapel door open slowly.",
        channel: "ic",
        characterId: "ana",
      },
    },
    {
      actor: ids.dmActor,
      type: "talk",
      payload: {
        text: "Dust drifts in the candlelight as the door creaks.",
        channel: "ic",
        characterId: null,
      },
    },
  ]),
};
