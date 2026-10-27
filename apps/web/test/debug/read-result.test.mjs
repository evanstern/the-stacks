import assert from "node:assert/strict";
import { test } from "node:test";
import {
  readChronicleResult,
  readCompanionResult,
  readTrigger,
  readTurnResult,
} from "../../app/debug/read-result.ts";

const usage = {
  provider: "fake",
  model: "fake-1",
  inputTokens: 10,
  outputTokens: 5,
  costUsd: 0.01,
  durationMs: 120,
};
const call = (over = {}) => ({
  purpose: "dm.narrate",
  promptVersion: "v1",
  attempt: 1,
  outcome: "ok",
  errorKind: null,
  ...usage,
  ...over,
});
const sub = (over = {}) => ({
  stepRef: "s1",
  key: "k1",
  kind: "mechanics",
  result: "applied",
  refusal: null,
  batchId: "b1",
  proposalId: null,
  outcome: null,
  seqs: [4, 5],
  ...over,
});
const attempt = {
  attempt: 1,
  words: 42,
  deterministic: {
    pass: false,
    issues: [{ kind: "length", detail: "too long", blocking: true }],
  },
  llm: {
    verdict: "pass",
    issues: [{ kind: "tone", detail: "flat", blocking: false }],
  },
  proseSha256: "abc",
};

test("a finished turn reads checkpoint, outcome, calls", () => {
  const t = readTurnResult({
    checkpoint: {
      beat: ["a1"],
      npcTurn: null,
      director: { x: 1 },
      interpret: null,
      adjudicate: null,
      submissions: [sub()],
      lastSeq: 5,
      narration: { attempts: [attempt], shipped: true, seqs: [6] },
    },
    outcome: { status: "completed" },
    audit: { final: "passed" },
    calls: [call()],
  });
  assert.equal(t.outcome, "completed");
  assert.deepEqual(t.checkpoint.beat, ["a1"]);
  assert.deepEqual(t.checkpoint.submissions[0].seqs, [4, 5]);
  assert.equal(t.checkpoint.narration.shipped, true);
  assert.deepEqual(t.checkpoint.narration.seqs, [6]);
  const a = t.checkpoint.narration.attempts[0];
  assert.equal(a.words, 42);
  assert.deepEqual(a.blocking, [{ kind: "length", detail: "too long" }]);
  assert.deepEqual(a.advisory, [{ kind: "tone", detail: "flat" }]);
  assert.equal(a.proseHash, "abc");
  assert.equal(t.calls[0].usage.model, "fake-1");
  assert.equal(t.failure, null);
});

test("a failed turn reads the failure and its excerpts", () => {
  const t = readTurnResult({
    checkpoint: { beat: null, submissions: [] },
    outcome: { status: "failed" },
    audit: null,
    calls: [],
    failure: {
      node: "director",
      kind: "invalid-output",
      message: "bad json",
      detail: {
        attempts: [{ attempt: 1, chars: 9, issues: "x", excerpt: "{oops" }],
      },
    },
  });
  assert.equal(t.outcome, "failed");
  assert.equal(t.failure.node, "director");
  assert.equal(t.failure.excerpts[0].excerpt, "{oops");
  assert.equal(t.failure.excerpts[0].chars, 9);
});

test("a held turn reads outcome held", () => {
  const t = readTurnResult({
    checkpoint: { submissions: [] },
    outcome: { status: "held" },
    audit: null,
    calls: [call()],
  });
  assert.equal(t.outcome, "held");
  assert.equal(t.calls.length, 1);
});

test("a running turn has a checkpoint only", () => {
  const t = readTurnResult({
    checkpoint: { beat: ["a"], submissions: [sub()] },
  });
  assert.equal(t.outcome, null);
  assert.equal(t.calls.length, 0);
  assert.equal(t.checkpoint.submissions.length, 1);
  assert.equal(t.checkpoint.narration, null);
});

test("a queued job (null result) reads empty", () => {
  const t = readTurnResult(null);
  assert.equal(t.checkpoint, null);
  assert.equal(t.outcome, null);
  assert.deepEqual(t.calls, []);
});

test("companion and chronicle results", () => {
  const c = readCompanionResult({
    plays: [
      {
        companionId: "bram",
        status: "played",
        submissions: [{ kind: "say", ok: true, code: null, seqs: [9] }],
      },
    ],
    calls: [call()],
  });
  assert.equal(c.plays[0].companion, "bram");
  assert.deepEqual(c.plays[0].submissions[0].seqs, [9]);
  assert.equal(c.calls.length, 1);
  const ch = readChronicleResult({ entries: 2, seqs: [11, 12], calls: [] });
  assert.equal(ch.entries, 2);
  assert.deepEqual(ch.seqs, [11, 12]);
});

test("missing usage reads null; missing seqs read undefined", () => {
  const t = readTurnResult({
    checkpoint: {
      submissions: [sub({ seqs: undefined })],
      narration: { attempts: [], shipped: true },
    },
    calls: [
      {
        purpose: "dm.director",
        promptVersion: "v1",
        attempt: 1,
        outcome: "ok",
        errorKind: null,
      },
    ],
  });
  assert.equal(t.calls[0].usage, null);
  assert.equal(t.checkpoint.submissions[0].seqs, undefined);
  assert.equal(t.checkpoint.narration.seqs, undefined);
  const nulls = readTurnResult({
    calls: [
      call({
        provider: null,
        model: null,
        inputTokens: null,
        outputTokens: null,
        costUsd: null,
        durationMs: null,
      }),
    ],
  });
  assert.equal(nulls.calls[0].usage, null);
});

test("garbage never throws", () => {
  for (const v of [
    null,
    undefined,
    42,
    "x",
    [],
    {},
    { checkpoint: "x" },
    { calls: 3 },
    { plays: "x" },
  ]) {
    assert.doesNotThrow(() => readTurnResult(v));
    assert.doesNotThrow(() => readCompanionResult(v));
    assert.doesNotThrow(() => readChronicleResult(v));
  }
  assert.equal(readTurnResult({ checkpoint: "x" }).checkpoint, null);
});

test("readTrigger", () => {
  assert.equal(
    readTrigger({ kind: "turn", input: { trigger: "commit" } }),
    "commit",
  );
  assert.equal(
    readTrigger({ kind: "companion", input: { reason: "hold" } }),
    "hold",
  );
  assert.equal(readTrigger({ kind: "chronicle", input: {} }), "chronicle");
  assert.equal(readTrigger({ kind: "turn", input: null }), "unknown");
});
