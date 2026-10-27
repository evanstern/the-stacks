import assert from "node:assert/strict";
import { test } from "node:test";
import {
  distinctValues,
  emptyFilter,
  filterEvents,
  windowRows,
} from "../../app/debug/event-filter.ts";

const ev = (seq, type, actor, visibility) => ({ seq, type, actor, visibility });
const events = [
  ev(1, "talk", "u1", "all"),
  ev(2, "narration", "ai:dm", "all"),
  ev(3, "tracker.changed", "ai:dm", "dm"),
  ev(4, "talk", "u2", "all"),
];
const seqs = (rows) => rows.map((e) => e.seq);

test("empty filter passes all", () => {
  assert.deepEqual(seqs(filterEvents(events, emptyFilter)), [1, 2, 3, 4]);
});

test("OR within a list, AND across lists", () => {
  assert.deepEqual(
    seqs(
      filterEvents(events, { ...emptyFilter, types: ["talk", "narration"] }),
    ),
    [1, 2, 4],
  );
  assert.deepEqual(
    seqs(
      filterEvents(events, {
        types: ["talk", "narration"],
        actors: ["ai:dm"],
        visibilities: [],
      }),
    ),
    [2],
  );
  assert.deepEqual(
    seqs(filterEvents(events, { ...emptyFilter, visibilities: ["dm"] })),
    [3],
  );
});

test("distinctValues is sorted and unique", () => {
  assert.deepEqual(distinctValues(events), {
    types: ["narration", "talk", "tracker.changed"],
    actors: ["ai:dm", "u1", "u2"],
    visibilities: ["all", "dm"],
  });
});

test("windowRows returns the last N", () => {
  const rows = Array.from({ length: 700 }, (_, i) => i);
  const w = windowRows(rows, 500);
  assert.equal(w.length, 500);
  assert.equal(w[0], 200);
  assert.equal(w.at(-1), 699);
  assert.deepEqual(windowRows([1, 2], 500), [1, 2]);
});
