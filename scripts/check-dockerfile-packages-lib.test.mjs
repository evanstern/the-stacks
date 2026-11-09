// Guard for TASK-0303: the real Dockerfile must copy every workspace package
// apps/server depends on, and the check must fail when one is dropped.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  missingCopies,
  serverClosure,
  workspacePackages,
} from "./check-dockerfile-packages.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dockerfile = readFileSync(join(root, "Dockerfile"), "utf8");

test("the real Dockerfile covers every package apps/server depends on", () => {
  assert.deepEqual(missingCopies(dockerfile, root), []);
});

test("the server closure includes packages/space via dnd5e-engine", () => {
  const names = serverClosure(workspacePackages(root)).map((p) => p.name);
  assert.ok(names.includes("@the-stacks/space"));
  assert.ok(names.includes("@the-stacks/dnd5e-engine"));
});

test("fails when the space dist COPY is removed", () => {
  const broken = dockerfile
    .split("\n")
    .filter((line) => !line.includes("/packages/space/dist"))
    .join("\n");
  const problems = missingCopies(broken, root);
  assert.ok(
    problems.some((p) => p.startsWith("@the-stacks/space:")),
    problems.join("; "),
  );
});

test("fails when the space package.json COPY is removed from the runtime stage only", () => {
  const i = dockerfile.indexOf("FROM base AS runtime");
  const broken =
    dockerfile.slice(0, i) +
    dockerfile
      .slice(i)
      .replace(
        "COPY packages/space/package.json packages/space/package.json\n",
        "",
      );
  const problems = missingCopies(broken, root);
  assert.ok(
    problems.some((p) =>
      p.includes("missing runtime COPY packages/space/package.json"),
    ),
  );
});
