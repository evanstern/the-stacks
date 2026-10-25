import assert from "node:assert/strict";
import { test } from "node:test";
import { readUiPrefs, uiCookie } from "../app/ui-prefs.ts";

test("readUiPrefs: no cookie header falls back to expanded/system", () => {
  assert.deepEqual(readUiPrefs(null), { sidebar: "expanded", theme: "system" });
});

test("readUiPrefs: garbage values fall back to expanded/system", () => {
  assert.deepEqual(readUiPrefs("stacks-sidebar=nope; stacks-theme=purple"), {
    sidebar: "expanded",
    theme: "system",
  });
});

test("readUiPrefs: valid cookies are read", () => {
  assert.deepEqual(readUiPrefs("stacks-sidebar=collapsed; stacks-theme=dark"), {
    sidebar: "collapsed",
    theme: "dark",
  });
  assert.deepEqual(readUiPrefs("stacks-theme=light"), {
    sidebar: "expanded",
    theme: "light",
  });
});

test("readUiPrefs: reads one cookie among several, in any order", () => {
  assert.deepEqual(
    readUiPrefs("other=1; stacks-theme=dark; stacks-sidebar=collapsed"),
    { sidebar: "collapsed", theme: "dark" },
  );
});

test("uiCookie: serializes name, value, and the fixed attributes", () => {
  assert.equal(
    uiCookie("stacks-theme", "dark"),
    "stacks-theme=dark; Path=/; Max-Age=31536000; SameSite=Lax",
  );
  assert.equal(
    uiCookie("stacks-sidebar", "collapsed"),
    "stacks-sidebar=collapsed; Path=/; Max-Age=31536000; SameSite=Lax",
  );
});
