import { fixtureIds as ids, numberRows, type SessionFixture } from "./build.js";

const sessionId = "00000000-0000-4000-8000-000000000109";
const ana = { kind: "pc", id: "ana" };
const bram = { kind: "pc", id: "bram" };
const say = (id: string, actor: unknown, text: string) => ({
  id,
  kind: "say",
  actor,
  channel: { kind: "scene" },
  targets: [],
  params: {},
  text,
  source: "composer",
  commit: "confirmed",
});
const carrier = (intent: unknown, outcome = "settled") => ({
  intent,
  schemaVersion: 1,
  outcome,
  batchId: null,
  facts: [],
  request: null,
  answers: null,
  stopped: null,
});
const hide = (id: string, actor: unknown, commit: string, source: string) => ({
  id,
  kind: "hide",
  actor,
  targets: [],
  params: {},
  source,
  commit,
});

/**
 * Spec 066: one composer, the AI DM reads the table. Say posts, a declared `hide`, a `read`
 * marker, a confirm (`sug-1`) that goes stale, a party `attempt` suggestion (`sug-2`) and its
 * 👍, an `ask_dm` and its answer, and a turn-mode segment. Exported beside `fixtures`.
 */
export const oneChatStream: SessionFixture = {
  name: "one-chat-stream",
  description:
    "The one-chat-stream table: two say posts, a declared hide, a read marker, a confirm that a later confirm supersedes, a party attempt suggestion with its thumbs-up, an ask_dm with its answer visible to the asker only, and a segment in turn mode. Exercises the read rule, suggestion staleness and the confirmed state.",
  sessionId,
  viewers: {
    dm: { role: "dm" },
    players: [
      { role: "player", userId: ids.playerUserId },
      { role: "player", userId: ids.otherPlayerUserId },
    ],
  },
  events: numberRows(sessionId, [
    // 1-2: Ana says a line (talk row, then its carrier)
    {
      actor: ids.playerUserId,
      type: "talk",
      payload: {
        text: "We should check the loft.",
        channel: "ic",
        characterId: "ana",
      },
    },
    {
      actor: ids.playerUserId,
      type: "intent.recorded",
      payload: carrier(say("i-1", ana, "We should check the loft.")),
    },
    // 3: Ana declares hide (a mechanical Intent, not yet confirmed)
    {
      actor: ids.playerUserId,
      type: "intent.recorded",
      payload: carrier(hide("i-2", ana, "declared", "composer"), "declared"),
    },
    // 4: the read starts
    {
      actor: "system",
      type: "presence.recorded",
      payload: { present: [ids.playerUserId], purpose: "read" },
    },
    // 5: the DM confirms the hide
    {
      actor: ids.dmActor,
      type: "action.suggested",
      payload: {
        suggestionId: "sug-1",
        readSeq: 3,
        items: [
          {
            itemId: "i1",
            text: "Ana slips into the shadows by the loft ladder.",
            intent: hide("sug-1.i1", ana, "declared", "ai"),
          },
        ],
      },
    },
    // 6-7: Bram's controller says another line; a later confirm supersedes sug-1
    {
      actor: ids.otherPlayerUserId,
      type: "talk",
      payload: { text: "Cover me.", channel: "ic", characterId: "bram" },
    },
    {
      actor: ids.otherPlayerUserId,
      type: "intent.recorded",
      payload: carrier(say("i-3", bram, "Cover me.")),
    },
    // 8: the second confirm (sug-2)
    {
      actor: ids.dmActor,
      type: "action.suggested",
      payload: {
        suggestionId: "sug-2",
        readSeq: 7,
        items: [
          {
            itemId: "i1",
            text: "The party climbs to the loft.",
            intent: {
              id: "sug-2.i1",
              kind: "attempt",
              actor: ana,
              targets: [],
              params: { scope: "party" },
              text: "climb to the loft",
              source: "ai",
              commit: "declared",
            },
          },
        ],
      },
    },
    // 9: the thumbs-up plans the Intent as confirmed
    {
      actor: ids.playerUserId,
      type: "intent.recorded",
      payload: carrier(
        {
          id: "sug-2.i1",
          kind: "attempt",
          actor: ana,
          targets: [],
          params: { scope: "party" },
          text: "climb to the loft",
          source: "composer",
          commit: "confirmed",
        },
        "needs_ruling",
      ),
    },
    // 10-11: Tamsin asks the DM (visible to her and the DM only)
    {
      actor: ids.otherPlayerUserId,
      type: "talk",
      payload: {
        text: "@dm how high is the loft?",
        channel: "ooc",
        characterId: null,
      },
      visibility: ids.otherPlayerUserId,
    },
    {
      actor: ids.otherPlayerUserId,
      type: "intent.recorded",
      payload: carrier({
        id: "i-4",
        kind: "ask_dm",
        actor: bram,
        channel: { kind: "dm" },
        targets: [],
        params: {},
        text: "how high is the loft?",
        source: "composer",
        commit: "confirmed",
      }),
      visibility: ids.otherPlayerUserId,
    },
    // 12: the answer
    {
      actor: ids.dmActor,
      type: "talk",
      payload: {
        text: "About twelve feet.",
        channel: "ooc",
        characterId: null,
      },
      visibility: ids.otherPlayerUserId,
    },
    // 13: combat begins
    {
      actor: ids.dmActor,
      type: "table-mode.changed",
      payload: {
        reason: "Combat begins",
        before: { mode: "free" },
        after: {
          mode: "turn",
          activeActor: ids.playerUserId,
          activeCharacterId: "ana",
        },
      },
    },
  ]),
};
