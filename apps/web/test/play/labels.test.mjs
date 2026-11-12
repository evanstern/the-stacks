import assert from "node:assert/strict";
import { test } from "node:test";
import { kindLabel, refusalLabel } from "../../app/play/labels.ts";

test("refusal labels word the four 066 codes", () => {
  for (const code of [
    "SUGGESTION_STALE",
    "SUGGESTION_NOT_FOUND",
    "INTENT_EXISTS",
    "NOT_YOUR_TURN",
  ]) {
    assert.ok(refusalLabel(code), code);
  }
});

test("kindLabel words known kinds and falls back to the kind id", () => {
  assert.equal(kindLabel("attempt"), "Action");
  assert.equal(kindLabel("hide"), "Hide");
  assert.equal(kindLabel("rest_long"), "rest_long");
});
