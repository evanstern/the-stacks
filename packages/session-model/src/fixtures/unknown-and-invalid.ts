import {
  fixtureIds as ids,
  mechanicsBatch,
  numberRows,
  type SessionFixture,
} from "./build.js";

const sessionId = "00000000-0000-4000-8000-000000000105";

const validTalk = {
  text: "Ana studies the vault door.",
  channel: "ic",
  characterId: "ana",
};

export const unknownAndInvalid: SessionFixture = {
  name: "unknown-and-invalid",
  description:
    "A damaged log: valid talk beside a type no catalog knows, a version the catalog lacks, an empty-text talk, a row whose type column disagrees with its mechanics envelope, a duplicate delivery of an earlier seq, and a future proposal type. The fold must return, count each fault under its own diagnostic, and keep only the valid talk. The only fixture with invalid rows.",
  sessionId,
  viewers: {
    dm: { role: "dm" },
    players: [
      { role: "player", userId: ids.playerUserId },
      { role: "player", userId: ids.otherPlayerUserId },
    ],
  },
  events: numberRows(sessionId, [
    { actor: ids.playerUserId, type: "talk", payload: validTalk },
    {
      actor: ids.dmActor,
      type: "weather.changed",
      payload: { weather: "rain" },
    },
    {
      actor: ids.playerUserId,
      type: "talk",
      payload: validTalk,
      payloadVersion: 99,
    },
    {
      actor: ids.playerUserId,
      type: "talk",
      payload: { text: "", channel: "ic", characterId: null },
    },
    // The envelope carries a dice.rolled event; the type column says hp.changed.
    ...mechanicsBatch({ batchId: "b-mismatch", actor: ids.dmActor }, [
      {
        type: "dice.rolled",
        v: 1,
        reason: "A roll filed under the wrong type",
        expression: "1d20",
        mode: "normal",
        purpose: "check",
        critical: false,
        combatantId: null,
        terms: [
          {
            kind: "dice",
            sign: 1,
            count: 1,
            sides: 20,
            keep: null,
            faces: [9],
            kept: [true],
            subtotal: 9,
          },
        ],
        total: 9,
        natural: 9,
      },
    ]).map((spec) => ({ ...spec, type: "hp.changed" })),
    // A duplicate delivery of seq 1.
    { actor: ids.playerUserId, type: "talk", payload: validTalk, seq: 1 },
    {
      actor: ids.dmActor,
      type: "proposal.created",
      payload: { proposalId: "prop-1" },
    },
  ]),
};
