import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyEvent,
  createTurn,
  endWithoutTerminal,
  stopTurn,
} from "../app/ask/turns.ts";

function citation(overrides = {}) {
  return {
    n: 1,
    chunkId: "c1",
    documentId: "d1",
    book: "Basic Rules",
    section: ["Combat", "Grappling"],
    quote: "a special melee attack, a grapple",
    span: { start: 48213, end: 48285 },
    passage: {
      kind: "prose",
      text: "When you want to grab a creature … a grapple.",
      span: { start: 48100, end: 48790 },
    },
    quoteInPassage: { start: 113, end: 185 },
    ...overrides,
  };
}

test("delta events append text in order", () => {
  let turn = createTurn("t1", "How does grappling work?");
  turn = applyEvent(turn, { event: "delta", data: { text: "A grapple " } });
  turn = applyEvent(turn, {
    event: "delta",
    data: { text: "replaces an attack." },
  });
  assert.deepEqual(turn.parts, [
    { type: "text", text: "A grapple replaces an attack." },
  ]);
});

test("citation placement: appears as a marker at its arrival point", () => {
  let turn = createTurn("t1", "q");
  turn = applyEvent(turn, { event: "delta", data: { text: "A grapple" } });
  turn = applyEvent(turn, { event: "citation", data: citation({ n: 1 }) });
  turn = applyEvent(turn, { event: "delta", data: { text: " continues." } });
  assert.deepEqual(turn.parts, [
    { type: "text", text: "A grapple" },
    { type: "cite", n: 1, quote: "a special melee attack, a grapple" },
    { type: "text", text: " continues." },
  ]);
  assert.equal(turn.citations[1].book, "Basic Rules");
});

test("a repeated n renders as the same reference (keeps the first citation)", () => {
  let turn = createTurn("t1", "q");
  turn = applyEvent(turn, {
    event: "citation",
    data: citation({ n: 1, quote: "first" }),
  });
  turn = applyEvent(turn, {
    event: "citation",
    data: citation({ n: 1, quote: "second" }),
  });
  assert.equal(turn.parts.filter((p) => p.type === "cite").length, 2);
  assert.equal(turn.citations[1].quote, "first");
  assert.deepEqual(
    turn.parts.filter((p) => p.type === "cite").map((p) => p.quote),
    ["first", "second"],
  );
});

test("refusal clears every streamed delta and citation (SC-004)", () => {
  let turn = createTurn("t1", "q");
  turn = applyEvent(turn, { event: "delta", data: { text: "partial answer" } });
  turn = applyEvent(turn, { event: "citation", data: citation() });
  turn = applyEvent(turn, {
    event: "refusal",
    data: {
      reason: "nothing_relevant",
      message: "The library has nothing relevant to this question.",
    },
  });
  assert.equal(turn.state, "refused");
  assert.deepEqual(turn.parts, []);
  assert.deepEqual(turn.citations, {});
  assert.equal(
    turn.message,
    "The library has nothing relevant to this question.",
  );
});

test("error keeps the partial text and sets the message", () => {
  let turn = createTurn("t1", "q");
  turn = applyEvent(turn, { event: "delta", data: { text: "partial" } });
  turn = applyEvent(turn, {
    event: "error",
    data: {
      kind: "upstream",
      message: "The model provider failed. Try again.",
    },
  });
  assert.equal(turn.state, "interrupted");
  assert.deepEqual(turn.parts, [{ type: "text", text: "partial" }]);
  assert.equal(turn.message, "The model provider failed. Try again.");
});

test("end-without-terminal marks interrupted with the connection-dropped message", () => {
  let turn = createTurn("t1", "q");
  turn = applyEvent(turn, { event: "delta", data: { text: "partial" } });
  turn = endWithoutTerminal(turn);
  assert.equal(turn.state, "interrupted");
  assert.equal(
    turn.message,
    "The connection closed before the answer finished.",
  );
  assert.deepEqual(turn.parts, [{ type: "text", text: "partial" }]);
});

test("stop keeps the partial text, marked stopped", () => {
  let turn = createTurn("t1", "q");
  turn = applyEvent(turn, { event: "delta", data: { text: "partial" } });
  turn = stopTurn(turn);
  assert.equal(turn.state, "stopped");
  assert.deepEqual(turn.parts, [{ type: "text", text: "partial" }]);
});

test("done keeps the dropped summary", () => {
  let turn = createTurn("t1", "q");
  turn = applyEvent(turn, {
    event: "done",
    data: { citations: 1, dropped: 1, passages: 2, promptVersion: "answer-v1" },
  });
  assert.equal(turn.state, "done");
  assert.equal(turn.summary.dropped, 1);
});

test("unknown events are ignored", () => {
  const turn = createTurn("t1", "q");
  const next = applyEvent(turn, { event: "ping", data: {} });
  assert.equal(next, turn);
});
