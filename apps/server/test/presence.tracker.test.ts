import { describe, expect, it } from "vitest";
import { createPresence } from "../src/presence/index.js";

/** A manual clock: timers fire only when the test says so. */
function makeTracker() {
  const timers = new Map<number, () => void>();
  let next = 1;
  const tracker = createPresence({
    graceMs: 5000,
    setTimer: (fn) => {
      const id = next++;
      timers.set(id, fn);
      return id;
    },
    clearTimer: (handle) => {
      timers.delete(handle as number);
    },
  });
  const changes: string[] = [];
  tracker.reader.onChange((s) => changes.push(s));
  return {
    tracker,
    changes,
    pending: () => timers.size,
    fireAll: () => {
      for (const [id, fn] of [...timers]) {
        timers.delete(id);
        fn();
      }
    },
  };
}

const S = "session-1";
const ana = (connId: string) => ({
  connId,
  userId: "u-ana",
  displayName: "Ana",
});
const bo = (connId: string) => ({ connId, userId: "u-bo", displayName: "Bo" });

describe("presence tracker", () => {
  it("a first join emits and lists the user", () => {
    const { tracker, changes } = makeTracker();
    tracker.join(S, ana("c1"));
    expect(changes).toEqual([S]);
    expect(tracker.reader.presentUsers(S)).toEqual([
      { userId: "u-ana", displayName: "Ana" },
    ]);
  });

  it("a second tab of the same user does not emit", () => {
    const { tracker, changes } = makeTracker();
    tracker.join(S, ana("c1"));
    tracker.join(S, ana("c2"));
    expect(changes).toHaveLength(1);
    expect(tracker.reader.presentUsers(S)).toHaveLength(1);
  });

  it("one tab closing keeps the user and starts no timer", () => {
    const { tracker, changes, pending } = makeTracker();
    tracker.join(S, ana("c1"));
    tracker.join(S, ana("c2"));
    tracker.leave(S, "c1");
    expect(pending()).toBe(0);
    expect(changes).toHaveLength(1);
    expect(tracker.reader.isPresent(S, "u-ana")).toBe(true);
  });

  it("the last close keeps the user through grace, then emits once", () => {
    const { tracker, changes, fireAll } = makeTracker();
    tracker.join(S, ana("c1"));
    tracker.leave(S, "c1");
    expect(changes).toHaveLength(1);
    expect(tracker.reader.isPresent(S, "u-ana")).toBe(true);
    fireAll();
    expect(changes).toEqual([S, S]);
    expect(tracker.reader.presentUsers(S)).toEqual([]);
    expect(tracker.reader.isPresent(S, "u-ana")).toBe(false);
  });

  it("a rejoin inside grace emits nothing and cancels the timer", () => {
    const { tracker, changes, pending, fireAll } = makeTracker();
    tracker.join(S, ana("c1"));
    tracker.leave(S, "c1");
    tracker.join(S, ana("c2"));
    expect(pending()).toBe(0);
    fireAll();
    expect(changes).toHaveLength(1);
    expect(tracker.reader.isPresent(S, "u-ana")).toBe(true);
  });

  it("presentUsers is sorted by userId and scoped to the table", () => {
    const { tracker } = makeTracker();
    tracker.join(S, bo("c1"));
    tracker.join(S, ana("c2"));
    tracker.join("session-2", ana("c3"));
    expect(tracker.reader.presentUsers(S).map((e) => e.userId)).toEqual([
      "u-ana",
      "u-bo",
    ]);
    expect(tracker.reader.presentUsers("session-2")).toHaveLength(1);
  });

  it("a new tracker (restart) is empty", () => {
    const { tracker } = makeTracker();
    tracker.join(S, ana("c1"));
    expect(makeTracker().tracker.reader.presentUsers(S)).toEqual([]);
  });

  it("isPresent is true for AI actors regardless of membership", () => {
    const { tracker } = makeTracker();
    expect(tracker.reader.isPresent(S, "ai:dm")).toBe(true);
    expect(tracker.reader.isPresent(S, "ai:companion:abc")).toBe(true);
    expect(tracker.reader.isPresent(S, "u-ana")).toBe(false);
  });

  it("onChange returns an unsubscribe; close clears timers", () => {
    const { tracker, pending, changes } = makeTracker();
    const off = tracker.reader.onChange(() => {});
    off();
    tracker.join(S, ana("c1"));
    tracker.leave(S, "c1");
    expect(pending()).toBe(1);
    tracker.close();
    expect(pending()).toBe(0);
    expect(changes).toHaveLength(1);
  });
});
