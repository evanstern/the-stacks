#!/usr/bin/env node
// Freshness report: intended commit vs deployed commit, merged PRs and Done cards since the last run.
//   node freshness.mjs [--health <url>] [--deployed <sha>] [--since <YYYY-MM-DD>]
// --health fetches <url>/health (hosted dev, or http://localhost:<port> locally).
// ponytail: reads Done cards by their frontmatter updated_date; a card edited after Done reads as newer.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values: v } = parseArgs({
  options: { health: { type: "string" }, deployed: { type: "string" }, since: { type: "string" } },
});
const sh = (cmd, args) => {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (e) {
    return `(failed: ${cmd} ${args[0]}: ${String(e.stderr ?? e.message).split("\n")[0]})`;
  }
};

sh("git", ["fetch", "origin", "main", "--quiet"]);
const intended = sh("git", ["rev-parse", "origin/main"]);
let deployed = v.deployed ?? null;
if (!deployed && v.health) {
  try {
    const body = await (await fetch(`${v.health.replace(/\/$/, "")}/health`)).json();
    deployed = body.commit;
    console.log(`health: status=${body.status} commit=${body.commit}`);
  } catch (e) {
    console.log(`health: unreachable (${e.message})`);
  }
}
console.log(`intended (origin/main): ${intended}`);
console.log(`deployed:               ${deployed ?? "unknown"}`);
if (deployed && !intended.startsWith("(")) {
  const behind = Number(sh("git", ["rev-list", "--count", `${deployed}..${intended}`]));
  const ahead = Number(sh("git", ["rev-list", "--count", `${intended}..${deployed}`]));
  console.log(
    behind === 0 && ahead === 0 ? "VERDICT: current"
      : behind > 0 && ahead === 0 ? `VERDICT: STALE, deployed is ${behind} commits behind origin/main. Propose a deploy; wait for the operator's go.`
      : Number.isNaN(behind) ? "VERDICT: deployed commit unknown to this clone; fetch or check by hand"
      : `VERDICT: deployed has ${ahead} commits not on origin/main (a branch build, e.g. a local stack)${behind ? ` and lacks ${behind} from origin/main` : ""}`,
  );
}

const since = v.since;
console.log(`\nMerged PRs since ${since ?? "(all recent)"}:`);
console.log(
  sh("gh", ["pr", "list", "--state", "merged", "--limit", "40", ...(since ? ["--search", `merged:>=${since}`] : []),
    "--json", "number,title,mergedAt", "--jq", '.[] | "#\\(.number) \\(.mergedAt[:10]) \\(.title)"']) || "(none)",
);

console.log(`\nDone cards since ${since ?? "(all)"}:`);
const dir = "backlog/tasks";
const rows = [];
for (const f of readdirSync(dir)) {
  const t = readFileSync(`${dir}/${f}`, "utf8").slice(0, 1200);
  if (!/^status: Done$/m.test(t)) continue;
  const id = /^id: (\S+)/m.exec(t)?.[1];
  const upd = /^updated_date: '?(\d{4}-\d{2}-\d{2})/m.exec(t)?.[1] ?? "";
  const title = (/^title: >?-?\s*\n?\s*(.+)$/m.exec(t)?.[1] ?? f).replace(/^['"]|['"]$/g, "");
  if (!since || upd >= since) rows.push(`${id} ${upd} ${title}`);
}
console.log(rows.sort().join("\n") || "(none)");
