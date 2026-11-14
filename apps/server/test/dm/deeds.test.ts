import type {
  SessionProjections,
  StoredEvent,
} from "@the-stacks/session-model";
import { describe, expect, it } from "vitest";
import { isDeedRow, narrateWindow, windowDeeds } from "../../src/dm/deeds.js";

const intent = (id: string, kind: string, actor: string, extra = {}) => ({
  id,
  kind,
  actor: { kind: "pc", id: actor },
  targets: [],
  params: {},
  source: "composer",
  commit: "confirmed",
  ...extra,
});
const row = (
  seq: number,
  actor: string,
  payload: Record<string, unknown>,
  type = "intent.recorded",
): StoredEvent =>
  ({
    sessionId: "s",
    seq,
    actor,
    type,
    payload: {
      batchId: null,
      request: null,
      answers: null,
      stopped: null,
      ...payload,
    },
    payloadVersion: 1,
    visibility: "public",
    ts: "2026-11-14T00:00:00.000Z",
  }) as StoredEvent;
const projections = {
  party: [{ characterId: "ana", name: "Ana" }],
} as unknown as SessionProjections;

const search = intent("i1", "search", "ana");
const ask = row(1, "pc:ana", {
  intent: search,
  outcome: "needs_ruling",
  request: { requestId: "r1" },
});
const ruling = (seq: number, actor: string, decision: string, answers = "r1") =>
  row(seq, actor, {
    intent: { ...intent("ru" + seq, "ruling", "dm"), params: { decision } },
    outcome: "settled",
    batchId: "b1",
    answers,
  });

describe("isDeedRow", () => {
  it("direct settled with a batch is a deed", () => {
    const r = row(2, "pc:ana", {
      intent: search,
      outcome: "settled",
      batchId: "b",
    });
    expect(isDeedRow(r, [r])?.intent.id).toBe("i1");
  });
  it("a stopped intent is a deed", () => {
    const r = row(2, "pc:ana", {
      intent: search,
      outcome: "declared",
      stopped: { code: "X" },
    });
    expect(isDeedRow(r, [r])).not.toBeNull();
  });
  it("speech (settled, no batch) is not a deed", () => {
    const r = row(2, "pc:ana", { intent: search, outcome: "settled" });
    expect(isDeedRow(r, [r])).toBeNull();
  });
  it("declared is not a deed", () => {
    const r = row(2, "pc:ana", { intent: search, outcome: "declared" });
    expect(isDeedRow(r, [r])).toBeNull();
  });
  it("an ai: row is not a deed", () => {
    const r = row(2, "ai:dm", {
      intent: search,
      outcome: "settled",
      batchId: "b",
    });
    expect(isDeedRow(r, [r])).toBeNull();
  });
  it("a ruling answering a composer ask is the asker's deed", () => {
    const r = ruling(2, "ai:dm", "accept");
    expect(isDeedRow(r, [ask, r])?.intent.id).toBe("i1");
  });
  it("a ruling answering an ai: ask is not a deed", () => {
    const aiAsk = row(1, "ai:dm", {
      intent: search,
      request: { requestId: "r1" },
    });
    const r = ruling(2, "ai:dm", "accept");
    expect(isDeedRow(r, [aiAsk, r])).toBeNull();
  });
  it("a reject ruling is not a deed", () => {
    const r = ruling(2, "ai:dm", "reject");
    expect(isDeedRow(r, [ask, r])).toBeNull();
  });
});

describe("narrateWindow and windowDeeds", () => {
  it("W0 is the newest factsThrough, else the last narration, else 0", () => {
    expect(narrateWindow([{ checkpoint: { factsThrough: 4 } }], 2, 9)).toEqual({
      w0: 4,
      w1: 9,
    });
    expect(narrateWindow([{ checkpoint: {} }], 2, 9)).toEqual({ w0: 2, w1: 9 });
    expect(narrateWindow([], null, 9)).toEqual({ w0: 0, w1: 9 });
  });
  it("lists deeds in seq order and filters by W0", () => {
    const move = row(5, "pc:ana", {
      intent: intent("i2", "move", "ana"),
      outcome: "settled",
      batchId: "b2",
    });
    const all = [move, ask, ruling(3, "ai:dm", "accept")];
    const both = windowDeeds(all, projections, { w0: 0, w1: 9 });
    expect(both.map((d) => d.seq)).toEqual([3, 5]);
    expect(both[0]).toMatchObject({
      name: "Ana",
      intentId: "i1",
      batchId: "b1",
    });
    expect(
      windowDeeds(all, projections, { w0: 3, w1: 9 }).map((d) => d.seq),
    ).toEqual([5]);
  });
});
