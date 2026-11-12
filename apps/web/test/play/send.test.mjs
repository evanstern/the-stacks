import assert from "node:assert/strict";
import { test } from "node:test";
import { routeSend } from "../../app/play/send.ts";

const ana = { kind: "pc", id: "ana" };
const ctx = (over = {}) => ({
  ooc: false,
  actor: ana,
  characterId: "ana",
  mode: "free",
  active: false,
  id: "int-1",
  ...over,
});

test("free mode: prose is a say at declared", () => {
  const r = routeSend("I'll get up there.", ctx());
  assert.equal(r.kind, "intent");
  assert.equal(r.intent.kind, "say");
  assert.equal(r.intent.commit, "declared");
});

test("turn mode, active player, prose: declare then commit", () => {
  const r = routeSend(
    "I shoot the goblin",
    ctx({ mode: "turn", active: true }),
  );
  assert.deepEqual(r, {
    kind: "declare-commit",
    declare: {
      text: "I shoot the goblin",
      characterId: "ana",
      scope: "character",
    },
  });
});

test("turn mode, active player, slash verb: an intent at confirmed", () => {
  const r = routeSend(
    "/do climb the wall",
    ctx({ mode: "turn", active: true }),
  );
  assert.equal(r.kind, "intent");
  assert.equal(r.intent.kind, "attempt");
  assert.equal(r.intent.commit, "confirmed");
});

test("turn mode, non-active player: prose is a say at confirmed", () => {
  const r = routeSend("Good luck!", ctx({ mode: "turn", active: false }));
  assert.equal(r.kind, "intent");
  assert.equal(r.intent.kind, "say");
  assert.equal(r.intent.commit, "confirmed");
});

test("turn mode, non-active player: a slash verb goes at confirmed for the gate to refuse", () => {
  const r = routeSend("/do climb", ctx({ mode: "turn", active: false }));
  assert.equal(r.kind, "intent");
  assert.equal(r.intent.commit, "confirmed");
});

test("(( and /ooc are ooc; the out-of-character chip sends ooc", () => {
  assert.equal(routeSend("((brb))", ctx()).intent.kind, "ooc");
  assert.equal(routeSend("/ooc brb", ctx()).intent.kind, "ooc");
  const chip = routeSend("brb", ctx({ ooc: true, mode: "turn", active: true }));
  assert.equal(chip.kind, "intent");
  assert.equal(chip.intent.kind, "ooc");
});

test("@dm asks the DM", () => {
  const r = routeSend("@dm how high is it?", ctx());
  assert.equal(r.intent.kind, "ask_dm");
  assert.equal(r.intent.text, "how high is it?");
});

test("a bad slash line is refused with the parser's message", () => {
  const r = routeSend("/nonsense", ctx());
  assert.equal(r.kind, "refused");
  assert.ok(r.message.length > 0);
  assert.equal(routeSend("/do", ctx()).kind, "refused");
});
