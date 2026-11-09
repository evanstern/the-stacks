#!/usr/bin/env node
// Reports new DM turns from the debug routes (specs/037-debug-api/contracts/debug-api.md)
// and totals spend against the ceiling.
//   node watch.mjs --state <file> [--ceiling <usd>] ( --input <json> | --base <url> --creds <file> --session <id> )
// --input is the JSON the browser snippet (references/hosted-fetch.md) printed:
//   { events:[...], jobs:[...], calls:[...], totals:{...}? }
// --creds (local stacks only) is a JSON file OUTSIDE the repo: {"username","password"}.
// The state file keeps the reported job ids, so each call prints only new finished turns.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values: v } = parseArgs({
  options: {
    state: { type: "string" }, ceiling: { type: "string" }, input: { type: "string" },
    base: { type: "string" }, creds: { type: "string" }, session: { type: "string" },
  },
});
if (!v.state) { console.error("--state <file> is required"); process.exit(64); }

async function load() {
  if (v.input) return JSON.parse(readFileSync(v.input, "utf8"));
  if (!(v.base && v.creds && v.session)) { console.error("need --input, or --base --creds --session"); process.exit(64); }
  const cj = JSON.parse(readFileSync(v.creds, "utf8"));
  const { username, password } = cj.operator ?? cj;
  const si = await fetch(`${v.base}/auth/sign-in`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }),
  });
  if (!si.ok) { console.error(`sign-in refused: HTTP ${si.status}`); process.exit(1); }
  const cookie = si.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const get = async (p) => (await fetch(`${v.base}/dm/sessions/${v.session}/${p}`, { headers: { cookie } })).json();
  const events = [];
  for (let after = 0, more = true; more; ) {
    const r = await get(`events?after=${after}&limit=1000`);
    events.push(...r.events); after = r.nextAfter; more = r.hasMore;
  }
  const calls = []; let totals;
  for (let after = 0, more = true; more; ) {
    const r = await get(`calls?after=${after}&limit=1000`);
    calls.push(...r.calls); after = r.nextAfter; more = r.hasMore; totals = r.totals;
  }
  return { events, jobs: (await get("jobs?limit=200")).jobs, calls, totals };
}

const data = await load();
const state = existsSync(v.state) ? JSON.parse(readFileSync(v.state, "utf8")) : { reported: [], warned: 0 };
const events = new Map(data.events.map((e) => [e.seq, e]));
const callsBy = new Map();
for (const c of data.calls) (callsBy.get(c.jobId) ?? callsBy.set(c.jobId, []).get(c.jobId)).push(c);
const secs = (a, b) => (a && b ? ((Date.parse(b) - Date.parse(a)) / 1000).toFixed(1) : "?");
const usd = (n) => `$${n.toFixed(4)}`;

const fresh = [...data.jobs].reverse().filter((j) => ["succeeded", "failed"].includes(j.status) && !state.reported.includes(j.id));
for (const j of fresh) {
  const cs = callsBy.get(j.id) ?? [];
  const cost = cs.reduce((s, c) => s + (c.costUsd ?? 0), 0);
  const bad = cs.filter((c) => c.outcome !== "ok");
  const invalid = cs.filter((c) => c.outcome === "invalid-json").length;
  const truncated = cs.filter((c) => c.outcome === "truncated").length;
  const schema = cs.filter((c) => c.outcome === "schema-mismatch").length;
  const retries = cs.filter((c) => c.callAttempt > 1).length;
  const trig = j.input?.trigger ? ` trigger=${j.input.trigger}` : "";
  console.log(`\n[${j.kind}${trig}] job ${j.id.slice(0, 8)} ${j.status.toUpperCase()} ${secs(j.startedAt, j.finishedAt)}s attempts=${j.attempts}`);
  console.log(`  calls=${cs.length} not-ok=${bad.length} invalid-json=${invalid} truncated=${truncated} schema=${schema} retries=${retries} cost=${usd(cost)}`);
  if (j.error) console.log(`  error: ${j.error}`);
  const f = j.result?.failure; if (f) console.log(`  failure: ${JSON.stringify(f).slice(0, 300)}`);
  const seqs = [...(j.result?.checkpoint?.narration?.seqs ?? []), ...(j.result?.checkpoint?.submissions ?? []).flatMap((s) => s.seqs ?? [])];
  for (const s of [...new Set(seqs)].sort((a, b) => a - b)) {
    const e = events.get(s);
    if (e?.type === "narration") console.log(`  narration #${s}: ${String(e.payload?.text ?? "").slice(0, 240).replace(/\s+/g, " ")}`);
    else if (e) console.log(`  event #${s} ${e.type}`);
  }
  state.reported.push(j.id);
}
if (!fresh.length) console.log("no new finished turns");
const running = data.jobs.filter((j) => ["queued", "running"].includes(j.status));
if (running.length) console.log(`in flight: ${running.map((j) => `${j.kind}:${j.status}${j.stage ? `@${j.stage}` : ""}`).join(", ")}`);

const total = data.totals?.all?.costUsd ?? data.calls.reduce((s, c) => s + (c.costUsd ?? 0), 0);
const unpriced = data.totals?.all?.unpricedCalls ?? data.calls.filter((c) => c.costUsd == null).length;
const ceiling = v.ceiling ? Number(v.ceiling) : null;
let line = `\nSPEND ${usd(total)} over ${data.calls.length} calls (${unpriced} unpriced)`;
if (ceiling) {
  const pct = (total / ceiling) * 100;
  line += ` of ${usd(ceiling)} ceiling = ${pct.toFixed(0)}%`;
  const level = pct >= 100 ? 100 : pct >= 80 ? 80 : pct >= 50 ? 50 : 0;
  console.log(line);
  if (level > state.warned) { console.log(`WARNING: spend crossed ${level}% of the ceiling. Tell the operator now.`); state.warned = level; }
  else if (level) console.log(`(already warned at ${state.warned}%)`);
} else console.log(`${line} (no ceiling recorded: a paid model run must not start without one)`);
// AC #2 (spec 093 OQ-2): an attempt-1 outcome that costs a re-ask counts as a failure.
const a1 = data.calls.filter((c) => c.callAttempt === 1);
const a1Bad = a1.filter((c) => ["invalid-json", "schema-mismatch", "truncated"].includes(c.outcome)).length;
console.log(`attempt-1 failures ${a1Bad}/${a1.length} = ${a1.length ? ((a1Bad / a1.length) * 100).toFixed(1) : "0.0"}%`);
const outMax = {};
for (const c of data.calls) if (c.outputTokens != null) outMax[c.purpose] = Math.max(outMax[c.purpose] ?? 0, c.outputTokens);
console.log(`out-max ${Object.entries(outMax).map(([p, n]) => `${p}=${n}`).join(" ") || "(no token counts)"}`);
writeFileSync(v.state, JSON.stringify(state));
