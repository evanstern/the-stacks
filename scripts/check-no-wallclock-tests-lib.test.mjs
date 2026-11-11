// Guard for TASK-0308: the wall-clock heuristic flags regular tests and passes bench tests.
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { findOffenders, offendersIn } from "./check-no-wallclock-tests.mjs";

const dir = mkdtempSync(join(tmpdir(), "wallclock-"));
const put = (name, src) => {
  const p = join(dir, name);
  writeFileSync(p, src);
  return p;
};
const timed =
  "const t=performance.now(); expect(performance.now()-t).toBeLessThan(1);";

test("a regular test that asserts on performance.now() is an offender", () => {
  const f = put("a.test.ts", timed);
  assert.deepEqual(offendersIn([f]), [f]);
});

test("a bench test with the same assertion is not an offender", () => {
  const f = put("a.bench-test.ts", timed);
  assert.deepEqual(offendersIn([f]), []);
});

test("a regular test without a wall-clock assertion passes", () => {
  const f = put("b.test.ts", "expect(1).toBe(1);");
  assert.deepEqual(offendersIn([f]), []);
});

test("the real repo has no wall-clock assertions in regular tests", () => {
  assert.deepEqual(findOffenders(), []);
});
