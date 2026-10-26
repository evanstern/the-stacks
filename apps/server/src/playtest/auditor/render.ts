import {
  canSee,
  type LedgerRow,
  type StoredEvent,
} from "@the-stacks/session-model";
import {
  collectFacts,
  renderChangeLine,
  renderRollLine,
} from "../../dm/facts.js";
import type { Report } from "./schema.js";

/**
 * Player-view Markdown of a transcript (contracts/run-directory.md
 * `transcript.md`). Rows the human-seat player cannot see are left out. Dice
 * and damage lines come from the DM runtime's own renderers.
 */

const str = (v: unknown): string => (typeof v === "string" ? v : "");

function line(row: StoredEvent): string | null {
  const p = (row.payload ?? {}) as Record<string, unknown>;
  switch (row.type) {
    case "narration":
      return `**Narration** (#${row.seq})\n\n${str(p.text)}`;
    case "talk":
      return `**${row.actor}** (#${row.seq}): ${str(p.text)}`;
    case "action.declared": {
      return `- #${row.seq} ${row.actor} declares \`${str(p.actionId)}\`: ${str(p.text)}`;
    }
    case "action.committed":
      return `- #${row.seq} ${row.actor} commits \`${str(p.actionId)}\``;
    default:
      return null;
  }
}

export function renderTranscript(
  rows: readonly StoredEvent[],
  ledger: readonly LedgerRow[],
  viewerUserId?: string,
): string {
  const viewer = viewerUserId
    ? ({ role: "player", userId: viewerUserId } as const)
    : ({ role: "player", userId: "" } as const);
  const out: string[] = ["# Transcript (player view)", ""];
  for (const row of rows) {
    if (!canSee(viewer, row.visibility)) continue;
    const l = line(row);
    if (l) out.push(l, "");
  }
  const visible = ledger.filter((r) => canSee(viewer, r.visibility));
  const facts = collectFacts(visible, (id) => String(id ?? ""));
  const lines = [
    ...facts.rolls.map(renderRollLine),
    ...facts.changes
      .map(renderChangeLine)
      .filter((l): l is string => l !== null),
  ];
  if (lines.length > 0) {
    out.push("## Dice and changes", "", ...lines.map((l) => `- ${l}`), "");
  }
  return `${out.join("\n")}\n`;
}

const cell = (v: string | number | null): string =>
  String(v ?? "-")
    .replace(/\|/g, "\\|")
    .replace(/\s*\n\s*/g, " ");

/** `report.md` (contracts/audit-report-schema.md "`report.md` layout"). No prompt text, no key. */
export function renderReport(report: Report): string {
  const out: string[] = [];
  out.push(`# Playtest audit \u2014 ${report.runId}`, "");
  out.push(
    `**Verdict: ${report.verdict}**`,
    "",
    `- Session: ${report.sessionId}`,
    `- Seed: ${report.seedId ?? "none"}`,
    `- Commit: ${report.commit}`,
    `- Auditor mode: ${report.auditorMode}`,
    `- Audited at: ${report.auditedAt}`,
    "",
  );

  const c = report.counts;
  out.push(
    "## Counts",
    "",
    "| rows | narrations | segments | rolls | fail | warn | note |",
    "|---|---|---|---|---|---|---|",
    `| ${c.rows} | ${c.narrations} | ${c.segments} | ${c.rolls} | ${c.findings.fail} | ${c.findings.warn} | ${c.findings.note} |`,
    "",
  );

  out.push("## Findings", "");
  if (report.findings.length === 0) {
    out.push("No findings.", "");
  } else {
    out.push(
      "| id | severity | kind | source | segment | rows | doctrine | detail |",
      "|---|---|---|---|---|---|---|---|",
      ...report.findings.map(
        (f) =>
          `| ${f.id} | ${f.severity} | ${f.kind} | ${f.source} | ${cell(f.segment)} | ${cell(f.seqs.join(", ") || null)} | ${cell(f.doctrineId)} | ${cell(f.detail)} |`,
      ),
      "",
    );
  }

  out.push(
    "## Segments",
    "",
    "| index | narration | rows | failing checks | auditor |",
    "|---|---|---|---|---|",
    ...report.segments.map((s) => {
      const failing =
        s.checks
          .filter((k) => !k.pass)
          .map((k) => k.id)
          .join(", ") || "none";
      const a = s.auditor;
      const auditor =
        "skipped" in a
          ? "skipped"
          : "error" in a
            ? `error: ${a.error}`
            : `${a.verdict} (${a.findings} findings, ${a.attempts} attempt${a.attempts === 1 ? "" : "s"})`;
      return `| ${s.index} | ${cell(s.narrationSeq)} | ${s.fromSeq}-${s.toSeq} | ${failing} | ${cell(auditor)} |`;
    }),
    "",
  );

  out.push("## Fight statistics", "");
  const f = report.fight;
  if (!f) {
    out.push("Turn mode never began.", "");
  } else {
    const side = (s: { players: number; npcs: number }) =>
      `${s.players} players, ${s.npcs} npcs`;
    out.push(
      `- Rounds: ${f.rounds}`,
      `- Turns: ${side(f.turns)}`,
      `- Attack rolls: ${side(f.attackRolls)}`,
      `- Hits: ${side(f.hits)}`,
      `- Damage dealt: ${side(f.damageDealt)}`,
      `- Damage taken: ${side(f.damageTaken)}`,
      `- Reduced to zero: ${f.reducedToZero.join(", ") || "none"}`,
      `- Death-save rolls: ${f.deathSaveRolls}`,
      `- Fled or bargained: ${f.fledOrBargained ? f.fledOrBargained.join(", ") || "none" : "unknown"}`,
      `- Narrations in turn mode: ${f.turnModeNarrations}`,
      "",
    );
  }

  out.push("## Models and usage", "");
  for (const [purpose, m] of Object.entries(report.models)) {
    out.push(`- ${purpose}: ${m.provider} / ${m.model}`);
  }
  if (report.modelNote) out.push("", `Model note: ${report.modelNote}`);
  const u = report.usage;
  out.push(
    "",
    `Usage: ${u.calls} calls, ${u.inputTokens} input tokens, ${u.outputTokens} output tokens, cost ${u.costUsd === null ? "unknown" : `$${u.costUsd}`}.`,
    "",
  );
  return `${out.join("\n")}\n`;
}
