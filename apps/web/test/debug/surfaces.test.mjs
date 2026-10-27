// Structural gates for the debug page (FR-047, FR-048): no modal, no storage, read-only.
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

test("no localStorage, sessionStorage or fixed inset-0 under app/debug", () => {
  const hits = grep([
    "-rnE",
    "localStorage|sessionStorage|indexedDB|fixed inset-0",
    "app/debug",
  ]);
  assert.equal(hits, "", `unexpected hits:\n${hits}`);
});

test("the only debug request paths are the four reads and POST turn", () => {
  const src = readFileSync("app/debug/client.ts", "utf8");
  const paths = [...src.matchAll(/call<[^>]*>\(\s*[`"](\/[a-z]+)/g)]
    .map((m) => m[1])
    .sort();
  assert.deepEqual(paths, ["/calls", "/events", "/jobs", "/seed", "/turn"]);
  const posts = [...src.matchAll(/"POST"/g)];
  // one literal in the call signature type, one in the retry call
  assert.equal(posts.length, 2);
  assert.match(src, /retry: \(\) => call<[^>]*>\("\/turn", "POST"\)/);
});

test("only use-debug-session.ts touches the network", () => {
  const files = grep([
    "-rlE",
    "fetch\\(|XMLHttpRequest|sendBeacon|EventSource|WebSocket",
    "app/debug",
  ])
    .trim()
    .split("\n")
    .filter(Boolean)
    .sort();
  assert.deepEqual(files, ["app/debug/use-debug-session.ts"]);
});

test("only components/panel.tsx imports components/ui/sheet", () => {
  const files = grep(["-rlE", "components/ui/sheet", "app"])
    .trim()
    .split("\n")
    .filter(Boolean)
    .sort();
  assert.deepEqual(files, ["app/components/panel.tsx"]);
});
