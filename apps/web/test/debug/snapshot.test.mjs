import assert from "node:assert/strict";
import { test } from "node:test";
import {
  emptySnapshot,
  mergeCalls,
  mergeEvents,
  mergeJobs,
  mergeOlderJobs,
  setNotice,
  setSeed,
} from "../../app/debug/snapshot.ts";

const ev = (seq) => ({ seq, type: "x" });
const job = (id, status = "queued") => ({ id, status });
const page = (events, nextAfter, headSeq = nextAfter) => ({
  events,
  nextAfter,
  headSeq,
});

test("mergeEvents keeps ascending seq, drops duplicates", () => {
  let s = emptySnapshot();
  s = mergeEvents(s, page([ev(2), ev(1)], 2), 1000);
  s = mergeEvents(s, page([ev(2), ev(3)], 3), 2000);
  assert.deepEqual(
    s.events.map((e) => e.seq),
    [1, 2, 3],
  );
  assert.equal(s.eventsAfter, 3);
  assert.equal(s.headSeq, 3);
});

test("lastEventAt moves only when a new seq arrives", () => {
  let s = mergeEvents(emptySnapshot(), page([ev(1)], 1), 1000);
  assert.equal(s.lastEventAt, 1000);
  s = mergeEvents(s, page([ev(1)], 1), 5000);
  assert.equal(s.lastEventAt, 1000);
  s = mergeEvents(s, page([], 1), 6000);
  assert.equal(s.lastEventAt, 1000);
  s = mergeEvents(s, page([ev(2)], 2), 7000);
  assert.equal(s.lastEventAt, 7000);
});

test("mergeJobs replaces by id and sets the older cursor once", () => {
  let s = mergeJobs(emptySnapshot(), {
    jobs: [job("a"), job("b")],
    nextBefore: "b",
  });
  assert.equal(s.olderJobsBefore, "b");
  s = mergeJobs(s, { jobs: [job("a", "running")], nextBefore: "a" });
  assert.equal(s.jobs.get("a").status, "running");
  assert.equal(s.jobs.size, 2);
  assert.equal(s.olderJobsBefore, "b");
});

test("mergeOlderJobs adds without replacing newer copies", () => {
  let s = mergeJobs(emptySnapshot(), {
    jobs: [job("a", "succeeded")],
    nextBefore: "a",
  });
  s = mergeOlderJobs(s, {
    jobs: [job("a", "queued"), job("z")],
    nextBefore: null,
  });
  assert.equal(s.jobs.get("a").status, "succeeded");
  assert.ok(s.jobs.has("z"));
  assert.equal(s.olderJobsBefore, null);
});

test("mergeCalls keeps ascending id and replaces totals", () => {
  let s = mergeCalls(emptySnapshot(), {
    calls: [{ id: 2 }, { id: 1 }],
    nextAfter: 2,
    totals: { v: 1 },
  });
  s = mergeCalls(s, {
    calls: [{ id: 2 }, { id: 3 }],
    nextAfter: 3,
    totals: { v: 2 },
  });
  assert.deepEqual(
    s.calls.map((c) => c.id),
    [1, 2, 3],
  );
  assert.equal(s.callsAfter, 3);
  assert.deepEqual(s.totals, { v: 2 });
});

test("reducers never mutate input", () => {
  const s0 = mergeJobs(mergeEvents(emptySnapshot(), page([ev(1)], 1), 1), {
    jobs: [job("a")],
    nextBefore: null,
  });
  const frozen = JSON.stringify([
    s0.events,
    [...s0.jobs],
    s0.calls,
    s0.seed,
    s0.notice,
  ]);
  const eventsRef = s0.events;
  const jobsRef = s0.jobs;
  mergeEvents(s0, page([ev(2)], 2), 5);
  mergeJobs(s0, { jobs: [job("b")], nextBefore: null });
  mergeOlderJobs(s0, { jobs: [job("c")], nextBefore: null });
  mergeCalls(s0, { calls: [{ id: 1 }], nextAfter: 1, totals: {} });
  setSeed(s0, { kind: "none" }, "scene");
  setNotice(s0, "hi");
  assert.equal(s0.events, eventsRef);
  assert.equal(s0.jobs, jobsRef);
  assert.equal(
    JSON.stringify([s0.events, [...s0.jobs], s0.calls, s0.seed, s0.notice]),
    frozen,
  );
});

test("setSeed and setNotice", () => {
  const s = setNotice(setSeed(emptySnapshot(), { kind: "none" }, "sc"), "oops");
  assert.deepEqual(s.seed, { kind: "none" });
  assert.equal(s.seedFor, "sc");
  assert.equal(s.notice, "oops");
});
