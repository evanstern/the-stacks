import assert from "node:assert/strict";
import { test } from "node:test";
import { toJobView } from "../../app/debug/job-view.ts";

const T0 = Date.parse("2026-10-27T12:00:00.000Z");
const iso = (o) => new Date(T0 + o).toISOString();

const job = (over) => ({
  id: "j1",
  kind: "turn",
  status: "succeeded",
  stage: null,
  attempts: 1,
  input: { trigger: "commit" },
  result: null,
  error: null,
  createdAt: iso(0),
  startedAt: iso(1000),
  heartbeatAt: null,
  finishedAt: iso(6000),
  ...over,
});
const view = (j, ledger = [], now = T0 + 10_000, all = []) =>
  toJobView(j, ledger, now, all);

const sub = (over) => ({
  stepRef: "s",
  key: "k",
  kind: "x",
  result: "applied",
  seqs: [3],
  ...over,
});
const finished = (status, extra = {}) => ({
  checkpoint: {
    beat: ["a1"],
    npcTurn: null,
    submissions: [sub()],
    narration: { attempts: [], shipped: true, seqs: [4] },
  },
  outcome: { status },
  audit: { final: "passed" },
  calls: [],
  ...extra,
});

test("badges", () => {
  assert.equal(view(job({ status: "queued", result: null })).badge, "queued");
  assert.equal(
    view(job({ status: "running", result: { checkpoint: {} } })).badge,
    "running",
  );
  assert.equal(
    view(
      job({
        status: "failed",
        result: { failure: { node: "n", kind: "k", message: "m" } },
      }),
    ).badge,
    "failed",
  );
  assert.equal(view(job({ result: finished("completed") })).badge, "shipped");
  assert.equal(
    view(
      job({ result: finished("completed", { audit: { final: "fallback" } }) }),
    ).badge,
    "fallback",
  );
  assert.equal(view(job({ result: finished("held") })).badge, "held");
  assert.equal(view(job({ result: finished("empty-beat") })).badge, "empty");
  assert.equal(
    view(
      job({
        kind: "companion",
        input: { reason: "r" },
        result: { plays: [], calls: [] },
      }),
    ).badge,
    "shipped",
  );
  assert.equal(
    view(
      job({ kind: "chronicle", result: { entries: 1, seqs: [9], calls: [] } }),
    ).badge,
    "shipped",
  );
});

test("duration: running uses now, finished uses finishedAt, queued is null", () => {
  assert.equal(
    view(job({ status: "running", finishedAt: null }), [], T0 + 9000)
      .durationMs,
    8000,
  );
  assert.equal(view(job()).durationMs, 5000);
  assert.equal(
    view(job({ status: "queued", startedAt: null, finishedAt: null }))
      .durationMs,
    null,
  );
});

test("totals come from ledger rows by jobId, unpriced counted apart, aborted included", () => {
  const row = (jobId, outcome, cost, i, o) => ({
    jobId,
    outcome,
    costUsd: cost,
    inputTokens: i,
    outputTokens: o,
  });
  const t = view(job(), [
    row("j1", "ok", 0.01, 100, 10),
    row("j1", "aborted", 0.02, 50, 5),
    row("j1", "ok", null, null, null),
    row("other", "ok", 9, 9, 9),
  ]).totals;
  assert.deepEqual(t, {
    calls: 3,
    inputTokens: 150,
    outputTokens: 15,
    costUsd: 0.03,
    unpricedCalls: 1,
  });
});

test("seven turn sections in node order; ran false for nodes not run", () => {
  const v = view(job({ result: finished("completed") }));
  assert.deepEqual(
    v.sections.map((s) => s.node),
    [
      "assemble",
      "director",
      "interpret",
      "adjudicate",
      "resolve",
      "narrate-audit",
      "failure",
    ],
  );
  assert.deepEqual(
    v.sections.map((s) => s.ran),
    [true, false, false, false, true, true, false],
  );
  const queued = view(job({ status: "queued", result: null }));
  assert.equal(queued.sections.length, 7);
  assert.ok(queued.sections.every((s) => !s.ran));
  assert.deepEqual(
    view(
      job({ kind: "chronicle", result: { entries: 0, seqs: [], calls: [] } }),
    ).sections,
    [],
  );
});

