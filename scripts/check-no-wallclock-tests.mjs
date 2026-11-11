// Guard for TASK-0308: a regular *.test.ts must not assert on performance.now().
// Wall-clock budgets belong in *.bench-test.ts, run serially by pnpm check:timing.
// Heuristic: a file that mentions performance.now() and toBeLessThan( is an offender.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === "dist") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".test.ts") && !e.name.endsWith(".bench-test.ts"))
      out.push(p);
  }
  return out;
}

export function offendersIn(files) {
  return files.filter((f) => {
    if (f.endsWith(".bench-test.ts")) return false;
    const src = readFileSync(f, "utf8");
    return src.includes("performance.now()") && src.includes("toBeLessThan(");
  });
}

export function findOffenders(base = root) {
  const files = ["packages", "apps"].flatMap((d) => walk(join(base, d)));
  return offendersIn(files).map((f) => relative(base, f));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const bad = findOffenders();
  if (bad.length) {
    console.error(
      `wall-clock assertions in regular tests (move to *.bench-test.ts):\n${bad.join("\n")}`,
    );
    process.exit(1);
  }
  console.log("no wall-clock assertions in regular tests");
}
