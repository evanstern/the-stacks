/**
 * DM-craft doctrine adapted from tabletop-dm (https://github.com/bradbushSFAI/tabletop-dm, commit fe2c29b), Copyright (c) 2026 Brad Bush, used under the MIT License. See apps/server/src/dm/doctrine/NOTICE.md.
 */
import { estimateTokens } from "@the-stacks/srd";
import { DOCTRINE } from "../../dm/doctrine/doctrine.js";
import type { SceneSeed } from "../../dm/seed/schema.js";
import type { Segment } from "./segments.js";

/**
 * The auditor prompt (specs/032-playtest-harness contracts/auditor.md "The
 * auditor call"). The attribution above is carried for the doctrine pairs this
 * module renders; it is never sent to the model.
 */

export const AUDITOR_PROMPT_VERSION = "playtest.audit-v1";

export const SYSTEM_TEXT =
  "You audit a tabletop game transcript. The ledger rows and state changes are true. The narration and the companions' talk are on trial. Report only problems you can tie to cited row numbers. Answer with JSON only.";

const OUTPUT_FORMAT =
  'Answer with one JSON object: {"verdict":"pass"|"fail","findings":[{"kind":"ledger-contradiction"|"invented-mechanics"|"hidden-info-leak"|"player-agency"|"doctrine"|"other","doctrineId":<a doctrine id or null>,"seqs":[<row numbers from the rows below>],"detail":"<one sentence>"}]}. A fail verdict needs at least one finding. A pass verdict has no findings.';

/** Row-line token cap (contracts/auditor.md). */
export const ROW_TOKEN_CAP = 3000;

export interface AuditorPrompt {
  system: string;
  user: string;
  truncated: boolean;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const clip = (s: string, n: number): string =>
  s.length > n ? `${s.slice(0, n)}...` : s;

function rowSummary(row: Segment["rows"][number], seg: Segment): string {
  const p = (row.payload ?? {}) as Record<string, unknown>;
  switch (row.type) {
    case "narration":
    case "talk":
    case "action.declared":
      return clip(str(p.text).replace(/\s*\n\s*/g, " / "), 600);
    case "journal.entry.added":
      return clip(`${str(p.title)}: ${str(p.body)}`, 300);
    case "tracker.changed": {
      const a = p.after as {
        name?: string;
        filled?: number;
        segments?: number;
      };
      return a
        ? `${a.name} ${a.filled}/${a.segments}`
        : `tracker ${str(p.trackerId)}`;
    }
  }
  const l = seg.ledger.find((x) => x.seq === row.seq);
  if (l) {
    if (l.kind === "roll") {
      return clip(`${l.reason}: ${l.roll.expression} -> ${l.roll.total}`, 240);
    }
    if (l.kind === "outcome") {
      const o = l.outcome as { type: string; outcome?: string };
      return clip(`${o.type} ${o.outcome ?? ""} (${l.reason})`.trim(), 240);
    }
    return clip(`${l.type}: ${l.reason}`, 240);
  }
  return row.type;
}

export function buildAuditorPrompt(
  seg: Segment,
  seed: SceneSeed | null,
): AuditorPrompt {
  const doctrine = DOCTRINE.map(
    (d) => `${d.id}: ${d.rule} / Wrong: ${d.wrong} / Right: ${d.right}`,
  ).join("\n");

  const hidden: string[] = [];
  if (seed) {
    for (const s of seed.location.hooks.secrets) hidden.push(`[dm-only] ${s}`);
    for (const n of seed.npcs) {
      for (const s of n.hooks.secrets) hidden.push(`[dm-only] ${n.name}: ${s}`);
    }
  }
  for (const r of seg.rows) {
    if (r.type === "tracker.changed" && r.visibility !== "public") {
      hidden.push(`[dm-only] #${r.seq} ${rowSummary(r, seg)}`);
    }
  }
  const hiddenBlock =
    hidden.length > 0
      ? `${hidden.join("\n")}\nNo public text may reveal these.`
      : "(none)\nNo public text may reveal DM-only information.";

  // Rows: truncate oldest first; never cut the narration or ledger rows.
  const ledgerSeqs = new Set(seg.ledger.map((l) => l.seq));
  const line = (r: Segment["rows"][number]) =>
    `#${r.seq} ${r.type} ${r.actor} ${r.visibility}: ${rowSummary(r, seg)}`;
  let kept = [...seg.rows];
  let truncated = false;
  const total = () => kept.reduce((n, r) => n + estimateTokens(line(r)) + 1, 0);
  while (total() > ROW_TOKEN_CAP) {
    const drop = kept.find(
      (r) => r.seq !== seg.narrationSeq && !ledgerSeqs.has(r.seq),
    );
    if (!drop) break;
    kept = kept.filter((r) => r !== drop);
    truncated = true;
  }

  const onTrial: string[] = [];
  for (const r of seg.rows) {
    const text = str((r.payload as { text?: unknown } | null)?.text);
    if (r.type === "narration" && r.seq === seg.narrationSeq) {
      onTrial.push(`Narration #${r.seq}:\n${text}`);
    } else if (r.type === "talk" && r.actor.startsWith("ai:companion:")) {
      onTrial.push(`Talk #${r.seq} (${r.actor}): ${text}`);
    }
  }

  const user = [
    "## Doctrine",
    doctrine,
    "## Hidden information",
    hiddenBlock,
    "## Rows",
    kept.map(line).join("\n"),
    "## On trial",
    onTrial.length > 0 ? onTrial.join("\n\n") : "(nothing)",
    "## Answer",
    OUTPUT_FORMAT,
  ].join("\n\n");
  return { system: SYSTEM_TEXT, user, truncated };
}
