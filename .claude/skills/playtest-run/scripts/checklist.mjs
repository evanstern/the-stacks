#!/usr/bin/env node
// Checklist tracked in the run log as a markdown table with stable ids.
//   derive --prev <log> [--cards TASK-1,TASK-2] [--under-test TASK-3:1,2]   print the table
//   set <log> <id> <status> [note]                                        edit one row in place
//   summary <log>                                                         count rows per status
// Statuses: pending, pass, fail, blocked, not reached. Rows with the "pending", "blocked" or
// "not reached" status in --prev roll forward under the same id. Ids never change.
import { readFileSync, writeFileSync } from "node:fs";

const STATUS = ["pending", "pass", "fail", "blocked", "not reached"];
const BASE = [
  ["base-signoff", "Group sign-off"],
  ["base-floor", "Floor passing and absence (30 s, 120 s)"],
  ["base-companion", "Companion reacts"],
  ["base-combat", "Combat: initiative, a downed hero, ending the encounter"],
  ["base-dmquality", "DM quality spot checks"],
  ["base-debug-retry", "Debug page and Retry"],
];
const ROW = /^\|\s*([\w.#-]+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(pending|pass|fail|blocked|not reached)\s*\|\s*(.*?)\s*\|$/;

const parse = (text) => text.split("\n").map((l) => ROW.exec(l)).filter(Boolean)
  .map(([, id, item, source, status, note]) => ({ id, item, source, status, note }));
const table = (rows) =>
  ["| id | item | source | status | note |", "|----|------|--------|--------|------|",
    ...rows.map((r) => `| ${r.id} | ${r.item} | ${r.source} | ${r.status} | ${r.note} |`)].join("\n");

const [cmd, ...rest] = process.argv.slice(2);
const flag = (n) => { const i = rest.indexOf(`--${n}`); return i < 0 ? undefined : rest[i + 1]; };

if (cmd === "derive") {
  const rows = new Map();
  const add = (r) => rows.has(r.id) || rows.set(r.id, { note: "", ...r });
  const prev = flag("prev") ? parse(readFileSync(flag("prev"), "utf8")) : [];
  for (const p of prev) {
    if (p.status === "pass" || p.status === "fail") continue; // settled last run
    add({ ...p, status: p.status === "blocked" ? "pending" : "not reached", note: `rolled forward (was ${p.status})` });
  }
  const [uid, acs] = (flag("under-test") ?? "").split(":");
  if (uid) for (const n of (acs ?? "").split(",").filter(Boolean))
    add({ id: `${uid}-AC${n}`, item: `${uid} acceptance criterion #${n}`, source: "card under test", status: "pending" });
  for (const c of (flag("cards") ?? "").split(",").filter(Boolean))
    add({ id: c, item: `Verify what ${c} changed`, source: "merged since last run", status: "pending" });
  if (!prev.length) for (const [id, item] of BASE) add({ id, item, source: "baseline", status: "pending" });
  console.log(table([...rows.values()]));
} else if (cmd === "set") {
  const [log, id, status, ...note] = rest;
  if (!STATUS.includes(status)) { console.error(`status must be one of: ${STATUS.join(", ")}`); process.exit(2); }
  const lines = readFileSync(log, "utf8").split("\n");
  let hit = false;
  const out = lines.map((l) => {
    const m = ROW.exec(l);
    if (!m || m[1] !== id) return l;
    hit = true;
    return `| ${m[1]} | ${m[2]} | ${m[3]} | ${status} | ${note.join(" ") || m[5]} |`;
  });
  if (!hit) { console.error(`no checklist row with id ${id}`); process.exit(1); }
  writeFileSync(log, out.join("\n"));
} else if (cmd === "summary") {
  const rows = parse(readFileSync(rest[0], "utf8"));
  for (const s of STATUS) console.log(`${s}: ${rows.filter((r) => r.status === s).length}`);
} else {
  console.error("usage: checklist.mjs derive|set|summary (see header)");
  process.exit(64);
}
