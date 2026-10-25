// The no-modals rule, rescoped for shadcn Sheet (plan D7, SC-007). Sheet is
// built on the Radix Dialog primitive, so a plain `grep -i dialog` would
// false-positive on sheet.tsx. These three checks encode the real rule:
// no `<dialog>` element, no `showModal`, no `AlertDialog` component, and
// the word "Dialog" appears nowhere except the one file that wraps it.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { test } from "node:test";

const UI_DIR = "app/components/ui";
const APP_DIR = "app";

function grep(pattern, flags) {
  try {
    return execFileSync("grep", [flags, pattern, APP_DIR], {
      encoding: "utf8",
    });
  } catch (err) {
    if (err.status === 1) return ""; // grep: no matches
    throw err;
  }
}

test("no dialog.tsx or alert-dialog.tsx under components/ui", () => {
  const files = readdirSync(UI_DIR);
  assert.ok(!files.includes("dialog.tsx"));
  assert.ok(!files.includes("alert-dialog.tsx"));
});

test("zero <dialog, showModal, or AlertDialog uses in apps/web/app", () => {
  const hits = grep("<dialog|showModal|AlertDialog", "-rnE");
  assert.equal(hits, "", `unexpected hits:\n${hits}`);
});

test("the word Dialog appears only in components/ui/sheet.tsx", () => {
  const out = grep("Dialog", "-rlwE");
  const files = out.trim().split("\n").filter(Boolean).sort();
  assert.deepEqual(files, ["app/components/ui/sheet.tsx"]);
});
