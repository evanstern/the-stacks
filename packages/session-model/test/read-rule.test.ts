import { describe, expect, it } from "vitest";
import {
  isDmQuestion,
  isDmReadOutput,
  latestReadablePostSeq,
  project,
  READ_QUIET_MS,
  type ReadablePost,
  RING_BLANK_MS,
  readablePosts,
  readWindowMs,
  type SessionProjections,
  suggestionState,
  type TranscriptEntry,
} from "../src/index.js";
import { makeRows, PLAYER_A, type RowOptions } from "./helpers.js";

type Spec = { type: string; payload: unknown; opts?: RowOptions };

const base = {
  actor: { kind: "pc", id: "ana" },
  targets: [],
  params: {},
  source: "composer",
  commit: "confirmed",
};
const carrier = (intent: unknown, outcome = "settled"): unknown => ({
  intent,
  schemaVersion: 1,
  outcome,
  batchId: null,
  facts: [],
  request: null,
  answers: null,
  stopped: null,
});
const say = (id: string, text = "hello", kind = "say"): Spec[] => [
  {
    type: "talk",
    payload: { text, channel: "ic", characterId: "ana" },
    opts: { actor: PLAYER_A },
  },
  {
    type: "intent.recorded",
    payload: carrier({ ...base, id, kind, text }),
    opts: { actor: PLAYER_A },
  },
];
const hide = (id: string, commit = "declared", actor = PLAYER_A): Spec => ({
  type: "intent.recorded",
  payload: carrier(
    { ...base, id, kind: "hide", commit },
    commit === "declared" ? "declared" : "settled",
  ),
  opts: { actor },
});
const askDm = (id: string, text = "@dm how high?"): Spec => ({
  type: "intent.recorded",
  payload: carrier({
    ...base,
    id,
    kind: "ask_dm",
    channel: { kind: "dm" },
    text,
  }),
  opts: { actor: PLAYER_A, visibility: PLAYER_A },
});
const turnMode: Spec = {
  type: "table-mode.changed",
  payload: {
    reason: "combat",
    before: { mode: "free" },
    after: { mode: "turn", activeActor: PLAYER_A, activeCharacterId: "ana" },
  },
};
const humanSeat: Spec = {
  type: "dm.seat.changed",
  payload: {
    reason: "seat",
    before: { kind: "ai" },
    after: { kind: "human", userId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" },
  },
  opts: { actor: PLAYER_A },
};
const suggest = (id: string, readSeq = 1, intentId = `${id}.i1`): Spec => ({
  type: "action.suggested",
  payload: {
    suggestionId: id,
    readSeq,
    items: [
      {
        itemId: "i1",
        text: "Ana hides.",
        intent: {
          ...base,
          id: intentId,
          kind: "hide",
          commit: "declared",
          source: "ai",
        },
      },
    ],
  },
});

const fold = (...groups: (Spec | Spec[])[]): SessionProjections =>
  project(makeRows(groups.flat()), { role: "dm" });
const rules = (p: SessionProjections) => readablePosts(p).map((r) => r.rule);

describe("readablePosts (FR-006)", () => {
  it("rule 1: a human say, say_to and emote in free mode", () => {
    const p = fold(say("a"), say("b", "x", "emote"));
    expect(rules(p)).toEqual([1, 1]);
    expect(readablePosts(p)[0]).toMatchObject({ seq: 1, intentId: "a" });
  });

  it("rule 1: an AI companion's say reads; a companion talk with a carrier is not read twice", () => {
    const p = fold([
      {
        type: "talk",
        payload: { text: "Bram nods.", channel: "ic", characterId: "bram" },
        opts: { actor: "ai:companion:bram" },
      },
      {
        type: "intent.recorded",
        payload: carrier({
          ...base,
          id: "c1",
          kind: "say",
          actor: { kind: "companion", id: "bram" },
          text: "Bram nods.",
        }),
        opts: { actor: "ai:companion:bram" },
      },
    ]);
    expect(rules(p)).toEqual([1]);
  });

  it("rule 2: a declared mechanical Intent; a confirmed one is not read", () => {
    expect(rules(fold(hide("h1")))).toEqual([2]);
    expect(rules(fold(hide("h1", "confirmed")))).toEqual([]);
  });

  it("rule 2 negation: a runner declare <actionId>.<n> is not a post (OQ-9)", () => {
    const declared: Spec = {
      type: "action.declared",
      payload: {
        actionId: "act-1",
        characterId: "ana",
        scope: "character",
        text: "hide",
      },
      opts: { actor: PLAYER_A },
    };
    expect(rules(fold(declared, hide("act-1.1")))).toEqual([]);
    // the id rule needs an existing action: no action, still a post
    expect(rules(fold(hide("act-1.1")))).toEqual([2]);
    expect(rules(fold(declared, hide("act-1x")))).toEqual([2]);
  });

  it("rule 3: ask_dm in free and turn mode", () => {
    expect(rules(fold(askDm("q1")))).toEqual([3]);
    expect(rules(fold(askDm("q1"), turnMode))).toEqual([3]);
  });

  it("rule 4: a public ic companion talk row with no carrier", () => {
    const p = fold({
      type: "talk",
      payload: { text: "Bram grunts.", channel: "ic", characterId: "bram" },
      opts: { actor: "ai:companion:bram" },
    });
    expect(readablePosts(p)).toMatchObject([{ rule: 4, intentId: null }]);
  });

  it("rule 4 negation: ooc talk, a whisper row, ai:dm talk", () => {
    const talk = (channel: string, actor: string, visibility = "public") => ({
      type: "talk",
      payload: { text: "x", channel, characterId: null },
      opts: { actor, visibility },
    });
    expect(rules(fold(talk("ooc", "ai:companion:bram")))).toEqual([]);
    expect(rules(fold(talk("ic", "ai:companion:bram", PLAYER_A)))).toEqual([]);
    expect(rules(fold(talk("ic", "ai:dm")))).toEqual([]);
  });

  it("turn mode: rules 1, 2 and 4 return nothing", () => {
    const comp: Spec = {
      type: "talk",
      payload: { text: "x", channel: "ic", characterId: "bram" },
      opts: { actor: "ai:companion:bram" },
    };
    expect(rules(fold(turnMode, say("a"), hide("h"), comp))).toEqual([]);
  });

  it("a human seat: every rule returns nothing", () => {
    expect(rules(fold(humanSeat, say("a"), hide("h"), askDm("q")))).toEqual([]);
  });

  it("not readable: a whisper, ai:dm, ooc, @dmx", () => {
    const other = (kind: string, extra: object = {}): Spec => ({
      type: "intent.recorded",
      payload: carrier({
        ...base,
        id: `x-${kind}`,
        kind,
        text: "psst",
        ...extra,
      }),
      opts: { actor: PLAYER_A },
    });
    const aiDm: Spec = {
      type: "intent.recorded",
      payload: carrier({
        ...base,
        id: "n1",
        kind: "narrate",
        actor: { kind: "ai:dm" },
        text: "The wind rises.",
      }),
      opts: { actor: "ai:dm" },
    };
    expect(
      rules(
        fold(
          other("whisper", {
            channel: { kind: "whisper", to: [{ kind: "dm" }] },
          }),
          other("ooc"),
          other("party"),
          aiDm,
        ),
      ),
    ).toEqual([]);
    expect(isDmQuestion("@dm how high?")).toBe(true);
    expect(isDmQuestion("  @DM hi")).toBe(true);
    expect(isDmQuestion("@dmx hi")).toBe(false);
    expect(isDmQuestion("ask @dm")).toBe(false);
  });

  it("latestReadablePostSeq", () => {
    expect(latestReadablePostSeq(fold())).toBe(0);
    expect(latestReadablePostSeq(fold(say("a"), hide("h")))).toBe(3);
  });
});

describe("windows (FR-007)", () => {
  it("10 s for a post; 0 for ask_dm in turn mode", () => {
    expect(READ_QUIET_MS).toBe(10_000);
    expect(RING_BLANK_MS).toBe(2_000);
    const free = fold(askDm("q"), say("a"));
    const [q, s] = readablePosts(free);
    expect(readWindowMs(q as ReadablePost, free)).toBe(READ_QUIET_MS);
    expect(readWindowMs(s as ReadablePost, free)).toBe(READ_QUIET_MS);
    const turn = fold(askDm("q"), turnMode);
    expect(readWindowMs(readablePosts(turn)[0] as ReadablePost, turn)).toBe(0);
  });
});

describe("isDmReadOutput (FR-010)", () => {
  const entries = (...g: Spec[]) => fold(...g).transcript;
  it("an ai:dm narration, a suggestion and an ai:dm ooc talk end a read's input", () => {
    const [n] = entries({
      type: "narration",
      payload: { text: "It rains.", actionIds: [] },
    });
    expect(isDmReadOutput(n as TranscriptEntry)).toBe(true);
    const [s] = entries(suggest("sug-1"));
    expect(isDmReadOutput(s as TranscriptEntry)).toBe(true);
    const [o] = entries({
      type: "talk",
      payload: { text: "About 12 ft.", channel: "ooc", characterId: null },
    });
    expect(isDmReadOutput(o as TranscriptEntry)).toBe(true);
  });
  it("a human line, a companion line and an ai:dm ic talk do not", () => {
    for (const spec of [
      {
        type: "talk",
        payload: { text: "x", channel: "ic", characterId: null },
        opts: { actor: PLAYER_A },
      },
      {
        type: "talk",
        payload: { text: "x", channel: "ic", characterId: "bram" },
        opts: { actor: "ai:companion:bram" },
      },
      {
        type: "talk",
        payload: { text: "x", channel: "ic", characterId: null },
      },
    ] as Spec[]) {
      expect(isDmReadOutput(entries(spec)[0] as TranscriptEntry)).toBe(false);
    }
  });
});

describe("suggestionState (FR-018)", () => {
  it("live; missing", () => {
    const p = fold(say("a"), suggest("sug-1", 2));
    expect(suggestionState(p, "sug-1.i1")).toBe("live");
    expect(suggestionState(p, "sug-9.i1")).toBe("missing");
  });
  it("stale by a later suggestion", () => {
    const p = fold(suggest("sug-1"), suggest("sug-2"));
    expect(suggestionState(p, "sug-1.i1")).toBe("stale");
    expect(suggestionState(p, "sug-2.i1")).toBe("live");
  });
  it("stale by a no-action narration; not by a commit narration", () => {
    const narr = (actionIds: string[]): Spec => ({
      type: "narration",
      payload: { text: "Time passes.", actionIds },
    });
    expect(suggestionState(fold(suggest("sug-1"), narr([])), "sug-1.i1")).toBe(
      "stale",
    );
    expect(
      suggestionState(fold(suggest("sug-1"), narr(["act-1"])), "sug-1.i1"),
    ).toBe("live");
  });
  it("stale by a switch to turn mode", () => {
    expect(suggestionState(fold(suggest("sug-1"), turnMode), "sug-1.i1")).toBe(
      "stale",
    );
  });
  it("confirmed once the Intent has a carrier row, even when stale", () => {
    const p = fold(
      suggest("sug-1"),
      suggest("sug-2"),
      hide("sug-1.i1", "confirmed"),
    );
    expect(suggestionState(p, "sug-1.i1")).toBe("confirmed");
  });
});
