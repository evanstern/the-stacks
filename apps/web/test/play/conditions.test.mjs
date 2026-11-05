import assert from "node:assert/strict";
import { test } from "node:test";
import { conditionText } from "../../app/play/conditions.ts";

test("none and a joined list", () => {
  assert.equal(conditionText([]), "none");
  assert.equal(conditionText(undefined), "none");
  assert.equal(
    conditionText([{ condition: "prone" }, { condition: "poisoned" }]),
    "prone, poisoned",
  );
});
