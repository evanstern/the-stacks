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
