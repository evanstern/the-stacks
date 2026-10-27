import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyEvent,
  emptyProjections,
  project,
} from "@the-stacks/session-model";
import { fixtures } from "@the-stacks/session-model/fixtures";
import { createFolder } from "../../app/debug/scrub.ts";

const DM = { role: "dm" };
const strip = ({ pendingBatches: _p, ...rest }) => rest;

test("through(events, seq) equals project of the prefix, for every fixture", () => {
  for (const f of fixtures) {
    const folder = createFolder(DM, 3);
    const last = f.events.at(-1).seq;
    const picks = new Set([
      0,
      1,
      Math.ceil(last / 2),
      last - 1,
      last,
      last + 5,
    ]);
    for (const seq of picks) {
      assert.deepEqual(
        strip(folder.through(f.events, seq)),
        strip(
          project(
            f.events.filter((e) => e.seq <= seq),
            DM,
          ),
        ),
        `${f.name} @${seq}`,
      );
    }
  }
});

test("through works in any order of pins (checkpoints stay valid)", () => {
  const f = fixtures.reduce((a, b) =>
    b.events.length > a.events.length ? b : a,
  );
  const folder = createFolder(DM, 2);
  for (const seq of [f.events.length, 2, 5, 1, f.events.length - 1, 3]) {
    assert.deepEqual(
      strip(folder.through(f.events, seq)),
      strip(
        project(
          f.events.filter((e) => e.seq <= seq),
          DM,
        ),
      ),
    );
  }
});

test("live after appends equals a full project", () => {
  for (const f of fixtures) {
    const folder = createFolder(DM, 3);
    const half = Math.ceil(f.events.length / 2);
    folder.live(f.events.slice(0, half));
    assert.deepEqual(
      strip(folder.live(f.events)),
      strip(project(f.events, DM)),
      f.name,
    );
  }
});

test("a 2,000-event log pins at any seq in under 100 ms", () => {
  const base = fixtures.find((f) => f.events.some((e) => e.type === "talk"));
  const talk = base.events.find((e) => e.type === "talk");
  const events = Array.from({ length: 2000 }, (_, i) => ({
    ...talk,
    seq: i + 1,
  }));
  const folder = createFolder(DM);
  folder.live(events);
  let worst = 0;
  for (const seq of [1999, 1000, 251, 250, 1750, 37]) {
    const t0 = performance.now();
    const p = folder.through(events, seq);
    worst = Math.max(worst, performance.now() - t0);
    assert.equal(p.throughSeq, seq);
  }
  assert.ok(worst < 100, `worst pin ${worst.toFixed(1)} ms`);
  // sanity: the fold is the same as a plain fold
  const plain = events.slice(0, 250).reduce(applyEvent, emptyProjections(DM));
  assert.deepEqual(strip(folder.through(events, 250)), strip(plain));
});
