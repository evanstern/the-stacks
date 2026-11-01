#!/usr/bin/env node
// Search the board for a card that covers a finding, before any card is created.
//   node triage.mjs "<keywords>" [--title "<new card title>"] [--refs "<log path>"]
// Prints candidates from `backlog search`. With --title, also prints the `backlog task create`
// command that WOULD run if no candidate covers the finding. It never creates a card.
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";

const { values: v, positionals } = parseArgs({
  allowPositionals: true,
  options: { title: { type: "string" }, refs: { type: "string" } },
});
const q = positionals.join(" ");
if (!q) { console.error('usage: triage.mjs "<keywords>" [--title T] [--refs PATH]'); process.exit(64); }
const out = execFileSync("backlog", ["search", q, "--type", "task", "--plain", "--limit", "8"], { encoding: "utf8" });
console.log(`Candidates for "${q}":\n${out.trim() || "(none)"}\n`);
console.log("Decide: append evidence to a match (`backlog task edit TASK-n --append-notes ...`), or create.");
if (v.title) {
  const q2 = (s) => `'${s.replace(/'/g, `'\\''`)}'`;
  console.log(`Would run: backlog task create ${q2(v.title)} -l playtest --ref ${q2(v.refs ?? "docs/playtests/<log>.md")} --priority medium -d ${q2(`Found in a playtest. Evidence: ${v.refs ?? "<log>"}.`)}`);
}
