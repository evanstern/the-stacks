// Structural gates for the play route (SC-007, AC #7): no modal, client-only, one shared view.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function grep(args) {
  try {
    return execFileSync("grep", args, { encoding: "utf8" });
  } catch (err) {
    if (err.status === 1) return "";
    throw err;
  }
}

test("only components/panel.tsx imports components/ui/sheet", () => {
  const files = grep(["-rlE", "components/ui/sheet", "app"])
    .trim()
    .split("\n")
    .filter(Boolean)
    .sort();
  assert.deepEqual(files, ["app/components/panel.tsx"]);
});

test("no fixed inset-0, localStorage or sessionStorage under app/play", () => {
  const hits = grep([
    "-rnE",
    "fixed inset-0|localStorage|sessionStorage",
    "app/play",
  ]);
  assert.equal(hits, "", `unexpected hits:\n${hits}`);
});

const ROUTES = ["play", "play-fixtures", "play-fixture"];

for (const name of ROUTES) {
  test(`routes/${name}.tsx is client-only`, () => {
    const src = readFileSync(`app/routes/${name}.tsx`, "utf8");
    assert.match(src, /export (async )?function clientLoader/);
    assert.match(src, /export function HydrateFallback/);
    assert.doesNotMatch(src, /export (async )?function loader\b/);
    assert.doesNotMatch(src, /export const loader\b/);
  });
}

for (const name of ["play", "play-fixture"]) {
  test(`routes/${name}.tsx renders TableView and imports no play component`, () => {
    const src = readFileSync(`app/routes/${name}.tsx`, "utf8");
    assert.match(src, /<TableView /);
    const imports = [...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    const components = imports.filter((i) => i.includes("play/components/"));
    const allowed = name === "play-fixture" ? ["fixture-toolbar"] : [];
    for (const imp of components) {
      assert.ok(
        allowed.some((a) => imp.includes(a)),
        `${name} imports ${imp}`,
      );
    }
  });
}
