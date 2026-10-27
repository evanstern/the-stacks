import assert from "node:assert/strict";
import { test } from "node:test";
import { createPoller } from "../../app/debug/poller.ts";

function fakeTimers() {
  const pending = new Map();
  let id = 0;
  return {
    pending,
    setTimeout(fn, ms) {
      pending.set(++id, { fn, ms });
      return id;
    },
    clearTimeout(h) {
      pending.delete(h);
    },
    fire() {
      const [[h, t]] = [...pending];
      pending.delete(h);
      t.fn();
    },
  };
}
const flush = () => new Promise((r) => setImmediate(r));
function deferred() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
}

test("ticks never overlap; the next waits for settle", async () => {
  const timers = fakeTimers();
  const d = deferred();
  let ticks = 0;
  const p = createPoller({
    tick: () => {
      ticks++;
      return ticks === 1 ? d.promise : Promise.resolve();
    },
    delayMs: () => 2000,
    timers,
  });
  p.start();
  await flush();
  assert.equal(ticks, 1);
  assert.equal(timers.pending.size, 0);
  d.resolve();
  await flush();
  assert.equal(timers.pending.size, 1);
  assert.equal([...timers.pending.values()][0].ms, 2000);
});

test("the delay follows delayMs() after each tick", async () => {
  const timers = fakeTimers();
  let delay = 2000;
  const p = createPoller({
    tick: async () => {},
    delayMs: () => delay,
    timers,
  });
  p.start();
  await flush();
  assert.equal([...timers.pending.values()][0].ms, 2000);
  delay = 10000;
  timers.fire();
  await flush();
  assert.equal([...timers.pending.values()][0].ms, 10000);
});

test("kick ticks at once and cancels the pending wait", async () => {
  const timers = fakeTimers();
  let ticks = 0;
  const p = createPoller({
    tick: async () => {
      ticks++;
    },
    delayMs: () => 2000,
    timers,
  });
  p.start();
  await flush();
  assert.equal(timers.pending.size, 1);
  p.kick();
  assert.equal(timers.pending.size, 0);
  await flush();
  assert.equal(ticks, 2);
  assert.equal(timers.pending.size, 1);
});

test("hidden schedules no tick; becoming visible ticks at once", async () => {
  const timers = fakeTimers();
  let visible = false;
  let ticks = 0;
  const p = createPoller({
    tick: async () => {
      ticks++;
    },
    delayMs: () => 2000,
    timers,
    visibility: { isVisible: () => visible },
  });
  p.start();
  await flush();
  assert.equal(ticks, 0);
  assert.equal(timers.pending.size, 0);
  visible = true;
  p.visibilityChanged();
  await flush();
  assert.equal(ticks, 1);
  assert.equal(timers.pending.size, 1);
  visible = false;
  p.visibilityChanged();
  assert.equal(timers.pending.size, 0);
});

test("a tick that reports an auth error stops the poller", async () => {
  const timers = fakeTimers();
  let ticks = 0;
  const p = createPoller({
    tick: async () => {
      ticks++;
      return "stop";
    },
    delayMs: () => 2000,
    timers,
  });
  p.start();
  await flush();
  assert.equal(timers.pending.size, 0);
  p.kick();
  await flush();
  assert.equal(ticks, 1);
});
