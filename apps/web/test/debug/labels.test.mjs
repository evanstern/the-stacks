import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ageText,
  costText,
  nodeName,
  TURN_NODES,
} from "../../app/debug/labels.ts";

test("node names", () => {
  assert.deepEqual(
    [...TURN_NODES],
    [
      "assemble",
      "director",
      "interpret",
      "adjudicate",
      "resolve",
      "narrate-check",
      "failure",
    ],
  );
  assert.equal(nodeName("director"), "Director");
  assert.equal(nodeName("narrate-check"), "Narrate and check");
  assert.equal(nodeName("mystery"), "mystery");
});

test("ageText", () => {
  assert.equal(ageText(4000), "4 s");
  assert.equal(ageText(0), "0 s");
  assert.equal(ageText(-5), "0 s");
  assert.equal(ageText(125_000), "2 m 05 s");
  assert.equal(ageText(3_720_000), "1 h 02 m");
});

test("costText", () => {
  assert.equal(costText(null), "unpriced");
  assert.equal(costText(0.0123), "$0.0123");
  assert.equal(costText(0), "$0.0000");
});
