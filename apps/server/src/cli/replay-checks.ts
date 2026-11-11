/**
 * C-AUD replay (spec 103 plan "C-AUD replay"): runs the new narration check over the shipped
 * narration of an exported session. Reads one file; opens no database and makes no model call.
 * Usage: node dist/cli/replay-checks.js <export.json> [--json] [--seed-dir <dir>]
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { project, type StoredEvent } from "@the-stacks/session-model";
import { type CheckIssue, checkNarration } from "../dm/narration-check.js";
import { DEFAULT_SEED_DIR, loadSeed } from "../dm/seed/load.js";
import { dmOnlySeedText } from "../dm/seed/views.js";
import { buildSnapshot } from "../dm/snapshot/index.js";

interface Job {
  id: string;
  kind: string;
  input?: { seedId?: string };
  result?: {
    audit?: {
      final?: string;
      attempts?: { llm?: { issues?: { kind: string }[] } | null }[];
    };
    checkpoint?: { narration?: { seqs?: number[] } };
  };
}
export interface Export {
  sessionId: string;
  events: Omit<StoredEvent, "sessionId">[];
  jobs: Job[];
  calls: { purpose: string }[];
}

const GROUPS = [
  "passed",
  "passed-after-regenerate",
  "fallback",
  "no audit record",
] as const;

/**
 * B2-era ship format (087ecb7f `composeText`): `prose` then a blank line then the dice lines,
 * and the old audit rejected digits in prose. So the rows start at the first line holding a digit.
 */
export function splitShipped(text: string): { prose: string; rows: string[] } {
  const lines = text.split("\n");
  const at = lines.findIndex((l) => /[0-9]/.test(l));
  if (at < 0) return { prose: text, rows: [] };
  return {
    prose: lines.slice(0, at).join("\n").trim(),
    rows: lines.slice(at).filter((l) => l.trim() !== ""),
  };
}

export function replay(data: Export, seedDir = DEFAULT_SEED_DIR) {
  const events = data.events.map((e) => ({
    ...e,
    sessionId: data.sessionId,
  })) as StoredEvent[];
  const turns = data.jobs.filter((j) => j.kind === "turn");
  const seedId = turns.find((j) => j.input?.seedId)?.input?.seedId;
  const seed = seedId ? loadSeed(seedId, seedDir) : null;
  const dmOnlyText = seed
    ? dmOnlySeedText(seed).map((t) => t.toLowerCase())
    : [];
  const perTurn: {
    seq: number;
    jobId: string | null;
    old: string;
    oldKinds: string[];
    hits: { check: string; kind: string; matched: string }[];
  }[] = [];
  for (const ev of events.filter((e) => e.type === "narration")) {
    const job = data.jobs.find((j) =>
      j.result?.checkpoint?.narration?.seqs?.includes(ev.seq),
    );
    const old = job?.result?.audit?.final ?? "no audit record";
    const oldKinds = [
      ...new Set(
        (job?.result?.audit?.attempts ?? []).flatMap((a) =>
          (a.llm?.issues ?? []).map((i) => i.kind),
        ),
      ),
    ];
    let hits: CheckIssue[] = [];
    if (old !== "fallback") {
      const { text } = ev.payload as { text: string };
      const { prose, rows } = splitShipped(text);
      const snapshot = buildSnapshot(
        project(
          events.filter((e) => e.seq < ev.seq),
          { role: "dm" },
        ),
        seed,
      );
      hits = checkNarration({
        slots: { restate: "", describe: prose, ask: "" },
        rows,
        hasRoll: rows.length > 0,
        snapshot,
        dmOnlyText,
        unmetSuccess: [],
      });
    }
    perTurn.push({
      seq: ev.seq,
      jobId: job?.id ?? null,
      old,
      oldKinds,
      hits: hits.map((h) => ({
        check: h.check,
        kind: h.kind,
        matched: h.matched,
      })),
    });
  }
  const groups = GROUPS.map((g) => {
    const t = perTurn.filter((p) =>
      (GROUPS as readonly string[]).includes(p.old)
        ? p.old === g
        : g === "no audit record",
    );
    const count = (c: string) =>
      t.filter((p) => p.hits.some((h) => h.check === c)).length;
    return {
      old: g,
      turns: t.length,
      clean:
        g === "fallback" ? null : t.filter((p) => p.hits.length === 0).length,
      leak: count("leak"),
      contradiction: count("contradiction"),
    };
  });
  const tally = (c: string) => {
    const m: Record<string, number> = {};
    for (const p of perTurn)
      for (const h of p.hits)
        if (h.check === c) m[h.kind] = (m[h.kind] ?? 0) + 1;
    return m;
  };
  const calls = (p: string) => data.calls.filter((c) => c.purpose === p).length;
  return {
    turns: perTurn.length,
    auditCalls: calls("dm.audit"),
    narrateCalls: calls("dm.narrate"),
    groups,
    leakKinds: tally("leak"),
    contradictionKinds: tally("contradiction"),
    perTurn,
  };
}

export function format(r: ReturnType<typeof replay>): string {
  const pad = (s: unknown, n: number) => String(s ?? "-").padEnd(n);
  const kinds = (m: Record<string, number>) =>
    Object.entries(m)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ") || "none";
  return [
    `turns narrated: ${r.turns}   dm.audit calls: ${r.auditCalls}   dm.narrate calls: ${r.narrateCalls}`,
    `${pad("old ruling", 24)}| ${pad("turns", 6)}| ${pad("new clean", 10)}| ${pad("leak hits", 10)}| contradiction hits`,
    ...r.groups.map(
      (g) =>
        `${pad(g.old, 24)}| ${pad(g.turns, 6)}| ${pad(g.clean, 10)}| ${pad(g.leak, 10)}| ${g.contradiction}${g.old === "fallback" ? "   (fallback text is code text; reported, not judged)" : ""}`,
    ),
    `leak hits by kind: ${kinds(r.leakKinds)}    contradiction hits by kind: ${kinds(r.contradictionKinds)}`,
    "per-turn rows: seq | job id | old final | old issue kinds | new hits (matched text)",
    ...r.perTurn.map(
      (p) =>
        `${p.seq} | ${p.jobId ?? "-"} | ${p.old} | ${p.oldKinds.join(",") || "-"} | ${p.hits.map((h) => `${h.kind}: "${h.matched}"`).join("; ") || "-"}`,
    ),
  ].join("\n");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const args = process.argv.slice(2);
  const sd = args.indexOf("--seed-dir");
  const seedDir = sd >= 0 ? args.splice(sd, 2)[1] : undefined;
  const json = args.includes("--json");
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error(
      "usage: replay-checks <export.json> [--json] [--seed-dir <dir>]",
    );
    process.exit(2);
  }
  const r = replay(JSON.parse(readFileSync(file, "utf8")) as Export, seedDir);
  console.log(json ? JSON.stringify(r, null, 2) : format(r));
}
