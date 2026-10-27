import assert from "node:assert/strict";
import { test } from "node:test";
import { isActive, nextDelayMs } from "../../app/debug/activity.ts";

const NOW = 1_000_000;
const snap = (jobs = [], lastEventAt = null) => ({
  jobs: new Map(jobs.map((j, i) => [String(i), j])),
  lastEventAt,
});

test("active with a queued job", () => {
  assert.equal(isActive(snap([{ status: "queued" }]), NOW), true);
});
test("active with a running job", () => {
  assert.equal(isActive(snap([{ status: "running" }]), NOW), true);
});
test("active with an event 29 s ago", () => {
  assert.equal(isActive(snap([], NOW - 29_000), NOW), true);
});
test("active with a retry 29 s ago", () => {
  assert.equal(isActive(snap(), NOW, NOW - 29_000), true);
});
test("idle at 31 s with only terminal jobs", () => {
  const s = snap([{ status: "succeeded" }, { status: "failed" }], NOW - 31_000);
  assert.equal(isActive(s, NOW, NOW - 31_000), false);
  assert.equal(isActive(snap(), NOW), false);
});
test("nextDelayMs", () => {
  assert.equal(nextDelayMs(true), 2000);
  assert.equal(nextDelayMs(false), 10000);
});
