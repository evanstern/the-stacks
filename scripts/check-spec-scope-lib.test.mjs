import { test } from "node:test";
import assert from "node:assert/strict";
import { declaredScope, evaluate, specDirsTouched } from "./check-spec-scope-lib.mjs";

const spec = "# S\n\n**Scope-Paths**: `scripts/foo.mjs`, .github/workflows/\n\n## Scope\n- In: `other/x.ts`\n";
const run = (files, md = spec) => evaluate({ files, readSpec: () => md });

test("Scope-Paths wins over the Scope section", () => {
  assert.deepEqual(declaredScope(spec).paths, ["scripts/foo.mjs", ".github/workflows/"]);
  assert.equal(declaredScope(spec).source, "Scope-Paths");
});
test("falls back to path-like backticks in Scope", () => {
  const d = declaredScope("## Scope\n- In: `a/b.ts` and `word` and `c/`\n");
  assert.deepEqual(d.paths, ["a/b.ts", "c/"]);
});
test("in-scope PR passes; own spec dir, backlog and wiki always allowed", () => {
  const r = run(["specs/122-x/spec.md", "scripts/foo.mjs", ".github/workflows/g.yml", "backlog/tasks/t.md", "docs/wiki/a.md"]);
  assert.equal(r.status, "pass");
});
test("out-of-scope path fails and is named", () => {
  const r = run(["specs/122-x/spec.md", "apps/web/x.ts"]);
  assert.equal(r.status, "fail");
  assert.deepEqual(r.offenders, ["apps/web/x.ts"]);
});
test("no spec dir, several spec dirs, or no declared scope warn", () => {
  assert.equal(run(["apps/web/x.ts"]).status, "warn");
  assert.equal(run(["specs/001-a/x", "specs/122-a/x"]).status, "warn");
  assert.equal(run(["specs/122-x/spec.md", "apps/web/x.ts"], "# nothing").status, "warn");
});
test("specDirsTouched", () => assert.deepEqual(specDirsTouched(["specs/122-x/a", "specs/122-x/b", "z"]), ["specs/122-x"]));
