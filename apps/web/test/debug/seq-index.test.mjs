import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSeqIndex } from "../../app/debug/seq-index.ts";

const view = (id, createdAt, seqs) => ({
  id,
  createdAt,
  wroteSeqs: new Set(seqs),
});

test("seq maps to its job; unknown seq maps to null", () => {
  const idx = buildSeqIndex([
    view("a", "2026-10-27T10:00:00Z", [1, 2]),
    view("b", "2026-10-27T11:00:00Z", [5]),
  ]);
  assert.equal(idx.jobFor(2), "a");
  assert.equal(idx.jobFor(5), "b");
  assert.equal(idx.jobFor(3), null);
});

test("a seq claimed twice maps to the newer job, in any input order", () => {
  const older = view("old", "2026-10-27T10:00:00Z", [7]);
  const newer = view("new", "2026-10-27T11:00:00Z", [7]);
  assert.equal(buildSeqIndex([older, newer]).jobFor(7), "new");
  assert.equal(buildSeqIndex([newer, older]).jobFor(7), "new");
});
