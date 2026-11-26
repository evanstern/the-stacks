// CI gate (spec 122): fail when a PR touches paths outside its spec's declared scope.
// Usage: node scripts/check-spec-scope.mjs [baseRef=origin/main]
// Exit 0 pass or warn (scope not derivable), 1 out-of-scope paths.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { evaluate } from "./check-spec-scope-lib.mjs";

const base = process.argv[2] ?? "origin/main";
const files = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], { encoding: "utf8" })
  .split("\n").filter(Boolean);
const r = evaluate({ files, readSpec: (d) => readFileSync(`${d}/spec.md`, "utf8") });
if (r.status === "fail") {
  for (const f of r.offenders) console.error(`::error file=${f}::outside declared spec scope`);
  console.error(`spec-scope: FAIL — ${r.message}. Fix: add the path to the spec's Scope-Paths line, or split the PR.`);
  process.exit(1);
}
console.log(`${r.status === "warn" ? "::warning::" : ""}spec-scope: ${r.status.toUpperCase()} — ${r.message}`);