test("calls are grouped by purpose to section", () => {
  const call = (purpose) => ({ purpose, outcome: "ok" });
  const v = view(
    job({
      result: finished("completed", {
        calls: [
          call("dm.director"),
          call("dm.interpret"),
          call("dm.adjudicate"),
          call("dm.narrate"),
          call("dm.audit"),
          call("dm.narrate"),
        ],
      }),
    }),
  );
  const by = Object.fromEntries(
    v.sections.map((s) => [s.node, s.calls.map((c) => c.purpose)]),
  );
  assert.deepEqual(by.director, ["dm.director"]);
  assert.deepEqual(by.interpret, ["dm.interpret"]);
  assert.deepEqual(by.adjudicate, ["dm.adjudicate"]);
  assert.deepEqual(by["narrate-audit"], [
    "dm.narrate",
    "dm.audit",
    "dm.narrate",
  ]);
  assert.deepEqual(by.resolve, []);
});

test("wroteSeqs unions submissions, narration, plays and chronicle seqs", () => {
  const turn = view(
    job({
      result: finished("completed", {
        checkpoint: {
          beat: [],
          submissions: [sub({ seqs: [3, 4] }), sub({ seqs: [6] })],
          narration: { attempts: [], shipped: true, seqs: [7] },
        },
      }),
    }),
  );
  assert.deepEqual([...turn.wroteSeqs].sort(), [3, 4, 6, 7]);
  const comp = view(
    job({
      kind: "companion",
      input: { reason: "r" },
      result: {
        plays: [
          {
            companionId: "c",
            submissions: [
              { kind: "k", ok: true, seqs: [11] },
              { kind: "k", ok: true, seqs: [12] },
            ],
          },
        ],
        calls: [],
      },
    }),
  );
  assert.deepEqual([...comp.wroteSeqs].sort(), [11, 12]);
  const chr = view(
    job({
      kind: "chronicle",
      result: { entries: 2, seqs: [20, 21], calls: [] },
    }),
  );
  assert.deepEqual([...chr.wroteSeqs].sort(), [20, 21]);
});

test("linkUnknown: empty or absent seqs on a non-refused submission, shipped narration without seqs, attempts > 1", () => {
  const withCp = (cp, over = {}) =>
    view(
      job({
        result: { checkpoint: cp, outcome: { status: "completed" } },
        ...over,
      }),
    );
  assert.equal(withCp({ submissions: [sub({ seqs: [] })] }).linkUnknown, true);
  assert.equal(
    withCp({ submissions: [sub({ seqs: undefined })] }).linkUnknown,
    true,
  );
  assert.equal(
    withCp({ submissions: [], narration: { attempts: [], shipped: true } })
      .linkUnknown,
    true,
  );
  assert.equal(
    withCp({ submissions: [sub()] }, { attempts: 2 }).linkUnknown,
    true,
  );
  // refused with [] is not unknown
  assert.equal(
    withCp({
      submissions: [
        sub({ result: "refused", refusal: { code: "no" }, seqs: [] }),
      ],
    }).linkUnknown,
    false,
  );
  assert.equal(withCp({ submissions: [sub()] }).linkUnknown, false);
});

test("heldBy is the companion job naming the held turn", () => {
  const held = job({ result: finished("held") });
  const comp = { id: "c1", kind: "companion", input: { beatJobId: "j1" } };
  assert.equal(view(held, [], T0, [comp]).heldBy, comp);
  assert.equal(view(held, [], T0, []).heldBy, null);
});

test("never throws on malformed results", () => {
  for (const result of [null, 42, {}, { checkpoint: "x" }])
    assert.doesNotThrow(() => view(job({ result })));
});
